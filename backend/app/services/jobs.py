from app.core.clock import clock
from app.db.json_store import JsonStore
from app.services.billing import PaymentService
from app.services.booking import BookingService
from app.services.devices import DeviceService
from app.services.membership import MembershipService


class JobRunner:
    """Tugas terjadwal: hold booking (BE-17), pengingat (BE-20), membership (BE-39), perangkat offline (BE-49).

    Dijalankan lewat `python -m app.jobs` atau endpoint internal yang dipanggil cron.
    """

    def __init__(
        self,
        store: JsonStore,
        bookings: BookingService,
        payments: PaymentService,
        membership: MembershipService,
        devices: DeviceService,
    ):
        self.store = store
        self.bookings = bookings
        self.payments = payments
        self.membership = membership
        self.devices = devices

    def run_all(self) -> dict:
        with self.store.write() as tx:
            hasil = {
                "ran_at": clock.now().isoformat(),
                "expired_bookings": self.bookings.expire_holds(tx),
                "expired_payments": self.payments.expire_stale(tx),
                "booking_reminders": self.bookings.send_reminders(tx),
                "membership": self.membership.daily(tx),
                "offline_devices": self.devices.detect_offline(tx),
            }
            # token logout yang sudah lewat masa berlakunya tidak perlu disimpan lagi
            for t in tx.revoked_tokens.where(lambda t: t.expires_at < clock.now()):
                tx.revoked_tokens.delete(t.id)
            return hasil
