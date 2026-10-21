"""Data contoh Cakra Space. Jalankan `python -m app.seed`, berkas data lama ditimpa."""

import os
import random
import secrets
from datetime import date, datetime, time, timedelta

from app.core.clock import clock
from app.core.config import get_settings
from app.core.security import PasswordHasher
from app.db.json_store import JsonStore
from app.models.account import User, UserBuilding
from app.models.billing import Arrear, Deposit, Invoice, Payment, Refund, Voucher
from app.models.booking import Booking
from app.models.enums import (
    AccessResult,
    AreaType,
    BenefitType,
    BookingStatus,
    BuildingStatus,
    Credential,
    DeviceType,
    DiscountType,
    FacilityScope,
    InvoiceStatus,
    PaymentMethod,
    PaymentPurpose,
    PaymentStatus,
    RefundStatus,
    Role,
    SubscriptionStatus,
)
from app.models.location import Area, AreaFacility, Building, BuildingFacility, Facility, Floor, Holiday
from app.models.membership import BenefitUsage, Plan, PlanBenefit, Subscription
from app.models.operations import AccessLog, Announcement, Device
from app.services.access_control import AccessControl
from app.services.billing import InvoiceService
from app.services.devices import DeviceService
from app.services.locations import Schedule
from app.services.pricing import PricingService

PASSWORD = os.getenv("SEED_PASSWORD", "CakraSpace2026")
TZ = "Asia/Jakarta"

FASILITAS_GEDUNG = ["WiFi", "Pantry", "Parkir", "Loker Umum", "Musala", "Printer"]
FASILITAS_AREA = ["Colokan Listrik", "Loker", "Proyektor", "Whiteboard", "TV", "Sound System", "AC", "Lampu Baca"]

# gedung dan area mengikuti mock data FE supaya nama di layar sama
GEDUNG = [
    {"code": "SDR", "name": "Cakra Space Sudirman", "city": "Jakarta", "address": "Jl. Jend. Sudirman No. 1",
     "status": BuildingStatus.ACTIVE, "image_url": "https://placehold.co/400x200?text=Sudirman",
     "lantai": ["Lantai 1", "Lantai 2"],
     "area": [
         (1, "A1", "Hot Desk A1", AreaType.HOT_DESK, 1, 25_000, 150_000, ["Colokan Listrik"]),
         (1, "A2", "Hot Desk A2", AreaType.HOT_DESK, 1, 25_000, 150_000, ["Colokan Listrik"]),
         (1, "A3", "Hot Desk A3", AreaType.HOT_DESK, 1, 25_000, 150_000, ["Colokan Listrik", "Lampu Baca"]),
         (1, "A4", "Hot Desk A4", AreaType.HOT_DESK, 1, 25_000, 150_000, ["Colokan Listrik", "Lampu Baca"]),
         (2, "B1", "Dedicated Desk B1", AreaType.DEDICATED_DESK, 1, 35_000, 200_000, ["Colokan Listrik", "Loker"]),
         (2, "B2", "Dedicated Desk B2", AreaType.DEDICATED_DESK, 1, 35_000, 200_000, ["Colokan Listrik", "Loker"]),
         (2, "M1", "Meeting Room Merdeka", AreaType.MEETING_ROOM, 8, 150_000, 900_000,
          ["Proyektor", "Whiteboard", "AC"]),
         (2, "M2", "Meeting Room Nusantara", AreaType.MEETING_ROOM, 12, 250_000, 1_500_000,
          ["TV", "Whiteboard", "AC", "Sound System"]),
     ]},
    {"code": "DGO", "name": "Cakra Space Dago", "city": "Bandung", "address": "Jl. Ir. H. Juanda No. 2",
     "status": BuildingStatus.ACTIVE, "image_url": "https://placehold.co/400x200?text=Dago",
     "lantai": ["Lantai 1", "Lantai 2"],
     "area": [
         (1, "A1", "Hot Desk A1", AreaType.HOT_DESK, 1, 20_000, 120_000, ["Colokan Listrik"]),
         (1, "A2", "Hot Desk A2", AreaType.HOT_DESK, 1, 20_000, 120_000, ["Colokan Listrik"]),
         (1, "A3", "Hot Desk A3", AreaType.HOT_DESK, 1, 20_000, 120_000, ["Colokan Listrik"]),
         (1, "B1", "Dedicated Desk B1", AreaType.DEDICATED_DESK, 1, 35_000, 200_000,
          ["Loker", "Colokan Listrik"]),
         (1, "B2", "Dedicated Desk B2", AreaType.DEDICATED_DESK, 1, 35_000, 200_000,
          ["Loker", "Colokan Listrik"]),
         (2, "M1", "Meeting Room Tangkuban", AreaType.MEETING_ROOM, 6, 120_000, 700_000, ["Proyektor", "AC"]),
         (2, "M2", "Meeting Room Braga", AreaType.MEETING_ROOM, 4, 90_000, 500_000, ["TV", "Whiteboard", "AC"]),
     ]},
    {"code": "DPN", "name": "Cakra Space Diponegoro", "city": "Surabaya", "address": "Jl. Diponegoro No. 3",
     "status": BuildingStatus.DRAFT, "image_url": "https://placehold.co/400x200?text=Diponegoro",
     "lantai": ["Lantai 1"],
     "area": [
         (1, "A1", "Hot Desk A1", AreaType.HOT_DESK, 1, 20_000, 120_000, ["Colokan Listrik"]),
         (1, "A2", "Hot Desk A2", AreaType.HOT_DESK, 1, 20_000, 120_000, ["Colokan Listrik"]),
         (1, "M1", "Meeting Room Suroboyo", AreaType.MEETING_ROOM, 6, 110_000, 650_000, ["Proyektor", "AC"]),
     ]},
    {"code": "MLB", "name": "Cakra Space Malioboro", "city": "Yogyakarta", "address": "Jl. Malioboro No. 4",
     "status": BuildingStatus.ACTIVE, "image_url": "https://placehold.co/400x200?text=Malioboro",
     "lantai": ["Lantai 1", "Lantai 2"],
     "area": [
         (1, "A1", "Hot Desk A1", AreaType.HOT_DESK, 1, 20_000, 110_000, ["Colokan Listrik"]),
         (1, "A2", "Hot Desk A2", AreaType.HOT_DESK, 1, 20_000, 110_000, ["Colokan Listrik"]),
         (1, "A3", "Hot Desk A3", AreaType.HOT_DESK, 1, 20_000, 110_000, ["Colokan Listrik"]),
         (2, "M1", "Meeting Room Prambanan", AreaType.MEETING_ROOM, 8, 130_000, 750_000,
          ["Proyektor", "Whiteboard", "AC"]),
         (2, "M2", "Meeting Room Kaliurang", AreaType.MEETING_ROOM, 4, 80_000, 450_000, ["TV", "AC"]),
     ]},
]

STAF = [
    ("admin@cakraspace.id", "Admin Pusat", Role.CENTRAL_MANAGER, []),
    ("lokasi.sudirman@cakraspace.id", "Pengelola Sudirman", Role.LOCATION_MANAGER, ["SDR"]),
    ("lokasi.dago@cakraspace.id", "Pengelola Dago", Role.LOCATION_MANAGER, ["DGO"]),
    ("lokasi.jogja@cakraspace.id", "Pengelola Malioboro", Role.LOCATION_MANAGER, ["MLB", "DPN"]),
    ("resepsionis.dago@cakraspace.id", "Resepsionis Dago", Role.RECEPTIONIST, ["DGO"]),
]

MEMBER = [
    ("budi@example.com", "Budi Santoso", "PT Maju Bersama", True),
    ("sinta@example.com", "Sinta Rahayu", "Studio Kreatif Sinta", True),
    ("dewi@example.com", "Dewi Lestari", None, True),
    ("raka@example.com", "Raka Pratama", None, False),
]

class Seeder:
    def __init__(self, store: JsonStore):
        self.store = store
        self.hasher = PasswordHasher()
        self.rng = random.Random(2026)
        self.now = clock.now()
        self.today = clock.local_today(TZ)
        self.device_keys: dict[str, str] = {}

    def run(self) -> dict:
        self.store.reset()
        with self.store.write() as tx:
            AccessControl().ensure_defaults(tx)
            self.tx = tx
            self.hash_pw = self.hasher.hash(PASSWORD)
            self._facilities()
            self._buildings()
            self._users()
            self._plans_and_vouchers()
            self._membership()
            self._history()
            self._upcoming()
            self._operations()
            return {nama: len(tx.collection(nama)) for nama in ("buildings", "areas", "users", "bookings",
                                                                 "invoices", "plans", "vouchers", "access_logs")}

    # data induk

    def _facilities(self):
        self.fas = {}
        for nama in FASILITAS_GEDUNG:
            self.fas[nama] = self.tx.facilities.add(Facility(name=nama, scope=FacilityScope.BUILDING))
        for nama in FASILITAS_AREA:
            self.fas[nama] = self.tx.facilities.add(Facility(name=nama, scope=FacilityScope.AREA))

    def _buildings(self):
        self.gedung, self.area = {}, {}
        for g in GEDUNG:
            b = self.tx.buildings.add(Building(code=g["code"], name=g["name"], city=g["city"], address=g["address"],
                                               status=g["status"], image_url=g["image_url"], timezone=TZ,
                                               contact_phone="022-1234567",
                                               contact_email=f"{g['code'].lower()}@cakraspace.id"))
            self.gedung[g["code"]] = b
            self.tx.operating_hours.add_many(Schedule.default_hours(b.id))
            self.tx.holidays.add(Holiday(building_id=b.id, date=date(self.today.year, 12, 25),
                                         description="Hari Raya Natal"))
            for nama in FASILITAS_GEDUNG[: 4 + len(g["lantai"])]:
                self.tx.building_facilities.add(BuildingFacility(building_id=b.id, facility_id=self.fas[nama].id))
            lantai = [self.tx.floors.add(Floor(building_id=b.id, name=n, level=i + 1))
                      for i, n in enumerate(g["lantai"])]
            for urut, (lv, kode, nama, tipe, kap, per_jam, per_hari, fasilitas) in enumerate(g["area"]):
                area = self.tx.areas.add(Area(
                    building_id=b.id, floor_id=lantai[lv - 1].id, code=kode, name=nama, type=tipe, capacity=kap,
                    price_per_hour=per_jam, price_per_day=per_hari,
                    pos_x=15 + (urut % 4) * 22, pos_y=25 + (urut // 4) * 40,
                ))
                self.tx.area_facilities.add_many(AreaFacility(area_id=area.id, facility_id=self.fas[f].id)
                                                 for f in fasilitas)
                self.area[(g["code"], kode)] = area

    def _users(self):
        self.user = {}
        for email, nama, peran, gedung in STAF:
            u = self.tx.users.add(User(email=email, name=nama, role=peran, is_verified=True,
                                       password_hash=self.hash_pw, phone="081200000000"))
            self.tx.user_buildings.add_many(UserBuilding(user_id=u.id, building_id=self.gedung[k].id) for k in gedung)
            self.user[email] = u
        for email, nama, perusahaan, terverifikasi in MEMBER:
            self.user[email] = self.tx.users.add(User(email=email, name=nama, company=perusahaan,
                                                      is_verified=terverifikasi, password_hash=self.hash_pw,
                                                      phone="0812" + str(self.rng.randint(10_000_000, 99_999_999))))

    def _plans_and_vouchers(self):
        self.plan = {}
        for nama, ket, hari, harga, gedung, jam in (
            ("Member Bulanan", "Akses hot desk semua gedung dan 10 jam ruang rapat per bulan", 30, 1_500_000, [], 10),
            ("Member Bulanan Plus", "Akses semua gedung dan 20 jam ruang rapat per bulan", 30, 2_500_000, [], 20),
            ("Dago Hemat", "Akses hot desk khusus Cakra Space Dago dan 5 jam ruang rapat", 30, 900_000, ["DGO"], 5),
        ):
            p = self.tx.plans.add(Plan(name=nama, description=ket, duration_days=hari, price=harga,
                                       building_ids=[self.gedung[k].id for k in gedung]))
            self.tx.plan_benefits.add(PlanBenefit(plan_id=p.id, benefit_type=BenefitType.MEETING_ROOM_HOURS,
                                                  quantity=jam))
            self.plan[nama] = p
        self.tx.vouchers.add(Voucher(code="CAKRA10", description="Diskon 10% maksimal Rp50.000",
                                     discount_type=DiscountType.PERCENT, discount_value=10, max_discount=50_000,
                                     quota=100, valid_from=self.today - timedelta(days=30),
                                     valid_until=self.today + timedelta(days=90)))
        self.tx.vouchers.add(Voucher(code="DAGOHEMAT", description="Potongan Rp25.000 khusus Dago",
                                     discount_type=DiscountType.AMOUNT, discount_value=25_000, quota=50,
                                     valid_from=self.today - timedelta(days=7),
                                     valid_until=self.today + timedelta(days=60),
                                     building_ids=[self.gedung["DGO"].id]))

    def _membership(self):
        budi = self.user["budi@example.com"]
        plan = self.plan["Member Bulanan"]
        mulai = self.today - timedelta(days=10)
        self.sub_budi = self.tx.subscriptions.add(Subscription(
            user_id=budi.id, plan_id=plan.id, status=SubscriptionStatus.ACTIVE, start_date=mulai,
            end_date=mulai + timedelta(days=plan.duration_days - 1)))
        dibayar = self._local(mulai, time(9))
        pay = self._payment(PaymentPurpose.SUBSCRIPTION, self.sub_budi.id, budi, plan.price, dibayar)
        self._invoice(pay, None, f"Membership {plan.name} (30 hari)", plan.price, 0, 0, dibayar)

    # riwayat booking 45 hari terakhir supaya laporan pendapatan dan okupansi berisi

    def _history(self):
        pelanggan = [self.user[e] for e in ("budi@example.com", "sinta@example.com", "dewi@example.com")]
        kunci = [k for k in self.area if k[0] != "DPN"]
        for hari_lalu in range(45, 0, -1):
            tanggal = self.today - timedelta(days=hari_lalu)
            if tanggal.weekday() == 6:
                continue
            for _ in range(self.rng.randint(1, 3)):
                gk, ak = self.rng.choice(kunci)
                jam = self.rng.choice([8, 9, 10, 13, 14, 15])
                durasi = self.rng.choice([1, 2, 3])
                self._confirmed(self.rng.choice(pelanggan), gk, ak, tanggal, jam, durasi, checkin=True)

    def _upcoming(self):
        budi, sinta = self.user["budi@example.com"], self.user["sinta@example.com"]
        self._confirmed(budi, "DGO", "A1", self.today + timedelta(days=2), 9, 3)
        # booking ruang rapat memakai kuota benefit membership
        rapat = self._confirmed(budi, "DGO", "M1", self.today + timedelta(days=3), 13, 2, benefit=True)
        self.tx.benefit_usages.add(BenefitUsage(subscription_id=self.sub_budi.id, booking_id=rapat.id,
                                                benefit_type=BenefitType.MEETING_ROOM_HOURS, minutes=120,
                                                period_start=self.sub_budi.start_date))
        self._confirmed(sinta, "SDR", "M1", self.today + timedelta(days=4), 10, 2)
        batal = self._confirmed(sinta, "SDR", "A2", self.today + timedelta(days=5), 9, 4)
        self.tx.bookings.update(batal.id, status=BookingStatus.CANCELLED, cancelled_at=self.now,
                                cancel_reason="Rencana kerja berubah")
        pay = self.tx.payments.first(purpose=PaymentPurpose.BOOKING, reference_id=batal.id)
        self.tx.refunds.add(Refund(booking_id=batal.id, payment_id=pay.id, user_id=sinta.id,
                                   building_id=batal.building_id, amount=pay.amount, percent=100,
                                   status=RefundStatus.REQUESTED, reason="Booking dibatalkan member"))

    def _operations(self):
        dago, budi, dewi = self.gedung["DGO"], self.user["budi@example.com"], self.user["dewi@example.com"]
        pengelola = self.user["lokasi.dago@cakraspace.id"]
        self.tx.announcements.add(Announcement(building_id=dago.id, title="Perawatan AC lantai 2",
                                               body="Sabtu pukul 09.00-12.00 ruang rapat lantai 2 tidak bisa dipakai.",
                                               created_by=pengelola.id))
        self.tx.deposits.add(Deposit(user_id=budi.id, building_id=dago.id, item="Kunci loker L-07", amount=50_000,
                                     recorded_by=pengelola.id))
        # tunggakan lewat jatuh tempo membuat member tidak bisa booking baru
        self.tx.arrears.add(Arrear(user_id=dewi.id, building_id=dago.id, description="Sewa dedicated desk Oktober",
                                   amount=150_000, due_date=self.today - timedelta(days=5)))
        for kode, nama, tipe, pintu in (("DGO", "Pembaca QR Pintu Utama", DeviceType.QR_READER, "Pintu Utama"),
                                        ("DGO", "Kunci Pintu Ruang Rapat", DeviceType.DOOR_LOCK, "Lantai 2"),
                                        ("SDR", "Pembaca QR Lobi", DeviceType.QR_READER, "Lobi")):
            prefix = secrets.token_hex(4)
            key = f"dev_{prefix}_{secrets.token_urlsafe(24)}"
            self.tx.devices.add(Device(building_id=self.gedung[kode].id, name=nama, type=tipe, door=pintu,
                                       key_prefix=prefix, key_hash=DeviceService._digest(key),
                                       last_heartbeat_at=self.now))
            self.device_keys[f"{kode} {nama}"] = key

    # pembantu

    def _local(self, tanggal: date, jam: time) -> datetime:
        return clock.combine(tanggal, jam, TZ)

    def _confirmed(self, user: User, gk: str, ak: str, tanggal: date, jam: int, durasi: int,
                   checkin: bool = False, benefit: bool = False) -> Booking:
        area, building = self.area[(gk, ak)], self.gedung[gk]
        mulai = self._local(tanggal, time(jam))
        selesai = mulai + timedelta(hours=durasi)
        if self.tx.bookings.exists(lambda b: b.overlaps(mulai, selesai), area_id=area.id):
            return self.tx.bookings.first(lambda b: b.overlaps(mulai, selesai), area_id=area.id)
        subtotal = PricingService.base_price(area, durasi * 60)
        potongan = subtotal if benefit else 0
        pajak = (subtotal - potongan) * 11 // 100
        total = subtotal - potongan + pajak
        booking = self.tx.bookings.add(Booking(
            code=f"CS{tanggal:%y%m%d}-{secrets.token_hex(2).upper()}", user_id=user.id, building_id=building.id,
            area_id=area.id, start_at=mulai, end_at=selesai, status=BookingStatus.CONFIRMED, subtotal=subtotal,
            benefit_discount=potongan, tax=pajak, total=total, benefit_minutes=durasi * 60 if benefit else 0,
            subscription_id=self.sub_budi.id if benefit else None,
            reminder_24_sent=mulai < self.now, reminder_1_sent=mulai < self.now,
            created_at=mulai - timedelta(days=self.rng.randint(1, 5)),
        ))
        if total:
            dibayar = min(booking.created_at + timedelta(minutes=5), self.now)
            pay = self._payment(PaymentPurpose.BOOKING, booking.id, user, total, dibayar)
            self._invoice(pay, building, f"Booking {booking.code} - {area.name}", subtotal, potongan, pajak, dibayar)
        if checkin and mulai < self.now:
            self.tx.access_logs.add(AccessLog(building_id=building.id, user_id=user.id, credential=Credential.MEMBER_QR,
                                              result=AccessResult.GRANTED, reason=f"Booking {booking.code}",
                                              door="Pintu Utama", scanned_at=mulai - timedelta(minutes=5)))
        return booking

    def _payment(self, purpose, ref_id: int, user: User, amount: int, paid_at: datetime) -> Payment:
        return self.tx.payments.add(Payment(
            purpose=purpose, reference_id=ref_id, user_id=user.id, amount=amount,
            method=self.rng.choice(list(PaymentMethod)), status=PaymentStatus.SUCCESS,
            gateway_ref="SBX-" + secrets.token_hex(6).upper(), expires_at=paid_at + timedelta(minutes=15),
            paid_at=paid_at, created_at=paid_at - timedelta(minutes=3)))

    def _invoice(self, pay: Payment, building: Building | None, ket: str, subtotal: int, diskon: int, pajak: int,
                 paid_at: datetime) -> Invoice:
        return self.tx.invoices.add(Invoice(
            number=InvoiceService.next_number(self.tx, building.code if building else "CS", paid_at),
            building_id=building.id if building else None, user_id=pay.user_id, payment_id=pay.id,
            purpose=pay.purpose, reference_id=pay.reference_id, description=ket, subtotal=subtotal,
            discount=diskon, tax=pajak, total=pay.amount, status=InvoiceStatus.PAID, paid_at=paid_at,
            emailed_at=paid_at, created_at=paid_at))

def main() -> None:
    settings = get_settings()
    seeder = Seeder(JsonStore(settings.data_file))
    jumlah = seeder.run()
    print(f"Data contoh ditulis ke {settings.data_file}")
    print("Jumlah:", ", ".join(f"{k} {v}" for k, v in jumlah.items()))
    print(f"Password semua akun demo: {PASSWORD}")
    for email, _nama, peran, _ in STAF:
        print(f"  {peran:<17} {email}")
    for email, *_ in MEMBER:
        print(f"  {'member':<17} {email}")
    print("API key perangkat (hanya tampil sekali):")
    for nama, key in seeder.device_keys.items():
        print(f"  {nama}: {key}")

if __name__ == "__main__":
    main()
