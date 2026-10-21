from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import date, timedelta

from app.core.clock import clock
from app.core.config import Settings
from app.core.errors import Conflict, NotFound, Unauthorized
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.integrations.mailer import Mailer
from app.models.account import User
from app.models.enums import CommandStatus, CommandType, DeviceType, Role
from app.models.operations import Device, DeviceCommand, DeviceMaintenance
from app.services.access_control import AccessControl
from app.services.audit import AuditLogger


class DeviceService:
    """Perangkat pintu: registrasi dan API key (BE-48), heartbeat (BE-49), perintah (BE-50), maintenance (BE-51)."""

    def __init__(self, store: JsonStore, settings: Settings, acl: AccessControl, audit: AuditLogger, mailer: Mailer):
        self.store = store
        self.settings = settings
        self.acl = acl
        self.audit = audit
        self.mailer = mailer

    @staticmethod
    def _digest(key: str) -> str:
        return hashlib.sha256(key.encode()).hexdigest()

    def is_online(self, device: Device) -> bool:
        batas = clock.now() - timedelta(minutes=self.settings.device_offline_minutes)
        return bool(device.last_heartbeat_at and device.last_heartbeat_at >= batas)

    def view(self, tx: Tables, device: Device) -> dict:
        data = device.model_dump(exclude={"key_hash"})
        data["status"] = "revoked" if device.is_revoked else ("online" if self.is_online(device) else "offline")
        data["pending_commands"] = tx.device_commands.count(device_id=device.id, status=CommandStatus.PENDING)
        return data

    # registrasi dan pencabutan

    def register(self, actor: User, building_id: int, name: str, device_type: DeviceType, door: str) -> dict:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "devices.manage", building_id)
            tx.buildings.require(building_id)
            prefix = secrets.token_hex(4)
            key = f"dev_{prefix}_{secrets.token_urlsafe(24)}"
            device = tx.devices.add(
                Device(
                    building_id=building_id,
                    name=name,
                    type=device_type,
                    door=door,
                    key_prefix=prefix,
                    key_hash=self._digest(key),
                )
            )
            self.audit.record(tx, actor.id, "device.register", "device", device.id)
            # API key hanya ditampilkan sekali, server menyimpan hash-nya saja
            return {**self.view(tx, device), "api_key": key}

    def list(self, actor: User, building_id: int | None) -> list[dict]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "devices.manage")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            items = tx.devices.where(lambda d: gedung is None or d.building_id in gedung)
            return [self.view(tx, d) for d in sorted(items, key=lambda d: (d.building_id, d.door))]

    def revoke(self, actor: User, device_id: int) -> dict:
        with self.store.write() as tx:
            device = self._managed(tx, actor, device_id, "devices.manage")
            device = tx.devices.update(device.id, is_revoked=True)
            self.audit.record(tx, actor.id, "device.revoke", "device", device.id)
            return self.view(tx, device)

    def authenticate(self, key: str | None) -> Device:
        if not key or not key.startswith("dev_"):
            raise Unauthorized("API key perangkat tidak valid")
        try:
            _, prefix, _ = key.split("_", 2)
        except ValueError as exc:
            raise Unauthorized("API key perangkat tidak valid") from exc
        with self.store.read() as tx:
            device = tx.devices.first(key_prefix=prefix)
        if device is None or not hmac.compare_digest(device.key_hash, self._digest(key)):
            raise Unauthorized("API key perangkat tidak valid")
        if device.is_revoked:
            # perangkat yang dicabut langsung tidak bisa memanggil API (AC K5-US-010.1)
            raise Unauthorized("Perangkat sudah dicabut")
        return device

    # heartbeat dan deteksi offline

    def heartbeat(self, device: Device) -> dict:
        with self.store.write() as tx:
            device = tx.devices.update(device.id, last_heartbeat_at=clock.now(), offline_notified=False)
            return {
                "status": "online",
                "pending_commands": tx.device_commands.count(device_id=device.id, status=CommandStatus.PENDING),
            }

    def detect_offline(self, tx: Tables) -> int:
        jumlah = 0
        for device in tx.devices.where(is_revoked=False, offline_notified=False):
            if device.last_heartbeat_at is None or self.is_online(device):
                continue
            building = tx.buildings.get(device.building_id)
            for ub in tx.user_buildings.where(building_id=device.building_id):
                staf = tx.users.get(ub.user_id)
                if staf and staf.role == Role.LOCATION_MANAGER:
                    self.mailer.send(
                        tx,
                        staf.email,
                        f"Perangkat {device.name} offline",
                        f"{device.name} ({device.door}) di {building.name} tidak mengirim heartbeat "
                        f"lebih dari {self.settings.device_offline_minutes} menit.",
                        "device_offline",
                        staf.id,
                    )
            tx.devices.update(device.id, offline_notified=True)
            jumlah += 1
        return jumlah

    # perintah jarak jauh

    def send_command(self, actor: User, device_id: int, command: CommandType) -> DeviceCommand:
        with self.store.write() as tx:
            device = self._managed(tx, actor, device_id, "devices.command")
            if device.is_revoked:
                raise Conflict("Perangkat sudah dicabut")
            cmd = tx.device_commands.add(DeviceCommand(device_id=device.id, command=command, requested_by=actor.id))
            # setiap perintah tercatat di audit log beserta nama pengirimnya (AC K5-US-010.3)
            self.audit.record(
                tx,
                actor.id,
                "device.command",
                "device",
                device.id,
                command=command,
                command_id=cmd.id,
                sender=actor.name,
            )
            return cmd

    def commands(self, actor: User, device_id: int) -> list[dict]:
        with self.store.read() as tx:
            self._managed(tx, actor, device_id, "devices.manage")
            hasil = []
            for c in sorted(tx.device_commands.where(device_id=device_id), key=lambda c: c.id, reverse=True):
                pengirim = tx.users.get(c.requested_by)
                hasil.append({**c.model_dump(), "requested_by_name": pengirim.name if pengirim else None})
            return hasil

    def poll(self, device: Device) -> list[DeviceCommand]:
        with self.store.write() as tx:
            antre = tx.device_commands.where(device_id=device.id, status=CommandStatus.PENDING)
            return [
                tx.device_commands.update(c.id, status=CommandStatus.DELIVERED, delivered_at=clock.now())
                for c in sorted(antre, key=lambda c: c.id)
            ]

    def complete(self, device: Device, command_id: int, success: bool, result: str | None) -> DeviceCommand:
        with self.store.write() as tx:
            cmd = tx.device_commands.get(command_id)
            if cmd is None or cmd.device_id != device.id:
                raise NotFound("Perintah tidak ditemukan")
            return tx.device_commands.update(
                cmd.id,
                status=CommandStatus.DONE if success else CommandStatus.FAILED,
                completed_at=clock.now(),
                result=result,
            )

    # riwayat maintenance

    def add_maintenance(
        self, actor: User, device_id: int, day: date, issue: str, action: str, technician: str
    ) -> DeviceMaintenance:
        with self.store.write() as tx:
            device = self._managed(tx, actor, device_id, "devices.manage")
            return tx.device_maintenances.add(
                DeviceMaintenance(
                    device_id=device.id,
                    date=day,
                    issue=issue,
                    action=action,
                    technician=technician,
                    created_by=actor.id,
                )
            )

    def maintenances(self, actor: User, device_id: int) -> list[DeviceMaintenance]:
        with self.store.read() as tx:
            self._managed(tx, actor, device_id, "devices.manage")
            return sorted(tx.device_maintenances.where(device_id=device_id), key=lambda m: (m.date, m.id), reverse=True)

    def _managed(self, tx: Tables, actor: User, device_id: int, permission: str) -> Device:
        device = tx.devices.require(device_id)
        self.acl.require_building(tx, actor, permission, device.building_id)
        return device
