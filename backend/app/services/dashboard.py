from datetime import timedelta

from app.core.clock import clock
from app.core.config import Settings
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.models.account import User
from app.models.enums import BookingStatus, BuildingStatus, InvoiceStatus
from app.models.operations import Announcement
from app.services.access_control import AccessControl
from app.services.finance import FinanceService
from app.services.locations import BookingRules
from app.services.membership import MembershipService

class AnnouncementService:
    """Pengumuman gedung dari pengelola lokasi (BE-43)."""

    def __init__(self, store: JsonStore, acl: AccessControl):
        self.store = store
        self.acl = acl

    def create(self, actor: User, building_id: int, title: str, body: str) -> Announcement:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "announcements.manage", building_id)
            tx.buildings.require(building_id)
            return tx.announcements.add(Announcement(building_id=building_id, title=title, body=body,
                                                     created_by=actor.id))

    def delete(self, actor: User, announcement_id: int) -> None:
        with self.store.write() as tx:
            item = tx.announcements.require(announcement_id)
            self.acl.require_building(tx, actor, "announcements.manage", item.building_id)
            tx.announcements.delete(announcement_id)

    def list_for_staff(self, actor: User, building_id: int | None) -> list[Announcement]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "announcements.manage")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            items = tx.announcements.where(lambda a: gedung is None or a.building_id in gedung)
        return sorted(items, key=lambda a: a.id, reverse=True)

    def feed(self, tx: Tables, user: User, membership: MembershipService) -> list[dict]:
        """Pengumuman tampil sesuai gedung tempat member punya booking atau membership (AC K5-US-008.4)."""
        gedung = {b.building_id for b in tx.bookings.where(
            lambda b: b.end_at >= clock.now() - timedelta(days=90), user_id=user.id)}
        sub = membership.current(tx, user.id)
        if sub and sub.is_usable_on(membership.today()):
            plan = tx.plans.require(sub.plan_id)
            semua = {b.id for b in tx.buildings.where(status=BuildingStatus.ACTIVE)}
            gedung |= set(plan.building_ids) if plan.building_ids else semua
        hasil = []
        for a in sorted(tx.announcements.where(lambda a: a.building_id in gedung), key=lambda a: a.id, reverse=True):
            building = tx.buildings.get(a.building_id)
            hasil.append({**a.model_dump(), "building_name": building.name if building else None})
        return hasil

class MemberDashboard:
    """Ringkasan halaman awal member (BE-40)."""

    def __init__(self, store: JsonStore, settings: Settings, membership: MembershipService,
                 announcements: AnnouncementService):
        self.store = store
        self.settings = settings
        self.membership = membership
        self.announcements = announcements

    def summary(self, user: User) -> dict:
        now = clock.now()
        with self.store.read() as tx:
            langganan = self.membership.view(tx, user.id)
            mendatang = sorted((b for b in tx.bookings.where(user_id=user.id)
                                if BookingRules.holds_slot(b, now) and b.end_at > now), key=lambda b: b.start_at)
            berikut = mendatang[0] if mendatang else None
            area = tx.areas.get(berikut.area_id) if berikut else None
            belum_bayar = tx.invoices.count(status=InvoiceStatus.UNPAID, user_id=user.id)
            return {
                "user": {"id": user.id, "name": user.name, "email": user.email, "is_verified": user.is_verified},
                "membership_status": langganan["status"],
                "membership": langganan,
                "upcoming_bookings": len(mendatang),
                "pending_payment_bookings": sum(1 for b in mendatang if b.status == BookingStatus.PENDING_PAYMENT),
                "next_booking": {"id": berikut.id, "code": berikut.code, "start_at": berikut.start_at,
                                 "end_at": berikut.end_at, "area_name": area.name if area else None,
                                 "status": berikut.status} if berikut else None,
                "unpaid_invoices": belum_bayar,
                "has_overdue_arrears": FinanceService.has_overdue(
                    tx, user.id, clock.local_today(self.settings.timezone)),
                "announcements": self.announcements.feed(tx, user, self.membership)[:5],
            }

    def announcements_feed(self, user: User) -> list[dict]:
        with self.store.read() as tx:
            return self.announcements.feed(tx, user, self.membership)
