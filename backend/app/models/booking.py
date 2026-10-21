from datetime import datetime

from app.models.base import Entity, TimestampedEntity
from app.models.enums import BookingStatus


class Booking(TimestampedEntity):
    code: str
    user_id: int
    building_id: int
    area_id: int
    start_at: datetime
    end_at: datetime
    status: BookingStatus = BookingStatus.PENDING_PAYMENT
    subtotal: int
    benefit_discount: int = 0
    voucher_discount: int = 0
    tax: int = 0
    total: int
    voucher_id: int | None = None
    subscription_id: int | None = None
    benefit_minutes: int = 0
    hold_expires_at: datetime | None = None
    needs_relocation: bool = False
    reminder_24_sent: bool = False
    reminder_1_sent: bool = False
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None

    @property
    def is_active(self) -> bool:
        return self.status in (BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED)

    def overlaps(self, start: datetime, end: datetime) -> bool:
        return self.start_at < end and start < self.end_at


class GuestInvite(Entity):
    booking_id: int
    inviter_id: int
    guest_name: str
    guest_email: str
    token_hash: str
    valid_from: datetime
    valid_until: datetime
    used_at: datetime | None = None
    created_at: datetime | None = None
