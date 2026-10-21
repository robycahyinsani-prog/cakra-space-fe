from app.db.repository import AppendOnlyRepository, Repository
from app.models.account import EmailToken, Permission, RevokedToken, RoleDef, RolePermission, User, UserBuilding
from app.models.billing import (
    Arrear,
    Deposit,
    Invoice,
    InvoiceCounter,
    Payment,
    PaymentEvent,
    Refund,
    Setting,
    Voucher,
)
from app.models.booking import Booking, GuestInvite
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
from app.models.membership import BenefitUsage, Plan, PlanBenefit, Subscription
from app.models.operations import (
    AccessLog,
    Announcement,
    AuditLog,
    Device,
    DeviceCommand,
    DeviceMaintenance,
    Notification,
    ReportExport,
)

# nama koleksi di berkas JSON, model, label untuk pesan error, dan kelas repository
REGISTRY = {
    "users": (User, "User", Repository),
    "user_buildings": (UserBuilding, "Penugasan gedung", Repository),
    "roles": (RoleDef, "Peran", Repository),
    "permissions": (Permission, "Hak akses", Repository),
    "role_permissions": (RolePermission, "Hak akses peran", Repository),
    "email_tokens": (EmailToken, "Token", Repository),
    "revoked_tokens": (RevokedToken, "Token", Repository),
    "buildings": (Building, "Gedung", Repository),
    "operating_hours": (OperatingHour, "Jam operasional", Repository),
    "holidays": (Holiday, "Hari libur", Repository),
    "floors": (Floor, "Lantai", Repository),
    "facilities": (Facility, "Fasilitas", Repository),
    "building_facilities": (BuildingFacility, "Fasilitas gedung", Repository),
    "areas": (Area, "Area", Repository),
    "area_facilities": (AreaFacility, "Fasilitas area", Repository),
    "bookings": (Booking, "Booking", Repository),
    "guest_invites": (GuestInvite, "Undangan tamu", Repository),
    "payments": (Payment, "Pembayaran", Repository),
    "payment_events": (PaymentEvent, "Log transaksi", AppendOnlyRepository),
    "invoices": (Invoice, "Invoice", Repository),
    "invoice_counters": (InvoiceCounter, "Nomor invoice", Repository),
    "refunds": (Refund, "Refund", Repository),
    "deposits": (Deposit, "Deposit", Repository),
    "arrears": (Arrear, "Tunggakan", Repository),
    "vouchers": (Voucher, "Voucher", Repository),
    "settings": (Setting, "Pengaturan", Repository),
    "access_logs": (AccessLog, "Log akses", AppendOnlyRepository),
    "plans": (Plan, "Paket", Repository),
    "plan_benefits": (PlanBenefit, "Benefit paket", Repository),
    "subscriptions": (Subscription, "Langganan", Repository),
    "benefit_usages": (BenefitUsage, "Pemakaian benefit", Repository),
    "announcements": (Announcement, "Pengumuman", Repository),
    "notifications": (Notification, "Notifikasi", Repository),
    "audit_logs": (AuditLog, "Audit log", AppendOnlyRepository),
    "report_exports": (ReportExport, "Ekspor laporan", Repository),
    "devices": (Device, "Perangkat", Repository),
    "device_commands": (DeviceCommand, "Perintah perangkat", Repository),
    "device_maintenances": (DeviceMaintenance, "Riwayat maintenance", Repository),
}

class Tables:
    """Satu transaksi atas berkas JSON, berisi satu repository per koleksi."""

    users: Repository[User]
    user_buildings: Repository[UserBuilding]
    roles: Repository[RoleDef]
    permissions: Repository[Permission]
    role_permissions: Repository[RolePermission]
    email_tokens: Repository[EmailToken]
    revoked_tokens: Repository[RevokedToken]
    buildings: Repository[Building]
    operating_hours: Repository[OperatingHour]
    holidays: Repository[Holiday]
    floors: Repository[Floor]
    facilities: Repository[Facility]
    building_facilities: Repository[BuildingFacility]
    areas: Repository[Area]
    area_facilities: Repository[AreaFacility]
    bookings: Repository[Booking]
    guest_invites: Repository[GuestInvite]
    payments: Repository[Payment]
    payment_events: AppendOnlyRepository[PaymentEvent]
    invoices: Repository[Invoice]
    invoice_counters: Repository[InvoiceCounter]
    refunds: Repository[Refund]
    deposits: Repository[Deposit]
    arrears: Repository[Arrear]
    vouchers: Repository[Voucher]
    settings: Repository[Setting]
    access_logs: AppendOnlyRepository[AccessLog]
    plans: Repository[Plan]
    plan_benefits: Repository[PlanBenefit]
    subscriptions: Repository[Subscription]
    benefit_usages: Repository[BenefitUsage]
    announcements: Repository[Announcement]
    notifications: Repository[Notification]
    audit_logs: AppendOnlyRepository[AuditLog]
    report_exports: Repository[ReportExport]
    devices: Repository[Device]
    device_commands: Repository[DeviceCommand]
    device_maintenances: Repository[DeviceMaintenance]

    def __init__(self, data: dict, writable: bool):
        self._data = data
        self.writable = writable
        self.dirty = False
        for name, (model, label, repo_cls) in REGISTRY.items():
            setattr(self, name, repo_cls(self, name, model, label))

    def collection(self, name: str) -> list[dict]:
        if name not in self._data:
            if not self.writable:
                return []
            self._data[name] = []
        return self._data[name]

    def next_id(self, name: str) -> int:
        seq = self._data.setdefault("_seq", {})
        seq[name] = seq.get(name, 0) + 1
        return seq[name]
