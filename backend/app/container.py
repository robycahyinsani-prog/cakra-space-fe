from app.core.config import Settings
from app.core.security import PasswordHasher, TokenService
from app.db.json_store import JsonStore
from app.integrations.mailer import Mailer
from app.integrations.payment_gateway import SandboxGateway
from app.services.access import AccessService
from app.services.access_control import AccessControl
from app.services.accounts import ProfileService, StaffService
from app.services.audit import AuditLogger
from app.services.auth import AuthService
from app.services.billing import InvoiceService, PaymentService, RefundService
from app.services.booking import AvailabilityService, BookingService
from app.services.dashboard import AnnouncementService, MemberDashboard
from app.services.devices import DeviceService
from app.services.finance import FinanceService, SettingService, VoucherService
from app.services.jobs import JobRunner
from app.services.locations import AreaService, BuildingService
from app.services.membership import MembershipService
from app.services.pricing import PricingService
from app.services.reports import ExportService, ReportService


class Container:
    """Merangkai semua layanan satu kali saat aplikasi dibuat."""

    def __init__(self, settings: Settings, store: JsonStore | None = None):
        self.settings = settings
        self.store = store or JsonStore(settings.data_file)
        self.acl = AccessControl()
        self.audit = AuditLogger()
        self.mailer = Mailer()
        self.hasher = PasswordHasher()
        self.tokens = TokenService(settings.secret_key, settings.token_minutes)
        self.gateway = SandboxGateway(settings.webhook_secret, settings.frontend_url)
        s, st, acl, audit, mail = settings, self.store, self.acl, self.audit, self.mailer

        self.auth = AuthService(st, s, mail, self.hasher, self.tokens)
        self.staff = StaffService(st, acl, audit, self.hasher)
        self.profile = ProfileService(st, self.staff)
        self.buildings = BuildingService(st, acl, audit, s.upload_dir)
        self.areas = AreaService(st, acl, audit, self.buildings)
        self.settings_service = SettingService(st, acl, audit)
        self.vouchers = VoucherService(st, acl, audit)
        self.finance = FinanceService(st, acl, audit, s.timezone)
        self.membership = MembershipService(st, acl, audit, mail, s.timezone, s.renew_window_days, s.max_freeze_days)
        self.pricing = PricingService(self.membership)
        self.availability = AvailabilityService(st, self.buildings, s)
        self.refunds = RefundService(st, acl, audit, mail, self.gateway)
        self.bookings = BookingService(
            st, s, acl, audit, mail, self.buildings, self.pricing, self.membership, self.refunds
        )
        self.invoices = InvoiceService(st, acl, mail, s)
        self.payments = PaymentService(
            st, s, self.gateway, self.invoices, self.refunds, self.bookings, self.membership, audit
        )
        self.access = AccessService(st, s, acl, mail, self.membership)
        self.announcements = AnnouncementService(st, acl)
        self.dashboard = MemberDashboard(st, s, self.membership, self.announcements)
        self.reports = ReportService(st, s, acl)
        self.exports = ExportService(st, s, acl, self.reports, self.access, mail)
        self.devices = DeviceService(st, s, acl, audit, mail)
        self.jobs = JobRunner(st, self.bookings, self.payments, self.membership, self.devices)

    def bootstrap(self) -> None:
        with self.store.write() as tx:
            self.acl.ensure_defaults(tx)
