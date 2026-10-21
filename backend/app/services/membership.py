from datetime import date, timedelta

from app.core.clock import clock
from app.core.errors import Conflict, Invalid, NotFound
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.integrations.mailer import Mailer
from app.models.account import User
from app.models.booking import Booking
from app.models.enums import BenefitType, SubscriptionStatus
from app.models.membership import BenefitUsage, Plan, PlanBenefit, Subscription
from app.services.access_control import AccessControl
from app.services.audit import AuditLogger
from app.services.finance import FinanceService

PERIOD_DAYS = 30  # kuota benefit dihitung per 30 hari sejak tanggal mulai langganan


class MembershipService:
    def __init__(
        self,
        store: JsonStore,
        acl: AccessControl,
        audit: AuditLogger,
        mailer: Mailer,
        tz: str,
        renew_window_days: int,
        max_freeze_days: int,
    ):
        self.store = store
        self.acl = acl
        self.audit = audit
        self.mailer = mailer
        self.tz = tz
        self.renew_window_days = renew_window_days
        self.max_freeze_days = max_freeze_days

    def today(self) -> date:
        return clock.local_today(self.tz)

    # paket membership (BE-34)

    def list_plans(self, include_archived: bool = False, building_id: int | None = None) -> list[dict]:
        with self.store.read() as tx:
            plans = [p for p in tx.plans.all() if include_archived or not p.is_archived]
            if building_id:
                plans = [p for p in plans if p.covers(building_id)]
            return [self.plan_view(tx, p) for p in sorted(plans, key=lambda p: p.price)]

    def get_plan(self, plan_id: int) -> dict:
        with self.store.read() as tx:
            return self.plan_view(tx, tx.plans.require(plan_id))

    @staticmethod
    def plan_view(tx: Tables, plan: Plan) -> dict:
        benefit = [
            {"benefit_type": b.benefit_type, "quantity": b.quantity} for b in tx.plan_benefits.where(plan_id=plan.id)
        ]
        return {**plan.model_dump(), "benefits": benefit, "subscriber_count": tx.subscriptions.count(plan_id=plan.id)}

    def create_plan(self, actor: User, data: dict, benefits: list[dict]) -> dict:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "plans.manage")
            for bid in data.get("building_ids", []):
                tx.buildings.require(bid)
            plan = tx.plans.add(Plan(**data))
            tx.plan_benefits.add_many(PlanBenefit(plan_id=plan.id, **b) for b in benefits)
            self.audit.record(tx, actor.id, "plan.create", "plan", plan.id)
            return self.plan_view(tx, plan)

    def update_plan(self, actor: User, plan_id: int, changes: dict, benefits: list[dict] | None) -> dict:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "plans.manage")
            plan = tx.plans.update(plan_id, **changes)
            if benefits is not None:
                tx.plan_benefits.delete_where(plan_id=plan_id)
                tx.plan_benefits.add_many(PlanBenefit(plan_id=plan_id, **b) for b in benefits)
            self.audit.record(tx, actor.id, "plan.update", "plan", plan_id)
            return self.plan_view(tx, plan)

    def remove_plan(self, actor: User, plan_id: int) -> dict:
        """Paket yang sudah punya pelanggan hanya diarsipkan, bukan dihapus (AC K5-US-007.1)."""
        with self.store.write() as tx:
            self.acl.require(tx, actor, "plans.manage")
            tx.plans.require(plan_id)
            if tx.subscriptions.exists(plan_id=plan_id):
                tx.plans.update(plan_id, is_archived=True)
                self.audit.record(tx, actor.id, "plan.archive", "plan", plan_id)
                return {"archived": True, "deleted": False}
            tx.plan_benefits.delete_where(plan_id=plan_id)
            tx.plans.delete(plan_id)
            self.audit.record(tx, actor.id, "plan.delete", "plan", plan_id)
            return {"archived": False, "deleted": True}

    # berlangganan (BE-35)

    def subscribe(self, user: User, plan_id: int) -> Subscription:
        with self.store.write() as tx:
            plan = tx.plans.require(plan_id)
            if plan.is_archived:
                raise Invalid("Paket ini sudah tidak dijual")
            if FinanceService.has_overdue(tx, user.id, self.today()):
                raise Conflict("Lunasi tunggakan terlebih dahulu sebelum berlangganan")
            berjalan = self.current(tx, user.id)
            if berjalan and berjalan.status != SubscriptionStatus.PENDING_PAYMENT:
                raise Conflict("Anda masih punya langganan aktif, gunakan perpanjang atau ganti paket")
            if berjalan:
                # langganan tertunda yang belum dibayar diganti dengan pilihan baru
                tx.subscriptions.update(berjalan.id, status=SubscriptionStatus.CANCELLED)
            return tx.subscriptions.add(Subscription(user_id=user.id, plan_id=plan_id))

    def activate(self, tx: Tables, sub: Subscription) -> Subscription:
        plan = tx.plans.require(sub.plan_id)
        mulai = self.today()
        sub = tx.subscriptions.update(
            sub.id,
            status=SubscriptionStatus.ACTIVE,
            start_date=mulai,
            end_date=mulai + timedelta(days=plan.duration_days - 1),
        )
        self._notify(
            tx,
            sub,
            f"Membership {plan.name} aktif",
            f"Membership {plan.name} aktif sampai {sub.end_date:%d-%m-%Y}.",
            "membership_active",
        )
        return sub

    # perpanjang, upgrade dan downgrade (BE-36)

    def renewal_quote(self, user: User) -> tuple[Subscription, Plan]:
        with self.store.read() as tx:
            sub = self._require_active(tx, user)
            sisa = (sub.end_date - self.today()).days
            if sisa > self.renew_window_days:
                raise Conflict(
                    f"Perpanjangan bisa dibayar paling cepat {self.renew_window_days} hari sebelum masa berlaku habis"
                )
            plan = tx.plans.require(sub.scheduled_plan_id or sub.plan_id)
            return sub, plan

    def apply_renewal(self, tx: Tables, sub: Subscription) -> Subscription:
        plan = tx.plans.require(sub.scheduled_plan_id or sub.plan_id)
        dasar = max(sub.end_date, self.today() - timedelta(days=1))
        sub = tx.subscriptions.update(
            sub.id,
            plan_id=plan.id,
            scheduled_plan_id=None,
            status=SubscriptionStatus.ACTIVE,
            deactivated_at=None,
            end_date=dasar + timedelta(days=plan.duration_days),
            reminder_7_sent=False,
            reminder_1_sent=False,
        )
        self._notify(
            tx,
            sub,
            "Membership diperpanjang",
            f"Membership {plan.name} berlaku sampai {sub.end_date:%d-%m-%Y}.",
            "membership_renewed",
        )
        return sub

    def change_plan(self, user: User, plan_id: int) -> dict:
        """Upgrade berlaku langsung dengan selisih prorata, downgrade berlaku periode berikutnya."""
        with self.store.write() as tx:
            sub = self._require_active(tx, user)
            lama = tx.plans.require(sub.plan_id)
            baru = tx.plans.require(plan_id)
            if baru.is_archived:
                raise Invalid("Paket ini sudah tidak dijual")
            if baru.id == lama.id:
                raise Invalid("Paket tujuan sama dengan paket sekarang")
            if baru.price > lama.price:
                sisa_hari = (sub.end_date - self.today()).days + 1
                selisih = (baru.price - lama.price) * sisa_hari // lama.duration_days
                return {
                    "kind": "upgrade",
                    "subscription": sub,
                    "plan": baru,
                    "prorata_amount": max(selisih, 0),
                    "remaining_days": sisa_hari,
                }
            sub = tx.subscriptions.update(sub.id, scheduled_plan_id=baru.id)
            self.audit.record(tx, user.id, "subscription.downgrade", "subscription", sub.id, plan_id=baru.id)
            return {
                "kind": "downgrade",
                "subscription": sub,
                "plan": baru,
                "prorata_amount": 0,
                "effective_date": sub.end_date + timedelta(days=1),
            }

    def apply_upgrade(self, tx: Tables, sub: Subscription, plan_id: int) -> Subscription:
        plan = tx.plans.require(plan_id)
        sub = tx.subscriptions.update(sub.id, plan_id=plan_id, scheduled_plan_id=None)
        self._notify(
            tx, sub, "Paket membership berhasil di-upgrade", f"Paket Anda sekarang {plan.name}.", "membership_upgraded"
        )
        return sub

    # freeze (BE-38)

    def freeze(self, user: User, start: date, days: int) -> Subscription:
        with self.store.write() as tx:
            sub = self._require_active(tx, user)
            today = self.today()
            if start < today:
                raise Invalid("Tanggal mulai freeze tidak boleh di masa lalu")
            if sub.freeze_until and sub.freeze_until >= today:
                raise Conflict("Masih ada freeze yang berjalan atau terjadwal")
            if start > sub.end_date:
                raise Invalid("Tanggal mulai freeze melewati masa berlaku")
            if sub.freeze_days_used + days > self.max_freeze_days:
                sisa = self.max_freeze_days - sub.freeze_days_used
                raise Invalid(f"Freeze paling lama {self.max_freeze_days} hari per periode, sisa {sisa} hari")
            sub = tx.subscriptions.update(
                sub.id,
                freeze_from=start,
                freeze_until=start + timedelta(days=days - 1),
                freeze_days_used=sub.freeze_days_used + days,
                end_date=sub.end_date + timedelta(days=days),
            )
            self.audit.record(tx, user.id, "subscription.freeze", "subscription", sub.id, days=days)
            return sub

    def unfreeze(self, user: User) -> Subscription:
        with self.store.write() as tx:
            sub = self._require_active(tx, user)
            today = self.today()
            if not sub.freeze_until or sub.freeze_until < today:
                raise Conflict("Tidak ada freeze yang berjalan")
            mulai_sisa = max(today, sub.freeze_from)
            sisa = (sub.freeze_until - mulai_sisa).days + 1
            akhir_freeze = today - timedelta(days=1)
            return tx.subscriptions.update(
                sub.id,
                freeze_until=akhir_freeze if sub.freeze_from <= akhir_freeze else None,
                freeze_from=sub.freeze_from if sub.freeze_from <= akhir_freeze else None,
                freeze_days_used=sub.freeze_days_used - sisa,
                end_date=sub.end_date - timedelta(days=sisa),
            )

    # kuota benefit (BE-37)

    @staticmethod
    def period_start(sub: Subscription, day: date) -> date:
        return sub.start_date + timedelta(days=((day - sub.start_date).days // PERIOD_DAYS) * PERIOD_DAYS)

    def benefit_status(self, tx: Tables, sub: Subscription, day: date) -> list[dict]:
        awal = self.period_start(sub, day)
        hasil = []
        for b in tx.plan_benefits.where(plan_id=sub.plan_id):
            terpakai = sum(
                u.minutes
                for u in tx.benefit_usages.where(
                    lambda u: u.reversed_at is None and u.period_start == awal,
                    subscription_id=sub.id,
                    benefit_type=b.benefit_type,
                )
            )
            kuota = b.quantity * 60
            hasil.append(
                {
                    "benefit_type": b.benefit_type,
                    "quota_minutes": kuota,
                    "used_minutes": terpakai,
                    "remaining_minutes": max(kuota - terpakai, 0),
                    "period_start": awal,
                    "period_end": min(awal + timedelta(days=PERIOD_DAYS - 1), sub.end_date),
                }
            )
        return hasil

    def meeting_room_benefit(
        self, tx: Tables, user_id: int, building_id: int, day: date
    ) -> tuple[Subscription, int] | None:
        sub = self.current(tx, user_id)
        if sub is None or not sub.is_usable_on(day):
            return None
        if not tx.plans.require(sub.plan_id).covers(building_id):
            return None
        for b in self.benefit_status(tx, sub, day):
            if b["benefit_type"] == BenefitType.MEETING_ROOM_HOURS and b["remaining_minutes"] > 0:
                return sub, b["remaining_minutes"]
        return None

    def consume(self, tx: Tables, sub: Subscription, booking: Booking, minutes: int, day: date) -> None:
        tx.benefit_usages.add(
            BenefitUsage(
                subscription_id=sub.id,
                booking_id=booking.id,
                benefit_type=BenefitType.MEETING_ROOM_HOURS,
                minutes=minutes,
                period_start=self.period_start(sub, day),
            )
        )

    @staticmethod
    def reverse(tx: Tables, booking_id: int) -> None:
        # booking yang dibatalkan mengembalikan kuota (AC K5-US-007.4)
        for u in tx.benefit_usages.where(lambda u: u.reversed_at is None, booking_id=booking_id):
            tx.benefit_usages.update(u.id, reversed_at=clock.now())

    # tampilan langganan untuk member

    def my_subscription(self, user: User) -> dict:
        with self.store.read() as tx:
            return self.view(tx, user.id)

    def view(self, tx: Tables, user_id: int) -> dict:
        sub = self.current(tx, user_id)
        today = self.today()
        if sub is None:
            return {"status": "not_subscribed", "subscription": None}
        plan = tx.plans.require(sub.plan_id)
        status = self.status_label(sub, today)
        data = {
            "status": status,
            "subscription": sub,
            "plan": self.plan_view(tx, plan),
            "scheduled_plan": tx.plans.get(sub.scheduled_plan_id),
            "benefits": [],
        }
        if sub.start_date and status in ("active", "frozen"):
            data["benefits"] = self.benefit_status(tx, sub, today)
            data["days_left"] = (sub.end_date - today).days
            data["can_renew"] = data["days_left"] <= self.renew_window_days
            data["freeze_days_left"] = self.max_freeze_days - sub.freeze_days_used
        return data

    @staticmethod
    def status_label(sub: Subscription, today: date) -> str:
        if sub.status == SubscriptionStatus.PENDING_PAYMENT:
            return "pending_payment"
        if sub.status != SubscriptionStatus.ACTIVE or (sub.end_date and sub.end_date < today):
            return "inactive"
        return "frozen" if sub.is_frozen_on(today) else "active"

    @staticmethod
    def current(tx: Tables, user_id: int) -> Subscription | None:
        """Langganan terbaru member yang belum dibatalkan."""
        subs = tx.subscriptions.where(lambda s: s.status != SubscriptionStatus.CANCELLED, user_id=user_id)
        return max(subs, key=lambda s: s.id) if subs else None

    def _require_active(self, tx: Tables, user: User) -> Subscription:
        sub = self.current(tx, user.id)
        if sub is None or self.status_label(sub, self.today()) not in ("active", "frozen"):
            raise NotFound("Anda belum punya membership aktif")
        return sub

    # penonaktifan otomatis dan pengingat (BE-39), dipanggil JobRunner

    def daily(self, tx: Tables) -> dict:
        today = self.today()
        hasil = {"deactivated": 0, "reminders": 0}
        for sub in tx.subscriptions.where(status=SubscriptionStatus.ACTIVE):
            plan = tx.plans.get(sub.plan_id)
            nama = plan.name if plan else "membership"
            if sub.end_date < today:
                self._deactivate(tx, sub, f"Membership {nama} sudah berakhir pada {sub.end_date:%d-%m-%Y}.")
                hasil["deactivated"] += 1
                continue
            if FinanceService.has_overdue(tx, sub.user_id, today):
                self._deactivate(tx, sub, "Membership dinonaktifkan karena ada tunggakan yang lewat jatuh tempo.")
                hasil["deactivated"] += 1
                continue
            sisa = (sub.end_date - today).days
            if sisa <= 7 and not sub.reminder_7_sent:
                self._notify(
                    tx,
                    sub,
                    "Membership berakhir 7 hari lagi",
                    f"Membership {nama} berakhir {sub.end_date:%d-%m-%Y}. Perpanjang dari dashboard.",
                    "membership_reminder",
                )
                tx.subscriptions.update(sub.id, reminder_7_sent=True)
                hasil["reminders"] += 1
            if sisa <= 1 and not sub.reminder_1_sent:
                self._notify(
                    tx,
                    sub,
                    "Membership berakhir besok",
                    f"Membership {nama} berakhir {sub.end_date:%d-%m-%Y}.",
                    "membership_reminder",
                )
                tx.subscriptions.update(sub.id, reminder_1_sent=True)
                hasil["reminders"] += 1
        return hasil

    def _deactivate(self, tx: Tables, sub: Subscription, pesan: str) -> None:
        tx.subscriptions.update(sub.id, status=SubscriptionStatus.INACTIVE, deactivated_at=clock.now())
        self._notify(tx, sub, "Membership nonaktif", pesan, "membership_inactive")

    def _notify(self, tx: Tables, sub: Subscription, subject: str, body: str, kind: str) -> None:
        user = tx.users.get(sub.user_id)
        if user:
            self.mailer.send(tx, user.email, subject, body, kind, user.id)
