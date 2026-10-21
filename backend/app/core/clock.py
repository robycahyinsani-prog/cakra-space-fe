from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

class Clock:
    """Sumber waktu tunggal supaya test bisa memajukan waktu tanpa menunggu."""

    def __init__(self):
        self._offset = timedelta()

    def now(self) -> datetime:
        return datetime.now(UTC) + self._offset

    def shift(self, delta: timedelta) -> None:
        self._offset += delta

    def reset(self) -> None:
        self._offset = timedelta()

    def local_now(self, tz: str) -> datetime:
        return self.now().astimezone(ZoneInfo(tz))

    def local_today(self, tz: str) -> date:
        return self.local_now(tz).date()

    @staticmethod
    def combine(tanggal: date, jam: time, tz: str) -> datetime:
        return datetime.combine(tanggal, jam, tzinfo=ZoneInfo(tz)).astimezone(UTC)

clock = Clock()
