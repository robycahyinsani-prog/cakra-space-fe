from datetime import date, time

from app.models.base import Entity, TimestampedEntity
from app.models.enums import AreaStatus, AreaType, BuildingStatus, FacilityScope


class Building(TimestampedEntity):
    code: str
    name: str
    address: str
    city: str
    contact_phone: str | None = None
    contact_email: str | None = None
    timezone: str = "Asia/Jakarta"
    status: BuildingStatus = BuildingStatus.DRAFT
    image_url: str | None = None
    # batas batal dan reschedule, dalam jam sebelum jadwal mulai
    cancel_deadline_hours: int = 24
    # aturan refund gedung (BE-26): penuh, sebagian, atau hangus
    refund_full_hours: int = 24
    refund_partial_hours: int = 6
    refund_partial_percent: int = 50


class OperatingHour(Entity):
    building_id: int
    weekday: int  # 0 = Senin
    open_time: time
    close_time: time
    is_closed: bool = False


class Holiday(Entity):
    building_id: int
    date: date
    description: str


class Floor(Entity):
    building_id: int
    name: str
    level: int
    plan_file: str | None = None
    plan_content_type: str | None = None


class Facility(Entity):
    name: str
    scope: FacilityScope
    # kosong berarti fasilitas master, terisi berarti fasilitas khusus satu lokasi
    building_id: int | None = None


class BuildingFacility(Entity):
    building_id: int
    facility_id: int


class Area(TimestampedEntity):
    building_id: int
    floor_id: int
    code: str
    name: str
    type: AreaType
    capacity: int = 1
    price_per_hour: int
    price_per_day: int
    status: AreaStatus = AreaStatus.AVAILABLE
    # titik pada denah, dalam persen lebar dan tinggi gambar
    pos_x: float | None = None
    pos_y: float | None = None


class AreaFacility(Entity):
    area_id: int
    facility_id: int
