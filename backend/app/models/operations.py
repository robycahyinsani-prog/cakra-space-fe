from datetime import date, datetime

from app.models.base import Entity, TimestampedEntity
from app.models.enums import (
    AccessResult,
    CommandStatus,
    CommandType,
    Credential,
    DeviceType,
    ExportFormat,
    ExportStatus,
    ReportKind,
)


class AccessLog(Entity):
    building_id: int
    device_id: int | None = None
    door: str | None = None
    user_id: int | None = None
    guest_invite_id: int | None = None
    inviter_id: int | None = None
    credential: Credential
    result: AccessResult
    reason: str
    scanned_by: int | None = None
    scanned_at: datetime


class Device(TimestampedEntity):
    building_id: int
    name: str
    type: DeviceType
    door: str
    key_prefix: str
    key_hash: str
    is_revoked: bool = False
    last_heartbeat_at: datetime | None = None
    offline_notified: bool = False


class DeviceCommand(Entity):
    device_id: int
    command: CommandType
    status: CommandStatus = CommandStatus.PENDING
    requested_by: int
    result: str | None = None
    created_at: datetime | None = None
    delivered_at: datetime | None = None
    completed_at: datetime | None = None


class DeviceMaintenance(Entity):
    device_id: int
    date: date
    issue: str
    action: str
    technician: str
    created_by: int
    created_at: datetime | None = None


class Announcement(Entity):
    building_id: int
    title: str
    body: str
    created_by: int
    created_at: datetime | None = None


class Notification(Entity):
    """Kotak keluar email simulasi. Pengiriman nyata cukup mengganti Mailer."""

    user_id: int | None = None
    to_email: str
    subject: str
    body: str
    kind: str
    created_at: datetime | None = None


class AuditLog(Entity):
    actor_id: int | None = None
    action: str
    entity: str
    entity_id: int | None = None
    detail: dict = {}
    created_at: datetime | None = None


class ReportExport(Entity):
    requested_by: int
    report: ReportKind
    format: ExportFormat
    filters: dict = {}
    status: ExportStatus = ExportStatus.QUEUED
    filename: str | None = None
    row_count: int | None = None
    emailed: bool = False
    error: str | None = None
    created_at: datetime | None = None
    finished_at: datetime | None = None
