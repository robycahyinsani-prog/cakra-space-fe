from datetime import date, datetime

from app.models.base import Entity, TimestampedEntity
from app.models.enums import (
    ArrearStatus,
    DepositStatus,
    DiscountType,
    InvoiceStatus,
    PaymentMethod,
    PaymentPurpose,
    PaymentStatus,
    RefundStatus,
)

class Payment(TimestampedEntity):
    purpose: PaymentPurpose
    reference_id: int
    user_id: int
    method: PaymentMethod
    amount: int
    status: PaymentStatus = PaymentStatus.PENDING
    gateway_ref: str
    va_number: str | None = None
    payment_url: str | None = None
    expires_at: datetime
    paid_at: datetime | None = None
    # data tambahan, misalnya paket tujuan saat upgrade
    meta: dict = {}

class PaymentEvent(Entity):
    """Log transaksi dari webhook, termasuk yang ditolak."""

    payment_id: int | None = None
    event_id: str
    status: str
    payload: dict
    signature_valid: bool
    result: str
    created_at: datetime | None = None

class Invoice(TimestampedEntity):
    number: str
    building_id: int | None = None
    user_id: int
    payment_id: int | None = None
    purpose: PaymentPurpose
    reference_id: int
    description: str
    subtotal: int
    discount: int = 0
    tax: int = 0
    total: int
    status: InvoiceStatus = InvoiceStatus.UNPAID
    paid_at: datetime | None = None
    emailed_at: datetime | None = None

class InvoiceCounter(Entity):
    key: str
    last_seq: int = 0

class Refund(TimestampedEntity):
    booking_id: int
    payment_id: int
    user_id: int
    building_id: int
    amount: int
    percent: int
    status: RefundStatus = RefundStatus.REQUESTED
    reason: str | None = None
    decided_by: int | None = None
    decided_at: datetime | None = None
    gateway_refund_ref: str | None = None
    note: str | None = None

class Deposit(TimestampedEntity):
    user_id: int
    building_id: int
    item: str
    amount: int
    status: DepositStatus = DepositStatus.HELD
    recorded_by: int
    returned_at: datetime | None = None

class Arrear(TimestampedEntity):
    user_id: int
    building_id: int
    description: str
    amount: int
    due_date: date
    status: ArrearStatus = ArrearStatus.OPEN
    paid_at: datetime | None = None

    def is_overdue(self, today: date) -> bool:
        return self.status == ArrearStatus.OPEN and self.due_date < today

class Voucher(TimestampedEntity):
    code: str
    description: str = ""
    discount_type: DiscountType
    discount_value: int
    max_discount: int | None = None
    quota: int
    used_count: int = 0
    valid_from: date
    valid_until: date
    building_ids: list[int] = []  # kosong berarti berlaku di semua gedung
    is_active: bool = True

class Setting(Entity):
    key: str
    value: str
