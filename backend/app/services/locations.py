from __future__ import annotations

from datetime import date, datetime, time
from pathlib import Path

from app.core.clock import clock
from app.core.errors import Conflict, Invalid, NotFound
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.models.account import User
from app.models.booking import Booking
from app.models.enums import AreaStatus, AreaType, BookingStatus, BuildingStatus, FacilityScope
from app.models.location import (
    Area,
    AreaFacility,
    Building,
    BuildingFacility,
    Facility,
    Floor,
    Holiday,
    OperatingHour,
)
from app.services.access_control import AccessControl
from app.services.audit import AuditLogger


class Schedule:
    """Jam buka dan hari libur per gedung (BE-09)."""

    @staticmethod
    def opening(tx: Tables, building: Building, day: date) -> tuple[datetime, datetime] | None:
        if tx.holidays.exists(lambda h: h.date == day, building_id=building.id):
            return None
        jam = tx.operating_hours.first(building_id=building.id, weekday=day.weekday())
        if jam is None or jam.is_closed:
            return None
        return (
            clock.combine(day, jam.open_time, building.timezone),
            clock.combine(day, jam.close_time, building.timezone),
        )

    @staticmethod
    def default_hours(building_id: int) -> list[OperatingHour]:
        # Senin sampai Jumat 08.00-21.00, Sabtu 09.00-18.00, Minggu tutup
        hasil = []
        for hari in range(7):
            buka, tutup = (time(8), time(21)) if hari < 5 else (time(9), time(18))
            hasil.append(
                OperatingHour(
                    building_id=building_id, weekday=hari, open_time=buka, close_time=tutup, is_closed=hari == 6
                )
            )
        return hasil


class BookingRules:
    """Status booking yang masih memegang slot, dipakai banyak layanan."""

    @staticmethod
    def holds_slot(b: Booking, now: datetime) -> bool:
        if b.status == BookingStatus.CONFIRMED:
            return True
        return b.status == BookingStatus.PENDING_PAYMENT and (b.hold_expires_at is None or b.hold_expires_at > now)

    @staticmethod
    def blocks(b: Booking, now: datetime, start: datetime, end: datetime) -> bool:
        return BookingRules.holds_slot(b, now) and b.overlaps(start, end)

    @staticmethod
    def active_future(tx: Tables, now: datetime, **eq) -> list[Booking]:
        return tx.bookings.where(lambda b: BookingRules.holds_slot(b, now) and b.end_at > now, **eq)


class BuildingService:
    def __init__(self, store: JsonStore, acl: AccessControl, audit: AuditLogger, upload_dir: Path):
        self.store = store
        self.acl = acl
        self.audit = audit
        self.upload_dir = upload_dir

    # gedung (BE-08)

    def list(self, user: User | None, city: str | None = None, q: str | None = None) -> list[Building]:
        with self.store.read() as tx:
            items = tx.buildings.all()
            if user is None or not user.is_staff:
                items = [b for b in items if b.status == BuildingStatus.ACTIVE]
            else:
                cakupan = self.acl.scope(tx, user)
                if cakupan is not None:
                    items = [b for b in items if b.id in cakupan]
        if city:
            items = [b for b in items if b.city.lower() == city.lower()]
        if q:
            kata = q.lower()
            items = [b for b in items if kata in b.name.lower() or kata in b.city.lower()]
        return sorted(items, key=lambda b: b.name)

    def detail(self, user: User | None, building_id: int) -> dict:
        with self.store.read() as tx:
            building = self.visible(tx, user, building_id)
            relasi = tx.building_facilities.where(building_id=building_id)
            fasilitas = [tx.facilities.get(bf.facility_id) for bf in relasi]
            return {
                "building": building,
                "operating_hours": sorted(tx.operating_hours.where(building_id=building_id), key=lambda h: h.weekday),
                "holidays": sorted(tx.holidays.where(building_id=building_id), key=lambda h: h.date),
                "floors": sorted(tx.floors.where(building_id=building_id), key=lambda f: f.level),
                "facilities": [f for f in fasilitas if f],
            }

    def visible(self, tx: Tables, user: User | None, building_id: int) -> Building:
        building = tx.buildings.require(building_id)
        if building.status == BuildingStatus.ACTIVE:
            return building
        if user and user.is_staff:
            cakupan = self.acl.scope(tx, user)
            if cakupan is None or building_id in cakupan:
                return building
        # gedung Draf dan Nonaktif tidak tampil ke member
        raise NotFound("Gedung tidak ditemukan")

    def create(self, actor: User, data: dict) -> Building:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "buildings.manage")
            data["code"] = data["code"].upper()
            if tx.buildings.exists(code=data["code"]):
                raise Conflict("Kode gedung sudah dipakai")
            building = tx.buildings.add(Building(**data, status=BuildingStatus.DRAFT))
            tx.operating_hours.add_many(Schedule.default_hours(building.id))
            self.audit.record(tx, actor.id, "building.create", "building", building.id)
            return building

    def update(self, actor: User, building_id: int, changes: dict) -> Building:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "buildings.edit", building_id)
            if "code" in changes:
                changes["code"] = changes["code"].upper()
                if tx.buildings.exists(lambda b: b.id != building_id, code=changes["code"]):
                    raise Conflict("Kode gedung sudah dipakai")
            building = tx.buildings.update(building_id, **changes)
            self.audit.record(tx, actor.id, "building.update", "building", building_id, fields=sorted(changes))
            return building

    def set_status(self, actor: User, building_id: int, status: BuildingStatus) -> Building:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "buildings.manage")
            tx.buildings.require(building_id)
            building = tx.buildings.update(building_id, status=status)
            self.audit.record(tx, actor.id, "building.status", "building", building_id, status=status)
            return building

    def delete(self, actor: User, building_id: int) -> None:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "buildings.manage")
            tx.buildings.require(building_id)
            if BookingRules.active_future(tx, clock.now(), building_id=building_id):
                raise Conflict("Gedung masih punya booking aktif, nonaktifkan saja")
            if tx.bookings.exists(building_id=building_id):
                raise Conflict("Gedung punya riwayat booking, nonaktifkan saja supaya riwayat tetap utuh")
            for nama in ("operating_hours", "holidays", "floors", "building_facilities", "areas", "user_buildings"):
                getattr(tx, nama).delete_where(building_id=building_id)
            tx.buildings.delete(building_id)
            self.audit.record(tx, actor.id, "building.delete", "building", building_id)

    def set_refund_policy(self, actor: User, building_id: int, policy: dict) -> Building:
        if policy["refund_partial_hours"] > policy["refund_full_hours"]:
            raise Invalid("Batas refund sebagian harus lebih pendek dari batas refund penuh")
        return self.update(actor, building_id, policy)

    # jam operasional dan hari libur (BE-09)

    def set_hours(self, actor: User, building_id: int, hours: list[dict]) -> list[OperatingHour]:
        hari = [h["weekday"] for h in hours]
        if sorted(hari) != list(range(7)):
            raise Invalid("Isi jam operasional untuk tujuh hari, Senin (0) sampai Minggu (6)")
        for h in hours:
            if not h["is_closed"] and h["open_time"] >= h["close_time"]:
                raise Invalid("Jam tutup harus setelah jam buka")
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "buildings.edit", building_id)
            tx.buildings.require(building_id)
            tx.operating_hours.delete_where(building_id=building_id)
            hasil = tx.operating_hours.add_many(OperatingHour(building_id=building_id, **h) for h in hours)
            self.audit.record(tx, actor.id, "building.hours", "building", building_id)
            return sorted(hasil, key=lambda h: h.weekday)

    def add_holiday(self, actor: User, building_id: int, day: date, description: str) -> Holiday:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "buildings.edit", building_id)
            tx.buildings.require(building_id)
            if tx.holidays.exists(lambda h: h.date == day, building_id=building_id):
                raise Conflict("Tanggal itu sudah tercatat sebagai hari libur")
            return tx.holidays.add(Holiday(building_id=building_id, date=day, description=description))

    def delete_holiday(self, actor: User, holiday_id: int) -> None:
        with self.store.write() as tx:
            libur = tx.holidays.require(holiday_id)
            self.acl.require_building(tx, actor, "buildings.edit", libur.building_id)
            tx.holidays.delete(holiday_id)

    # lantai dan denah (BE-10, BE-14)

    def add_floor(self, actor: User, building_id: int, name: str, level: int) -> Floor:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "buildings.edit", building_id)
            tx.buildings.require(building_id)
            if tx.floors.exists(building_id=building_id, level=level):
                raise Conflict("Lantai dengan nomor itu sudah ada")
            return tx.floors.add(Floor(building_id=building_id, name=name, level=level))

    def update_floor(self, actor: User, floor_id: int, changes: dict) -> Floor:
        with self.store.write() as tx:
            lantai = tx.floors.require(floor_id)
            self.acl.require_building(tx, actor, "buildings.edit", lantai.building_id)
            return tx.floors.update(floor_id, **changes)

    def delete_floor(self, actor: User, floor_id: int) -> None:
        with self.store.write() as tx:
            lantai = tx.floors.require(floor_id)
            self.acl.require_building(tx, actor, "buildings.edit", lantai.building_id)
            if tx.areas.exists(floor_id=floor_id):
                raise Conflict("Lantai masih punya area, pindahkan atau hapus areanya dulu")
            tx.floors.delete(floor_id)

    def save_floor_plan(self, actor: User, floor_id: int, content: bytes, content_type: str) -> Floor:
        if content_type not in ("image/png", "image/jpeg", "image/webp", "image/svg+xml"):
            raise Invalid("Denah harus berupa gambar PNG, JPG, WEBP atau SVG")
        if len(content) > 5 * 1024 * 1024:
            raise Invalid("Ukuran denah maksimal 5 MB")
        with self.store.write() as tx:
            lantai = tx.floors.require(floor_id)
            self.acl.require_building(tx, actor, "areas.manage", lantai.building_id)
            self.upload_dir.mkdir(parents=True, exist_ok=True)
            ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg"}[content_type]
            nama = f"floor-{floor_id}.{ext}"
            (self.upload_dir / nama).write_bytes(content)
            return tx.floors.update(floor_id, plan_file=nama, plan_content_type=content_type)

    def floor_plan(self, floor_id: int) -> tuple[Path, str]:
        with self.store.read() as tx:
            lantai = tx.floors.require(floor_id)
        if not lantai.plan_file or not (self.upload_dir / lantai.plan_file).exists():
            raise NotFound("Denah lantai belum diunggah")
        return self.upload_dir / lantai.plan_file, lantai.plan_content_type

    # fasilitas master dan fasilitas gedung (BE-10)

    def list_facilities(self, scope: FacilityScope | None = None, building_id: int | None = None) -> list[Facility]:
        with self.store.read() as tx:
            items = tx.facilities.where(lambda f: f.building_id is None or f.building_id == building_id)
        return [f for f in items if scope is None or f.scope == scope]

    def create_facility(self, actor: User, name: str, scope: FacilityScope, building_id: int | None) -> Facility:
        with self.store.write() as tx:
            if building_id is None:
                self.acl.require(tx, actor, "buildings.manage")
            else:
                self.acl.require_building(tx, actor, "buildings.edit", building_id)
            if tx.facilities.exists(lambda f: f.name.lower() == name.lower() and f.building_id in (None, building_id)):
                raise Conflict("Fasilitas dengan nama itu sudah ada")
            return tx.facilities.add(Facility(name=name, scope=scope, building_id=building_id))

    def set_facilities(self, actor: User, building_id: int, facility_ids: list[int]) -> list[Facility]:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "buildings.edit", building_id)
            fasilitas = [self._facility_for(tx, fid, building_id, FacilityScope.BUILDING) for fid in set(facility_ids)]
            tx.building_facilities.delete_where(building_id=building_id)
            tx.building_facilities.add_many(
                BuildingFacility(building_id=building_id, facility_id=f.id) for f in fasilitas
            )
            return fasilitas

    @staticmethod
    def _facility_for(tx: Tables, facility_id: int, building_id: int, scope: FacilityScope) -> Facility:
        f = tx.facilities.require(facility_id)
        if f.scope != scope or f.building_id not in (None, building_id):
            raise Invalid(f"Fasilitas {f.name} tidak bisa dipakai di sini")
        return f


class AreaService:
    def __init__(self, store: JsonStore, acl: AccessControl, audit: AuditLogger, buildings: BuildingService):
        self.store = store
        self.acl = acl
        self.audit = audit
        self.buildings = buildings

    # area meja dan ruang rapat (BE-11, BE-12)

    def list(
        self,
        user: User | None,
        building_id: int,
        area_type: AreaType | None = None,
        floor_id: int | None = None,
        min_capacity: int | None = None,
    ) -> list[dict]:
        with self.store.read() as tx:
            self.buildings.visible(tx, user, building_id)
            items = tx.areas.where(building_id=building_id)
            if not (user and user.is_staff):
                # area Perawatan dan Nonaktif tidak muncul untuk member (AC K5-US-003.3)
                items = [a for a in items if a.status == AreaStatus.AVAILABLE]
            if area_type:
                items = [a for a in items if a.type == area_type]
            if floor_id:
                items = [a for a in items if a.floor_id == floor_id]
            if min_capacity:
                items = [a for a in items if a.capacity >= min_capacity]
            return [self.view(tx, a) for a in sorted(items, key=lambda a: a.code)]

    def detail(self, user: User | None, area_id: int) -> dict:
        with self.store.read() as tx:
            area = tx.areas.require(area_id)
            self.buildings.visible(tx, user, area.building_id)
            if area.status != AreaStatus.AVAILABLE and not (user and user.is_staff):
                raise NotFound("Area tidak ditemukan")
            return self.view(tx, area)

    @staticmethod
    def view(tx: Tables, area: Area) -> dict:
        fasilitas = [tx.facilities.get(af.facility_id) for af in tx.area_facilities.where(area_id=area.id)]
        lantai = tx.floors.get(area.floor_id)
        return {
            **area.model_dump(),
            "floor_name": lantai.name if lantai else None,
            "facilities": [f.name for f in fasilitas if f],
        }

    def create(self, actor: User, data: dict) -> dict:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "areas.manage", data["building_id"])
            tx.buildings.require(data["building_id"])
            lantai = tx.floors.require(data["floor_id"])
            if lantai.building_id != data["building_id"]:
                raise Invalid("Lantai bukan milik gedung ini")
            data["code"] = data["code"].upper()
            self._check_code(tx, data["building_id"], data["code"])
            data["capacity"] = self._capacity(data["type"], data.get("capacity"))
            area = tx.areas.add(Area(**data))
            self.audit.record(tx, actor.id, "area.create", "area", area.id)
            return self.view(tx, area)

    def update(self, actor: User, area_id: int, changes: dict) -> dict:
        with self.store.write() as tx:
            area = tx.areas.require(area_id)
            self.acl.require_building(tx, actor, "areas.manage", area.building_id)
            if "code" in changes:
                changes["code"] = changes["code"].upper()
                self._check_code(tx, area.building_id, changes["code"], exclude=area_id)
            if "floor_id" in changes and tx.floors.require(changes["floor_id"]).building_id != area.building_id:
                raise Invalid("Lantai bukan milik gedung ini")
            tipe = changes.get("type", area.type)
            changes["capacity"] = self._capacity(tipe, changes.get("capacity", area.capacity))
            area = tx.areas.update(area_id, **changes)
            self.audit.record(tx, actor.id, "area.update", "area", area_id, fields=sorted(changes))
            return self.view(tx, area)

    def delete(self, actor: User, area_id: int) -> None:
        with self.store.write() as tx:
            area = tx.areas.require(area_id)
            self.acl.require_building(tx, actor, "areas.manage", area.building_id)
            if tx.bookings.exists(area_id=area_id):
                raise Conflict("Area punya riwayat booking, ubah statusnya menjadi Nonaktif saja")
            tx.area_facilities.delete_where(area_id=area_id)
            tx.areas.delete(area_id)
            self.audit.record(tx, actor.id, "area.delete", "area", area_id)

    def set_facilities(self, actor: User, area_id: int, facility_ids: list[int]) -> dict:
        with self.store.write() as tx:
            area = tx.areas.require(area_id)
            self.acl.require_building(tx, actor, "areas.manage", area.building_id)
            fasilitas = [
                BuildingService._facility_for(tx, fid, area.building_id, FacilityScope.AREA)
                for fid in set(facility_ids)
            ]
            tx.area_facilities.delete_where(area_id=area_id)
            tx.area_facilities.add_many(AreaFacility(area_id=area_id, facility_id=f.id) for f in fasilitas)
            return self.view(tx, area)

    # status area dengan audit log (BE-13)

    def set_status(self, actor: User, area_id: int, status: AreaStatus, reason: str | None) -> dict:
        with self.store.write() as tx:
            area = tx.areas.require(area_id)
            self.acl.require_building(tx, actor, "areas.manage", area.building_id)
            terdampak = []
            if status != AreaStatus.AVAILABLE:
                # booking yang sudah ada ditandai supaya dipindahkan pengelola
                for b in BookingRules.active_future(tx, clock.now(), area_id=area_id):
                    tx.bookings.update(b.id, needs_relocation=True)
                    terdampak.append(b.code)
            area = tx.areas.update(area_id, status=status)
            self.audit.record(
                tx, actor.id, "area.status", "area", area_id, status=status, reason=reason, affected_bookings=terdampak
            )
            return {**self.view(tx, area), "affected_bookings": terdampak}

    # titik area di denah (BE-14)

    def set_position(self, actor: User, area_id: int, pos_x: float, pos_y: float) -> dict:
        with self.store.write() as tx:
            area = tx.areas.require(area_id)
            self.acl.require_building(tx, actor, "areas.manage", area.building_id)
            return self.view(tx, tx.areas.update(area_id, pos_x=pos_x, pos_y=pos_y))

    def floor_map(self, user: User | None, floor_id: int, at: datetime | None) -> dict:
        now = clock.now()
        at = at or now
        with self.store.read() as tx:
            lantai = tx.floors.require(floor_id)
            self.buildings.visible(tx, user, lantai.building_id)
            titik = []
            for area in tx.areas.where(floor_id=floor_id):
                if area.pos_x is None or area.pos_y is None:
                    continue
                if area.status == AreaStatus.INACTIVE and not (user and user.is_staff):
                    continue
                if area.status == AreaStatus.MAINTENANCE:
                    status = "maintenance"
                elif tx.bookings.exists(
                    lambda b: BookingRules.holds_slot(b, now) and b.start_at <= at < b.end_at, area_id=area.id
                ):
                    status = "occupied"
                else:
                    status = "available"
                titik.append(
                    {
                        "area_id": area.id,
                        "code": area.code,
                        "name": area.name,
                        "type": area.type,
                        "pos_x": area.pos_x,
                        "pos_y": area.pos_y,
                        "status": status,
                    }
                )
            return {"floor": lantai, "has_plan": bool(lantai.plan_file), "at": at, "areas": titik}

    # pembantu

    @staticmethod
    def _check_code(tx: Tables, building_id: int, code: str, exclude: int | None = None) -> None:
        if tx.areas.exists(lambda a: a.id != exclude, building_id=building_id, code=code):
            raise Conflict("Kode area sudah dipakai di gedung ini")

    @staticmethod
    def _capacity(area_type: AreaType, capacity: int | None) -> int:
        if area_type == AreaType.MEETING_ROOM:
            if not capacity or capacity < 2:
                raise Invalid("Kapasitas ruang rapat wajib diisi, minimal 2 orang")
            return capacity
        # kapasitas meja selalu 1 (AC K5-US-003.2)
        return 1
