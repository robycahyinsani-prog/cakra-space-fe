from datetime import datetime

from app.models.base import Entity, TimestampedEntity
from app.models.enums import Role, TokenPurpose

class User(TimestampedEntity):
    email: str
    password_hash: str
    name: str
    phone: str | None = None
    company: str | None = None
    photo_url: str | None = None
    role: Role = Role.MEMBER
    is_verified: bool = False
    must_change_password: bool = False
    failed_logins: int = 0
    locked_until: datetime | None = None
    token_version: int = 0

    @property
    def is_staff(self) -> bool:
        return self.role != Role.MEMBER

class UserBuilding(Entity):
    """Gedung yang dipegang staf (pengelola lokasi dan resepsionis)."""

    user_id: int
    building_id: int

class RoleDef(Entity):
    code: Role
    name: str

class Permission(Entity):
    code: str
    description: str

class RolePermission(Entity):
    role: Role
    permission: str

class EmailToken(Entity):
    user_id: int
    purpose: TokenPurpose
    token_hash: str
    new_email: str | None = None
    expires_at: datetime
    used_at: datetime | None = None
    created_at: datetime | None = None

class RevokedToken(Entity):
    jti: str
    expires_at: datetime
