from datetime import date, time
from zoneinfo import available_timezones

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import AreaStatus, AreaType, BuildingStatus, FacilityScope


class BuildingIn(BaseModel):
    code: str = Field(min_length=2, max_length=10, pattern=r"^[A-Za-z0-9]+$")
    name: str = Field(min_length=3, max_length=100)
    address: str = Field(min_length=5, max_length=255)
    city: str = Field(min_length=2, max_length=60)
    contact_phone: str | None = Field(default=None, max_length=20)
    contact_email: EmailStr | None = None
    timezone: str = "Asia/Jakarta"
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        if v not in available_timezones():
            raise ValueError("Zona waktu tidak dikenal, contoh Asia/Jakarta")
        return v


class BuildingUpdateIn(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=10, pattern=r"^[A-Za-z0-9]+$")
    name: str | None = Field(default=None, min_length=3, max_length=100)
    address: str | None = Field(default=None, min_length=5, max_length=255)
    city: str | None = Field(default=None, min_length=2, max_length=60)
    contact_phone: str | None = Field(default=None, max_length=20)
    contact_email: EmailStr | None = None
    timezone: str | None = None
    image_url: str | None = Field(default=None, max_length=500)

    _tz = field_validator("timezone")(lambda v: BuildingIn._tz(v) if v else v)


class BuildingStatusIn(BaseModel):
    status: BuildingStatus


class OperatingHourIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    open_time: time = time(8)
    close_time: time = time(21)
    is_closed: bool = False


class HoursIn(BaseModel):
    hours: list[OperatingHourIn] = Field(min_length=7, max_length=7)


class HolidayIn(BaseModel):
    date: date
    description: str = Field(min_length=2, max_length=120)


class FloorIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    level: int = Field(ge=-5, le=200)


class FloorUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    level: int | None = Field(default=None, ge=-5, le=200)


class FacilityIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    scope: FacilityScope
    building_id: int | None = None


class FacilityIdsIn(BaseModel):
    facility_ids: list[int]


class RefundPolicyIn(BaseModel):
    cancel_deadline_hours: int = Field(ge=0, le=168)
    refund_full_hours: int = Field(ge=0, le=168)
    refund_partial_hours: int = Field(ge=0, le=168)
    refund_partial_percent: int = Field(ge=0, le=100)


class AreaIn(BaseModel):
    building_id: int
    floor_id: int
    code: str = Field(min_length=1, max_length=10, pattern=r"^[A-Za-z0-9-]+$")
    name: str = Field(min_length=2, max_length=100)
    type: AreaType
    capacity: int | None = Field(default=None, ge=1, le=200)
    price_per_hour: int = Field(ge=0, le=100_000_000)
    price_per_day: int = Field(ge=0, le=100_000_000)


class AreaUpdateIn(BaseModel):
    floor_id: int | None = None
    code: str | None = Field(default=None, min_length=1, max_length=10, pattern=r"^[A-Za-z0-9-]+$")
    name: str | None = Field(default=None, min_length=2, max_length=100)
    type: AreaType | None = None
    capacity: int | None = Field(default=None, ge=1, le=200)
    price_per_hour: int | None = Field(default=None, ge=0, le=100_000_000)
    price_per_day: int | None = Field(default=None, ge=0, le=100_000_000)


class AreaStatusIn(BaseModel):
    status: AreaStatus
    reason: str | None = Field(default=None, max_length=255)


class PositionIn(BaseModel):
    pos_x: float = Field(ge=0, le=100)
    pos_y: float = Field(ge=0, le=100)
