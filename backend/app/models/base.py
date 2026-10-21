from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Entity(BaseModel):
    """Dasar semua baris koleksi JSON."""

    model_config = ConfigDict(validate_assignment=True)

    id: int | None = None


class TimestampedEntity(Entity):
    created_at: datetime | None = None
    updated_at: datetime | None = None
