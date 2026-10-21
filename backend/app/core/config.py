import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[2]

def _path(nama: str, bawaan: str) -> Path:
    nilai = Path(os.getenv(nama, bawaan))
    return nilai if nilai.is_absolute() else BASE_DIR / nilai

def _list(nama: str, bawaan: str) -> list[str]:
    return [x.strip() for x in os.getenv(nama, bawaan).split(",") if x.strip()]

@dataclass(frozen=True)
class Settings:
    app_env: str = field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    secret_key: str = field(default_factory=lambda: os.getenv("SECRET_KEY", ""))
    data_file: Path = field(default_factory=lambda: _path("DATA_FILE", "data/cakraspace.json"))
    upload_dir: Path = field(default_factory=lambda: _path("UPLOAD_DIR", "data/uploads"))
    export_dir: Path = field(default_factory=lambda: _path("EXPORT_DIR", "data/exports"))
    frontend_url: str = field(default_factory=lambda: os.getenv("FRONTEND_URL", "http://localhost:5173"))
    cors_origins: list[str] = field(
        default_factory=lambda: _list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    )
    token_minutes: int = field(default_factory=lambda: int(os.getenv("TOKEN_MINUTES", "120")))
    payment_webhook_secret: str = field(default_factory=lambda: os.getenv("PAYMENT_WEBHOOK_SECRET", ""))
    cron_secret: str = field(default_factory=lambda: os.getenv("CRON_SECRET", ""))
    timezone: str = field(default_factory=lambda: os.getenv("TIMEZONE", "Asia/Jakarta"))

    # aturan bisnis, angka sesuai acceptance criteria di dokumen produk
    booking_hold_minutes: int = 15
    max_booking_days_ahead: int = 60
    login_max_attempts: int = 5
    login_lock_minutes: int = 15
    verify_email_hours: int = 24
    reset_password_minutes: int = 30
    qr_window_seconds: int = 30
    device_offline_minutes: int = 5
    renew_window_days: int = 7
    max_freeze_days: int = 30
    churn_grace_days: int = 7
    export_email_threshold: int = 500

    def __post_init__(self):
        if len(self.secret_key) < 32:
            raise RuntimeError(
                "SECRET_KEY belum diatur atau kurang dari 32 karakter. "
                "Salin .env.example menjadi .env lalu isi SECRET_KEY."
            )

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def webhook_secret(self) -> str:
        return self.payment_webhook_secret or f"{self.secret_key}:webhook"

_settings: Settings | None = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

def reset_settings() -> None:
    global _settings
    _settings = None
