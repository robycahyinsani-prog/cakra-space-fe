from datetime import date, time

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import (
    BenefitType,
    CommandType,
    DeviceType,
    DiscountType,
    ExportFormat,
    PaymentMethod,
    PaymentPurpose,
    ReportKind,
)


class BookingIn(BaseModel):
    area_id: int
    date: date
    start_time: time
    end_time: time
    voucher_code: str | None = Field(default=None, max_length=30)
    use_benefit: bool = False


class CancelIn(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class RescheduleIn(BaseModel):
    date: date
    start_time: time
    end_time: time


class GuestIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr


class GuestsIn(BaseModel):
    guests: list[GuestIn] = Field(min_length=1, max_length=50)


class PaymentIn(BaseModel):
    purpose: PaymentPurpose
    reference_id: int | None = None
    method: PaymentMethod
    plan_id: int | None = None


class VoucherIn(BaseModel):
    code: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9-]+$")
    description: str = Field(default="", max_length=255)
    discount_type: DiscountType
    discount_value: int = Field(gt=0)
    max_discount: int | None = Field(default=None, gt=0)
    quota: int = Field(ge=1)
    valid_from: date
    valid_until: date
    building_ids: list[int] = []
    is_active: bool = True


class VoucherUpdateIn(BaseModel):
    description: str | None = Field(default=None, max_length=255)
    discount_type: DiscountType | None = None
    discount_value: int | None = Field(default=None, gt=0)
    max_discount: int | None = Field(default=None, gt=0)
    quota: int | None = Field(default=None, ge=1)
    valid_from: date | None = None
    valid_until: date | None = None
    building_ids: list[int] | None = None
    is_active: bool | None = None


class TaxIn(BaseModel):
    tax_rate_percent: int = Field(ge=0, le=100)


class DepositIn(BaseModel):
    user_id: int
    building_id: int
    item: str = Field(min_length=2, max_length=100)
    amount: int = Field(ge=0)


class ArrearIn(BaseModel):
    user_id: int
    building_id: int
    description: str = Field(min_length=2, max_length=255)
    amount: int = Field(gt=0)
    due_date: date


class RejectIn(BaseModel):
    note: str = Field(min_length=3, max_length=255)


class ValidateIn(BaseModel):
    token: str = Field(min_length=5, max_length=200)
    building_id: int | None = None
    door: str | None = Field(default=None, max_length=60)


class BenefitIn(BaseModel):
    benefit_type: BenefitType
    quantity: int = Field(ge=1, le=1000)


class PlanIn(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    description: str = Field(default="", max_length=500)
    duration_days: int = Field(ge=1, le=366)
    price: int = Field(ge=0)
    building_ids: list[int] = []
    benefits: list[BenefitIn] = []


class PlanUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    duration_days: int | None = Field(default=None, ge=1, le=366)
    price: int | None = Field(default=None, ge=0)
    building_ids: list[int] | None = None
    benefits: list[BenefitIn] | None = None


class SubscribeIn(BaseModel):
    plan_id: int


class FreezeIn(BaseModel):
    start_date: date
    days: int = Field(ge=1, le=30)


class AnnouncementIn(BaseModel):
    building_id: int
    title: str = Field(min_length=3, max_length=150)
    body: str = Field(min_length=3, max_length=2000)


class DeviceIn(BaseModel):
    building_id: int
    name: str = Field(min_length=2, max_length=100)
    type: DeviceType
    door: str = Field(min_length=2, max_length=60)


class CommandIn(BaseModel):
    command: CommandType


class CommandResultIn(BaseModel):
    success: bool
    result: str | None = Field(default=None, max_length=255)


class MaintenanceIn(BaseModel):
    date: date
    issue: str = Field(min_length=3, max_length=255)
    action: str = Field(min_length=3, max_length=255)
    technician: str = Field(min_length=2, max_length=100)


class ExportIn(BaseModel):
    report: ReportKind
    format: ExportFormat
    date_from: date
    date_to: date
    building_id: int | None = None
    plan_id: int | None = None
