import secrets
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.clock import clock
from app.core.config import Settings
from app.core.errors import Conflict, Forbidden, Invalid, NotFound
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.integrations.mailer import Mailer
from app.models.account import User
from app.models.booking import Booking
from app.models.enums import (
    AreaStatus,
    AreaType,
    BookingStatus,
    BuildingStatus,
    InvoiceStatus,
    PaymentStatus,
)
from app.models.location import Area, Building
from app.services.access_control import AccessControl
from app.services.audit import AuditLogger
from app.services.finance import FinanceService, VoucherService
from app.services.locations import AreaService, BookingRules, BuildingService, Schedule
from app.services.membership import MembershipService
from app.services.pricing import PricingService, Quote

@dataclass
class BookingRequest:
    area_id: int
    date: date
    start_time: time
    end_time: time
    voucher_code: str | None = None
    use_benefit: bool = False

class BookingWindow:
    """Rentang waktu booking dalam zona waktu gedung, beserta validasinya."""

    def __init__(self, building: Building, day: date, start: time, end: time):
        self.building = building
        self.day = day
        self.start_time = start
        self.end_time = end
        self.start_at = clock.combine(day, start, building.timezone)
        self.end_at = clock.combine(day, end, building.timezone)

    @property
    def minutes(self) -> int:
        return int((self.end_at - self.start_at).total_seconds() // 60)

    def validate(self, tx: Tables, settings: Settings) -> None:
        if self.end_time <= self.start_time:
            raise Invalid("Jam selesai harus setelah jam mulai")
        if self.start_time.minute % 30 or self.end_time.minute % 30 or self.start_time.second or self.end_time.second:
            raise Invalid("Jam booking harus kelipatan 30 menit, misalnya 09.00 atau 09.30")
        if self.minutes < 60:
            raise Invalid("Durasi booking minimal 1 jam")
        today = clock.local_today(self.building.timezone)
        if self.day > today + timedelta(days=settings.max_booking_days_ahead):
            raise Invalid(f"Booking paling jauh {settings.max_booking_days_ahead} hari ke depan")
        if self.start_at <= clock.now():
            raise Invalid("Jam mulai sudah lewat")
        buka = Schedule.opening(tx, self.building, self.day)
        if buka is None:
            raise Invalid("Gedung tutup atau libur pada tanggal itu")
        if self.start_at < buka[0] or self.end_at > buka[1]:
            raise Invalid("Booking harus di dalam jam operasional gedung")

class AvailabilityService:
    """Pencarian area kosong (BE-15) dan grid slot per jam untuk halaman booking."""

    def __init__(self, store: JsonStore, buildings: BuildingService, settings: Settings):
        self.store = store
        self.buildings = buildings
        self.settings = settings

    def search(self, user: User | None, building_id: int, day: date, start: time | None, end: time | None,
               area_type: AreaType | None, min_capacity: int | None) -> dict:
        now = clock.now()
        with self.store.read() as tx:
            building = self.buildings.visible(tx, user, building_id)
            buka = Schedule.opening(tx, building, day)
            window = None
            if start and end:
                window = BookingWindow(building, day, start, end)
                window.validate(tx, self.settings)
            areas = [a for a in tx.areas.where(building_id=building_id, status=AreaStatus.AVAILABLE)
                     if (area_type is None or a.type == area_type)
                     and (min_capacity is None or a.capacity >= min_capacity)]
            hasil = []
            for area in sorted(areas, key=lambda a: a.code):
                sibuk = self._busy(tx, area.id, day, building, now)
                bebas = None if window is None else not any(
                    s["start_at"] < window.end_at and window.start_at < s["end_at"] for s in sibuk)
                if window is not None and not bebas:
                    continue
                hasil.append({**AreaService.view(tx, area), "is_free": bebas, "busy": sibuk})
            return {"building_id": building_id, "date": day, "is_open": buka is not None,
                    "open_at": buka[0] if buka else None, "close_at": buka[1] if buka else None, "areas": hasil}

    def slots(self, user: User | None, building_id: int, day: date, area_type: AreaType | None = None,
              area_id: int | None = None) -> dict:
        """Grid slot per jam per area, status available, booked, past atau closed."""
        now = clock.now()
        with self.store.read() as tx:
            building = self.buildings.visible(tx, user, building_id)
            buka = Schedule.opening(tx, building, day)
            areas = tx.areas.where(building_id=building_id, status=AreaStatus.AVAILABLE)
            if area_type:
                areas = [a for a in areas if a.type == area_type]
            if area_id:
                areas = [a for a in areas if a.id == area_id]
                if not areas:
                    raise NotFound("Area tidak ditemukan")
            hasil = []
            for area in sorted(areas, key=lambda a: a.code):
                grid = []
                if buka:
                    sibuk = self._busy(tx, area.id, day, building, now)
                    mulai = buka[0]
                    while mulai + timedelta(hours=1) <= buka[1]:
                        selesai = mulai + timedelta(hours=1)
                        if selesai <= now:
                            status = "past"
                        elif any(s["start_at"] < selesai and mulai < s["end_at"] for s in sibuk):
                            status = "booked"
                        else:
                            status = "available"
                        lokal = mulai.astimezone(ZoneInfo(building.timezone))
                        grid.append({"start_time": lokal.strftime("%H:%M"),
                                     "end_time": selesai.astimezone(ZoneInfo(building.timezone)).strftime("%H:%M"),
                                     "start_at": mulai, "end_at": selesai, "status": status,
                                     "price": PricingService.base_price(area, 60)})
                        mulai = selesai
                hasil.append({"area": AreaService.view(tx, area), "slots": grid})
            return {"building_id": building_id, "date": day, "is_open": buka is not None, "areas": hasil}

    @staticmethod
    def _busy(tx: Tables, area_id: int, day: date, building: Building, now: datetime) -> list[dict]:
        awal = clock.combine(day, time(0), building.timezone)
        akhir = awal + timedelta(days=1)
        return [{"start_at": b.start_at, "end_at": b.end_at}
                for b in tx.bookings.where(lambda b: BookingRules.holds_slot(b, now) and b.overlaps(awal, akhir),
                                           area_id=area_id)]

class BookingService:
    def __init__(self, store: JsonStore, settings: Settings, acl: AccessControl, audit: AuditLogger,
                 mailer: Mailer, buildings: BuildingService, pricing: PricingService,
                 membership: MembershipService, refunds):
        self.store = store
        self.settings = settings
        self.acl = acl
        self.audit = audit
        self.mailer = mailer
        self.buildings = buildings
        self.pricing = pricing
        self.membership = membership
        self.refunds = refunds

    # ringkasan harga dan pembuatan booking (BE-16, BE-18)

    def quote(self, user: User, req: BookingRequest) -> Quote:
        with self.store.read() as tx:
            area, building, window = self._prepare(tx, user, req)
            return self.pricing.quote(tx, user, area, building, window.start_at, window.end_at, window.day,
                                      req.voucher_code, req.use_benefit)

    def create(self, user: User, req: BookingRequest) -> dict:
        # seluruh langkah berada di dalam satu transaksi tulis yang terkunci, jadi cek bentrok dan
        # penyimpanan tidak bisa disela pesanan lain (pengganti row lock pada database relasional)
        with self.store.write() as tx:
            if not user.is_verified:
                raise Forbidden("Verifikasi email terlebih dahulu sebelum booking", code="email_not_verified")
            if FinanceService.has_overdue(tx, user.id, clock.local_today(self.settings.timezone)):
                raise Forbidden("Anda masih punya tunggakan yang lewat jatuh tempo", code="has_arrears")
            area, building, window = self._prepare(tx, user, req)
            now = clock.now()
            if tx.bookings.exists(lambda b: BookingRules.blocks(b, now, window.start_at, window.end_at),
                                  area_id=area.id):
                raise Conflict("Slot ini baru saja dipesan orang lain", code="slot_taken",
                               suggestions=self._suggestions(tx, area, window, now))
            quote = self.pricing.quote(tx, user, area, building, window.start_at, window.end_at, window.day,
                                       req.voucher_code, req.use_benefit)
            gratis = quote.total == 0
            booking = tx.bookings.add(Booking(
                code=self._code(tx, window.day), user_id=user.id, building_id=building.id, area_id=area.id,
                start_at=window.start_at, end_at=window.end_at,
                status=BookingStatus.CONFIRMED if gratis else BookingStatus.PENDING_PAYMENT,
                subtotal=quote.subtotal, benefit_discount=quote.benefit_discount,
                voucher_discount=quote.voucher_discount, tax=quote.tax, total=quote.total,
                voucher_id=quote.voucher_id, subscription_id=quote.subscription_id,
                benefit_minutes=quote.benefit_minutes,
                hold_expires_at=None if gratis else now + timedelta(minutes=self.settings.booking_hold_minutes),
            ))
            if quote.voucher_id:
                VoucherService.reserve(tx, quote.voucher_id)
            if quote.subscription_id and quote.benefit_minutes:
                sub = tx.subscriptions.require(quote.subscription_id)
                self.membership.consume(tx, sub, booking, quote.benefit_minutes, window.day)
            if gratis:
                self._notify_confirmed(tx, booking)
            return self.view(tx, booking)

    def confirm(self, tx: Tables, booking: Booking) -> Booking:
        booking = tx.bookings.update(booking.id, status=BookingStatus.CONFIRMED, hold_expires_at=None)
        self._notify_confirmed(tx, booking)
        return booking

    # daftar dan detail milik member (BE-41)

    def list_mine(self, user: User, tab: str, page: int, size: int) -> dict:
        now = clock.now()
        with self.store.read() as tx:
            items = tx.bookings.where(user_id=user.id)
            if tab == "upcoming":
                items = [b for b in items if BookingRules.holds_slot(b, now) and b.end_at > now]
                items.sort(key=lambda b: b.start_at)
            else:
                items = [b for b in items if not (BookingRules.holds_slot(b, now) and b.end_at > now)]
                items.sort(key=lambda b: b.start_at, reverse=True)
            total = len(items)
            potong = items[(page - 1) * size: page * size]
            return {"items": [self.view(tx, b) for b in potong], "page": page, "size": size, "total": total}

    def detail(self, user: User, booking_id: int) -> dict:
        with self.store.read() as tx:
            booking = tx.bookings.require(booking_id)
            if booking.user_id != user.id:
                if not user.is_staff:
                    raise NotFound("Booking tidak ditemukan")
                self._require_staff_view(tx, user, booking.building_id)
            data = self.view(tx, booking)
            data["guests"] = [{"id": g.id, "guest_name": g.guest_name, "guest_email": g.guest_email,
                               "used_at": g.used_at} for g in tx.guest_invites.where(booking_id=booking.id)]
            return data

    def view(self, tx: Tables, booking: Booking) -> dict:
        now = clock.now()
        area = tx.areas.get(booking.area_id)
        building = tx.buildings.get(booking.building_id)
        tz = ZoneInfo(building.timezone)
        status = booking.status
        if status == BookingStatus.PENDING_PAYMENT and booking.hold_expires_at and booking.hold_expires_at <= now:
            status = BookingStatus.EXPIRED
        payment = max(tx.payments.where(purpose="booking", reference_id=booking.id), key=lambda p: p.id, default=None)
        invoice = max(tx.invoices.where(purpose="booking", reference_id=booking.id), key=lambda i: i.id, default=None)
        refund = max(tx.refunds.where(booking_id=booking.id), key=lambda r: r.id, default=None)
        masih_bisa_ubah = (status in (BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED)
                           and now <= booking.start_at - timedelta(hours=building.cancel_deadline_hours))
        return {
            **booking.model_dump(), "status": status,
            "local_date": booking.start_at.astimezone(tz).date(),
            "local_start": booking.start_at.astimezone(tz).strftime("%H:%M"),
            "local_end": booking.end_at.astimezone(tz).strftime("%H:%M"),
            "area": {"id": area.id, "code": area.code, "name": area.name, "type": area.type,
                     "capacity": area.capacity, "floor_id": area.floor_id} if area else None,
            "building": {"id": building.id, "code": building.code, "name": building.name, "city": building.city,
                         "timezone": building.timezone},
            "payment": {"id": payment.id, "status": payment.status, "method": payment.method,
                        "va_number": payment.va_number, "payment_url": payment.payment_url,
                        "expires_at": payment.expires_at} if payment else None,
            "invoice": {"id": invoice.id, "number": invoice.number, "status": invoice.status} if invoice else None,
            "refund": {"id": refund.id, "status": refund.status, "amount": refund.amount,
                       "percent": refund.percent} if refund else None,
            "can_pay": status == BookingStatus.PENDING_PAYMENT,
            "can_cancel": masih_bisa_ubah,
            "can_reschedule": masih_bisa_ubah,
            "can_invite_guests": status == BookingStatus.CONFIRMED and area is not None
            and area.type == AreaType.MEETING_ROOM and booking.end_at > now,
            "rebook": {"building_id": booking.building_id, "area_id": booking.area_id},
            "cancel_deadline": booking.start_at - timedelta(hours=building.cancel_deadline_hours),
        }

    # batal dan reschedule (BE-19)

    def cancel(self, user: User, booking_id: int, reason: str | None) -> dict:
        with self.store.write() as tx:
            booking = self._owned(tx, user, booking_id)
            building = tx.buildings.require(booking.building_id)
            self._check_deadline(booking, building, "dibatalkan")
            dibayar = tx.payments.first(lambda p: p.status == PaymentStatus.SUCCESS, purpose="booking",
                                        reference_id=booking.id)
            booking = tx.bookings.update(booking.id, status=BookingStatus.CANCELLED, cancelled_at=clock.now(),
                                         cancel_reason=reason, hold_expires_at=None)
            self._release(tx, booking)
            for p in tx.payments.where(purpose="booking", reference_id=booking.id, status=PaymentStatus.PENDING):
                tx.payments.update(p.id, status=PaymentStatus.EXPIRED)
            for inv in tx.invoices.where(purpose="booking", reference_id=booking.id, status=InvoiceStatus.UNPAID):
                tx.invoices.update(inv.id, status=InvoiceStatus.VOID)
            if dibayar:
                # booking yang sudah dibayar membuat permintaan refund (AC K5-US-004.4)
                self.refunds.request(tx, booking, dibayar, building)
            self.audit.record(tx, user.id, "booking.cancel", "booking", booking.id, reason=reason)
            self.mailer.send(tx, user.email, f"Booking {booking.code} dibatalkan",
                             "Booking Anda sudah dibatalkan."
                             + (" Permintaan refund sedang diproses." if dibayar else ""),
                             "booking_cancelled", user.id)
            return self.view(tx, booking)

    def reschedule(self, user: User, booking_id: int, day: date, start: time, end: time) -> dict:
        with self.store.write() as tx:
            booking = self._owned(tx, user, booking_id)
            building = tx.buildings.require(booking.building_id)
            self._check_deadline(booking, building, "dipindah")
            window = BookingWindow(building, day, start, end)
            window.validate(tx, self.settings)
            durasi = int((booking.end_at - booking.start_at).total_seconds() // 60)
            if window.minutes != durasi:
                raise Invalid("Durasi jadwal baru harus sama dengan booking awal")
            now = clock.now()
            # ketersediaan slot baru diperiksa ulang (AC K5-US-004.4)
            if tx.bookings.exists(lambda b: b.id != booking.id and BookingRules.holds_slot(b, now)
                                  and b.overlaps(window.start_at, window.end_at), area_id=booking.area_id):
                area = tx.areas.require(booking.area_id)
                raise Conflict("Jadwal baru sudah terisi", code="slot_taken",
                               suggestions=self._suggestions(tx, area, window, now))
            lama = booking.start_at
            booking = tx.bookings.update(booking.id, start_at=window.start_at, end_at=window.end_at,
                                         reminder_24_sent=False, reminder_1_sent=False, needs_relocation=False)
            for u in tx.benefit_usages.where(lambda u: u.reversed_at is None, booking_id=booking.id):
                sub = tx.subscriptions.get(u.subscription_id)
                if sub and sub.start_date:
                    tx.benefit_usages.update(u.id, period_start=self.membership.period_start(sub, day))
            self.audit.record(tx, user.id, "booking.reschedule", "booking", booking.id,
                              old_start=lama.isoformat(), new_start=window.start_at.isoformat())
            return self.view(tx, booking)

    # tampilan pengelola (BE-21) dan resepsionis

    def calendar(self, actor: User, building_id: int, date_from: date, date_to: date,
                 floor_id: int | None, area_type: AreaType | None) -> dict:
        if (date_to - date_from).days > 31:
            raise Invalid("Rentang kalender maksimal 31 hari")
        with self.store.read() as tx:
            self.acl.require_building(tx, actor, "bookings.calendar", building_id)
            return self._listing(tx, building_id, date_from, date_to, floor_id, area_type)

    def today(self, actor: User, building_id: int) -> dict:
        with self.store.read() as tx:
            self.acl.require_building(tx, actor, "bookings.today", building_id)
            building = tx.buildings.require(building_id)
            hari = clock.local_today(building.timezone)
            return self._listing(tx, building_id, hari, hari, None, None)

    def _listing(self, tx: Tables, building_id: int, date_from: date, date_to: date,
                 floor_id: int | None, area_type: AreaType | None) -> dict:
        building = tx.buildings.require(building_id)
        awal = clock.combine(date_from, time(0), building.timezone)
        akhir = clock.combine(date_to + timedelta(days=1), time(0), building.timezone)
        area_ok = {a.id: a for a in tx.areas.where(building_id=building_id)
                   if (floor_id is None or a.floor_id == floor_id) and (area_type is None or a.type == area_type)}
        now = clock.now()
        items = [b for b in tx.bookings.where(lambda b: b.overlaps(awal, akhir) and BookingRules.holds_slot(b, now),
                                              building_id=building_id) if b.area_id in area_ok]
        hasil = []
        for b in sorted(items, key=lambda b: b.start_at):
            member = tx.users.get(b.user_id)
            hasil.append({**self.view(tx, b), "member": {"id": member.id, "name": member.name,
                                                          "email": member.email} if member else None})
        return {"building_id": building_id, "date_from": date_from, "date_to": date_to, "items": hasil}

    # tugas terjadwal: hold kedaluwarsa (BE-17) dan pengingat (BE-20)

    def expire_holds(self, tx: Tables) -> int:
        now = clock.now()
        jumlah = 0
        for b in tx.bookings.where(lambda b: b.hold_expires_at is not None and b.hold_expires_at <= now,
                                   status=BookingStatus.PENDING_PAYMENT):
            tx.bookings.update(b.id, status=BookingStatus.EXPIRED)
            self._release(tx, b)
            for p in tx.payments.where(purpose="booking", reference_id=b.id, status=PaymentStatus.PENDING):
                tx.payments.update(p.id, status=PaymentStatus.EXPIRED)
            for inv in tx.invoices.where(purpose="booking", reference_id=b.id, status=InvoiceStatus.UNPAID):
                tx.invoices.update(inv.id, status=InvoiceStatus.VOID)
            jumlah += 1
        return jumlah

    def send_reminders(self, tx: Tables) -> int:
        now = clock.now()
        jumlah = 0
        for b in tx.bookings.where(lambda b: b.start_at > now, status=BookingStatus.CONFIRMED):
            sisa = b.start_at - now
            kirim = None
            if sisa <= timedelta(hours=1) and not b.reminder_1_sent:
                kirim, ubah = "1 jam", {"reminder_1_sent": True, "reminder_24_sent": True}
            elif timedelta(hours=1) < sisa <= timedelta(hours=24) and not b.reminder_24_sent:
                kirim, ubah = "24 jam", {"reminder_24_sent": True}
            if kirim is None:
                continue
            user = tx.users.get(b.user_id)
            area = tx.areas.get(b.area_id)
            building = tx.buildings.get(b.building_id)
            mulai = b.start_at.astimezone(ZoneInfo(building.timezone))
            self.mailer.send(tx, user.email, f"Pengingat booking {b.code}",
                             f"Jadwal Anda di {area.name}, {building.name} dimulai {mulai:%d-%m-%Y %H:%M} "
                             f"({kirim} lagi).", "booking_reminder", user.id)
            tx.bookings.update(b.id, **ubah)
            jumlah += 1
        return jumlah

    # pembantu

    def _prepare(self, tx: Tables, user: User, req: BookingRequest) -> tuple[Area, Building, BookingWindow]:
        area = tx.areas.require(req.area_id)
        building = tx.buildings.require(area.building_id)
        if building.status != BuildingStatus.ACTIVE or area.status != AreaStatus.AVAILABLE:
            raise Conflict("Area ini sedang tidak bisa dipesan")
        window = BookingWindow(building, req.date, req.start_time, req.end_time)
        window.validate(tx, self.settings)
        return area, building, window

    def _suggestions(self, tx: Tables, area: Area, window: BookingWindow, now: datetime) -> list[dict]:
        """Area lain yang masih kosong dengan tipe sama (AC K5-US-004.3)."""
        hasil = []
        for a in tx.areas.where(building_id=area.building_id, type=area.type, status=AreaStatus.AVAILABLE):
            if a.id == area.id or a.capacity < area.capacity:
                continue
            if tx.bookings.exists(lambda b: BookingRules.blocks(b, now, window.start_at, window.end_at),
                                  area_id=a.id):
                continue
            hasil.append({"area_id": a.id, "code": a.code, "name": a.name, "capacity": a.capacity})
            if len(hasil) == 3:
                break
        return hasil

    @staticmethod
    def _code(tx: Tables, day: date) -> str:
        while True:
            kode = f"CS{day:%y%m%d}-{secrets.token_hex(2).upper()}"
            if not tx.bookings.exists(code=kode):
                return kode

    def _owned(self, tx: Tables, user: User, booking_id: int) -> Booking:
        booking = tx.bookings.get(booking_id)
        if booking is None or booking.user_id != user.id:
            raise NotFound("Booking tidak ditemukan")
        return booking

    @staticmethod
    def _check_deadline(booking: Booking, building: Building, aksi: str) -> None:
        now = clock.now()
        kedaluwarsa = booking.hold_expires_at is not None and booking.hold_expires_at <= now
        if booking.status == BookingStatus.PENDING_PAYMENT and kedaluwarsa:
            raise Conflict("Booking sudah kedaluwarsa")
        if booking.status not in (BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED):
            raise Conflict("Booking ini sudah tidak aktif")
        if now > booking.start_at - timedelta(hours=building.cancel_deadline_hours):
            raise Conflict(f"Booking hanya bisa {aksi} paling lambat {building.cancel_deadline_hours} jam "
                           "sebelum jadwal mulai")

    def _release(self, tx: Tables, booking: Booking) -> None:
        VoucherService.release(tx, booking.voucher_id)
        self.membership.reverse(tx, booking.id)

    def _require_staff_view(self, tx: Tables, user: User, building_id: int) -> None:
        izin = "bookings.calendar" if self.acl.has(tx, user, "bookings.calendar") else "bookings.today"
        self.acl.require_building(tx, user, izin, building_id)

    def _notify_confirmed(self, tx: Tables, booking: Booking) -> None:
        user = tx.users.get(booking.user_id)
        area = tx.areas.get(booking.area_id)
        building = tx.buildings.get(booking.building_id)
        mulai = booking.start_at.astimezone(ZoneInfo(building.timezone))
        self.mailer.send(tx, user.email, f"Booking {booking.code} terkonfirmasi",
                         f"{area.name} di {building.name}, {mulai:%d-%m-%Y %H:%M}. "
                         "Tunjukkan QR di aplikasi saat datang.",
                         "booking_confirmed", user.id)
