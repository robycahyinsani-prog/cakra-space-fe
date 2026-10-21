from datetime import date, datetime

from app.models.base import Entity, TimestampedEntity
from app.models.enums import BenefitType, SubscriptionStatus


class Plan(TimestampedEntity):
    name: str
    description: str = ""
    duration_days: int
    price: int
    building_ids: list[int] = []  # kosong berarti berlaku di semua gedung
    is_archived: bool = False

    def covers(self, building_id: int) -> bool:
        return not self.building_ids or building_id in self.building_ids


class PlanBenefit(Entity):
    plan_id: int
    benefit_type: BenefitType
    quantity: int  # jumlah per periode, misalnya 10 jam ruang rapat


class Subscription(TimestampedEntity):
    user_id: int
    plan_id: int
    status: SubscriptionStatus = SubscriptionStatus.PENDING_PAYMENT
    start_date: date | None = None
    end_date: date | None = None
    freeze_from: date | None = None
    freeze_until: date | None = None
    freeze_days_used: int = 0
    scheduled_plan_id: int | None = None
    reminder_7_sent: bool = False
    reminder_1_sent: bool = False
    deactivated_at: datetime | None = None

    def is_frozen_on(self, day: date) -> bool:
        return bool(self.freeze_from and self.freeze_until and self.freeze_from <= day <= self.freeze_until)

    def is_usable_on(self, day: date) -> bool:
        return (
            self.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN)
            and self.start_date is not None
            and self.end_date is not None
            and self.start_date <= day <= self.end_date
            and not self.is_frozen_on(day)
        )


class BenefitUsage(Entity):
    subscription_id: int
    booking_id: int
    benefit_type: BenefitType
    minutes: int
    period_start: date
    reversed_at: datetime | None = None
    created_at: datetime | None = None
