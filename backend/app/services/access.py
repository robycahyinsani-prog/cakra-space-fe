import hmac
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.clock import clock
from app.core.config import Settings
from app.core.errors import Conflict, Invalid, NotFound
from app.core.security import OneTimeToken, Signer
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.integrations.documents import TableExporter
from app.integrations.mailer import Mailer
from app.models.account import User
from app.models.booking import GuestInvite
from app.models.enums import AccessResult, AreaType, BookingStatus, Credential
from app.models.operations import AccessLog, Device
from app.services.access_control import AccessControl
from app.services.membership import MembershipService


class AccessService:
    """QR dinamis member (BE-30), akses tamu (BE-31) dan log akses append-only (BE-32)."""

    EARLY_ENTRY = timedelta(minutes=15)

    def __init__(
        self, store: JsonStore, settings: Settings, acl: AccessControl, mailer: Mailer, membership: MembershipService
    ):
        self.store = store
        self.settings = settings
        self.acl = acl
        self.mailer = mailer
        self.membership = membership
        self.signer = Signer(f"{settings.secret_key}:qr")
        self.exporter = TableExporter()

    # QR member yang berganti setiap 30 detik

    def _window(self, at: datetime) -> int:
        return int(at.timestamp()) // self.settings.qr_window_seconds

    def qr_for(self, user: User) -> dict:
        now = clock.now()
        jendela = self._window(now)
        token = f"M.{user.id}.{jendela}.{self.signer.sign(f'{user.id}.{jendela}')[:24]}"
        sisa = self.settings.qr_window_seconds - int(now.timestamp()) % self.settings.qr_window_seconds
        return {"token": token, "expires_in": sisa, "refresh_after": sisa}

    def _member_from(self, token: str) -> int | None:
        try:
            _, uid, jendela, sig = token.split(".")
            uid, jendela = int(uid), int(jendela)
        except ValueError:
            return None
        # jendela sebelumnya masih diterima sebagai toleransi jeda pemindaian
        if self._window(clock.now()) - jendela not in (0, 1):
            return None
        if not hmac.compare_digest(self.signer.sign(f"{uid}.{jendela}")[:24], sig):
            return None
        return uid

    # validasi oleh perangkat pintu atau resepsionis

    def validate(
        self, token: str, building_id: int, door: str | None, device: Device | None, scanner: User | None
    ) -> dict:
        with self.store.write() as tx:
            building = tx.buildings.require(building_id)
            if token.startswith("G."):
                hasil = self._check_guest(tx, token, building_id)
                kredensial = Credential.GUEST_QR
            else:
                hasil = self._check_member(tx, token, building_id)
                kredensial = Credential.MEMBER_QR
            tx.access_logs.add(
                AccessLog(
                    building_id=building.id,
                    device_id=device.id if device else None,
                    door=door or (device.door if device else None),
                    user_id=hasil.get("user_id"),
                    guest_invite_id=hasil.get("guest_invite_id"),
                    inviter_id=hasil.get("inviter_id"),
                    credential=kredensial,
                    result=hasil["result"],
                    reason=hasil["reason"],
                    scanned_by=scanner.id if scanner else None,
                    scanned_at=clock.now(),
                )
            )
            return {
                "result": hasil["result"],
                "reason": hasil["reason"],
                "name": hasil.get("name"),
                "credential": kredensial,
            }

    def _check_member(self, tx: Tables, token: str, building_id: int) -> dict:
        uid = self._member_from(token)
        if uid is None:
            return {"result": AccessResult.DENIED, "reason": "QR kedaluwarsa atau tidak valid"}
        user = tx.users.get(uid)
        if user is None:
            return {"result": AccessResult.DENIED, "reason": "Akun tidak ditemukan"}
        dasar = {"user_id": user.id, "name": user.name}
        now = clock.now()
        building = tx.buildings.require(building_id)
        today = clock.local_today(building.timezone)
        sub = self.membership.current(tx, user.id)
        if sub and sub.is_usable_on(today) and tx.plans.require(sub.plan_id).covers(building_id):
            return {**dasar, "result": AccessResult.GRANTED, "reason": "Membership aktif"}
        booking = tx.bookings.first(
            lambda b: b.start_at - self.EARLY_ENTRY <= now <= b.end_at,
            user_id=user.id,
            building_id=building_id,
            status=BookingStatus.CONFIRMED,
        )
        if booking:
            return {**dasar, "result": AccessResult.GRANTED, "reason": f"Booking {booking.code}"}
        if sub and sub.is_frozen_on(today):
            return {**dasar, "result": AccessResult.DENIED, "reason": "Membership sedang freeze"}
        return {
            **dasar,
            "result": AccessResult.DENIED,
            "reason": "Tidak ada booking atau membership aktif di gedung ini",
        }

    def _check_guest(self, tx: Tables, token: str, building_id: int) -> dict:
        try:
            _, invite_id, rahasia = token.split(".", 2)
            invite = tx.guest_invites.get(int(invite_id))
        except ValueError:
            invite = None
        if invite is None or invite.token_hash != OneTimeToken.digest(rahasia):
            return {"result": AccessResult.DENIED, "reason": "QR tamu tidak valid"}
        dasar = {"guest_invite_id": invite.id, "inviter_id": invite.inviter_id, "name": invite.guest_name}
        booking = tx.bookings.require(invite.booking_id)
        now = clock.now()
        if booking.building_id != building_id:
            return {**dasar, "result": AccessResult.DENIED, "reason": "QR tamu untuk gedung lain"}
        if booking.status != BookingStatus.CONFIRMED:
            return {**dasar, "result": AccessResult.DENIED, "reason": "Rapat sudah dibatalkan"}
        if invite.used_at:
            return {**dasar, "result": AccessResult.DENIED, "reason": "QR tamu sudah dipakai"}
        if not invite.valid_from <= now <= invite.valid_until:
            return {**dasar, "result": AccessResult.DENIED, "reason": "QR tamu hanya berlaku pada jam rapat"}
        tx.guest_invites.update(invite.id, used_at=now)
        return {**dasar, "result": AccessResult.GRANTED, "reason": f"Tamu rapat {booking.code}"}

    # undangan tamu rapat

    def invite(self, user: User, booking_id: int, guests: list[dict]) -> list[dict]:
        with self.store.write() as tx:
            booking = tx.bookings.get(booking_id)
            if booking is None or booking.user_id != user.id:
                raise NotFound("Booking tidak ditemukan")
            area = tx.areas.require(booking.area_id)
            if area.type != AreaType.MEETING_ROOM:
                raise Invalid("Tamu hanya bisa diundang untuk booking ruang rapat")
            if booking.status != BookingStatus.CONFIRMED or booking.end_at <= clock.now():
                raise Conflict("Undang tamu hanya untuk booking terkonfirmasi yang belum selesai")
            sudah = tx.guest_invites.count(booking_id=booking.id)
            # member pengundang ikut dihitung sebagai satu orang di ruang rapat
            if sudah + len(guests) + 1 > area.capacity:
                raise Invalid(f"Jumlah tamu melebihi kapasitas ruang rapat ({area.capacity} orang)")
            building = tx.buildings.require(booking.building_id)
            tz = ZoneInfo(building.timezone)
            hasil = []
            for g in guests:
                rahasia, digest = OneTimeToken.new()
                invite = tx.guest_invites.add(
                    GuestInvite(
                        booking_id=booking.id,
                        inviter_id=user.id,
                        guest_name=g["name"],
                        guest_email=g["email"],
                        token_hash=digest,
                        valid_from=booking.start_at - self.EARLY_ENTRY,
                        valid_until=booking.end_at,
                    )
                )
                qr = f"G.{invite.id}.{rahasia}"
                self.mailer.send(
                    tx,
                    g["email"],
                    f"Undangan rapat di {building.name}",
                    f"Halo {g['name']}, {user.name} mengundang Anda rapat di {area.name}, {building.name} pada "
                    f"{booking.start_at.astimezone(tz):%d-%m-%Y %H:%M}-{booking.end_at.astimezone(tz):%H:%M}.\n"
                    f"Tunjukkan QR berikut di pintu masuk (sekali pakai): {qr}",
                    "guest_invite",
                )
                hasil.append(
                    {
                        "id": invite.id,
                        "guest_name": invite.guest_name,
                        "guest_email": invite.guest_email,
                        "valid_from": invite.valid_from,
                        "valid_until": invite.valid_until,
                    }
                )
            return hasil

    def guests(self, user: User, booking_id: int) -> list[dict]:
        with self.store.read() as tx:
            booking = tx.bookings.get(booking_id)
            if booking is None or booking.user_id != user.id:
                raise NotFound("Booking tidak ditemukan")
            return [
                {
                    "id": g.id,
                    "guest_name": g.guest_name,
                    "guest_email": g.guest_email,
                    "used_at": g.used_at,
                    "valid_from": g.valid_from,
                    "valid_until": g.valid_until,
                }
                for g in tx.guest_invites.where(booking_id=booking_id)
            ]

    # log akses untuk pengelola

    def logs(
        self,
        actor: User,
        building_id: int | None,
        date_from: date | None,
        date_to: date | None,
        user_id: int | None,
        result: AccessResult | None,
    ) -> list[dict]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "access.logs")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            awal = clock.combine(date_from, time(0), self.settings.timezone) if date_from else None
            akhir = clock.combine(date_to + timedelta(days=1), time(0), self.settings.timezone) if date_to else None
            items = tx.access_logs.where(
                lambda log: (
                    (gedung is None or log.building_id in gedung)
                    and (awal is None or log.scanned_at >= awal)
                    and (akhir is None or log.scanned_at < akhir)
                    and (user_id is None or log.user_id == user_id)
                    and (result is None or log.result == result)
                )
            )
            hasil = []
            for log in sorted(items, key=lambda x: x.scanned_at, reverse=True):
                user = tx.users.get(log.user_id)
                invite = tx.guest_invites.get(log.guest_invite_id)
                building = tx.buildings.get(log.building_id)
                hasil.append(
                    {
                        **log.model_dump(),
                        "member_name": user.name if user else None,
                        "guest_name": invite.guest_name if invite else None,
                        "building_name": building.name if building else None,
                    }
                )
            return hasil

    def export_logs(self, actor: User, **filters) -> tuple[bytes, str]:
        rows = self.logs(actor, **filters)
        tz = ZoneInfo(self.settings.timezone)
        data = [
            [
                r["scanned_at"].astimezone(tz).strftime("%Y-%m-%d %H:%M:%S"),
                r["building_name"],
                r["door"] or "",
                r["member_name"] or r["guest_name"] or "",
                r["credential"],
                r["result"],
                r["reason"],
            ]
            for r in rows
        ]
        konten = self.exporter.xlsx(
            "Log Akses", ["Waktu", "Gedung", "Pintu", "Nama", "Kredensial", "Hasil", "Alasan"], data
        )
        return konten, f"log-akses-{clock.now():%Y%m%d%H%M}.xlsx"
