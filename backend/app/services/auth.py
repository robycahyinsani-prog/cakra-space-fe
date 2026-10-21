from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.clock import clock
from app.core.config import Settings
from app.core.errors import Conflict, Forbidden, Invalid, Locked, Unauthorized
from app.core.security import OneTimeToken, PasswordHasher, TokenService
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.integrations.mailer import Mailer
from app.models.account import EmailToken, RevokedToken, User
from app.models.enums import Role, TokenPurpose

SAMA_UNTUK_SEMUA = "Kalau email terdaftar, link reset password sudah dikirim ke email tersebut."

@dataclass
class LoginResult:
    token: str
    expires_at: datetime
    user: User
    landing: str

class AuthService:
    def __init__(self, store: JsonStore, settings: Settings, mailer: Mailer,
                 hasher: PasswordHasher, tokens: TokenService):
        self.store = store
        self.settings = settings
        self.mailer = mailer
        self.hasher = hasher
        self.tokens = tokens

    # registrasi dan verifikasi email (K5-US-001.2)

    def register(self, name: str, email: str, password: str, phone: str | None = None) -> User:
        email = self.normalize(email)
        with self.store.write() as tx:
            if tx.users.exists(email=email):
                raise Conflict("Email sudah terdaftar")
            user = tx.users.add(
                User(email=email, password_hash=self.hasher.hash(password), name=name.strip(), phone=phone)
            )
            self._send_verification(tx, user)
            return user

    def verify_email(self, token: str) -> User:
        with self.store.write() as tx:
            row = self._use_token(tx, token, TokenPurpose.VERIFY_EMAIL, "Link verifikasi")
            return tx.users.update(row.user_id, is_verified=True)

    def resend_verification(self, email: str) -> None:
        with self.store.write() as tx:
            user = tx.users.first(email=self.normalize(email))
            if user and not user.is_verified:
                self._send_verification(tx, user)

    # login, logout dan penguncian akun (K5-US-001.1, 001.4, 001.5)

    def login(self, email: str, password: str) -> LoginResult:
        with self.store.write() as tx:
            user = tx.users.first(email=self.normalize(email))
            if user is None:
                raise Unauthorized("Email atau password salah")
            now = clock.now()
            if user.locked_until and user.locked_until > now:
                menit = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
                raise Locked(f"Akun terkunci sementara karena terlalu banyak percobaan. Coba lagi {menit} menit lagi.")
            cocok = self.hasher.verify(password, user.password_hash)
            if cocok:
                user = tx.users.update(user.id, failed_logins=0, locked_until=None)
            else:
                # dicatat dulu lalu transaksi ditutup normal, error dilempar setelahnya supaya hitungan tersimpan
                self._record_failure(tx, user, now)
        if not cocok:
            raise Unauthorized("Email atau password salah")
        token, exp = self.tokens.issue(user.id, user.role, user.token_version)
        return LoginResult(token=token, expires_at=exp, user=user, landing=self.landing_for(user))

    def logout(self, payload: dict) -> None:
        with self.store.write() as tx:
            if not tx.revoked_tokens.exists(jti=payload["jti"]):
                berakhir = datetime.fromtimestamp(payload["exp"], clock.now().tzinfo)
                tx.revoked_tokens.add(RevokedToken(jti=payload["jti"], expires_at=berakhir))

    def authenticate(self, token: str) -> tuple[User, dict]:
        payload = self.tokens.decode(token)
        with self.store.read() as tx:
            if tx.revoked_tokens.exists(jti=payload["jti"]):
                raise Unauthorized("Sesi sudah berakhir, silakan login lagi")
            user = tx.users.get(int(payload["sub"]))
        if user is None or user.token_version != payload.get("ver"):
            raise Unauthorized("Sesi sudah berakhir, silakan login lagi")
        return user, payload

    # lupa dan ganti password (K5-US-001.3, 001.5)

    def forgot_password(self, email: str) -> str:
        with self.store.write() as tx:
            user = tx.users.first(email=self.normalize(email))
            if user:
                token = self._issue(tx, user, TokenPurpose.RESET_PASSWORD,
                                    timedelta(minutes=self.settings.reset_password_minutes))
                self.mailer.send(
                    tx, user.email, "Reset password Cakra Space",
                    f"Buka link berikut untuk membuat password baru (berlaku 30 menit, sekali pakai):\n"
                    f"{self.settings.frontend_url}/reset-password?token={token}",
                    "reset_password", user.id,
                )
        # pesan sama untuk email terdaftar maupun tidak supaya tidak bisa dipakai menebak akun
        return SAMA_UNTUK_SEMUA

    def reset_password(self, token: str, new_password: str) -> None:
        with self.store.write() as tx:
            row = self._use_token(tx, token, TokenPurpose.RESET_PASSWORD, "Link reset password")
            user = tx.users.require(row.user_id)
            # token_version naik sehingga semua sesi lama berakhir
            tx.users.update(user.id, password_hash=self.hasher.hash(new_password),
                            token_version=user.token_version + 1, failed_logins=0, locked_until=None)

    def change_password(self, user: User, current: str, new_password: str) -> LoginResult:
        if current == new_password:
            raise Invalid("Password baru harus berbeda dari password lama")
        with self.store.write() as tx:
            user = tx.users.require(user.id)
            if not self.hasher.verify(current, user.password_hash):
                raise Unauthorized("Password lama salah")
            user = tx.users.update(user.id, password_hash=self.hasher.hash(new_password),
                                   must_change_password=False, token_version=user.token_version + 1)
        token, exp = self.tokens.issue(user.id, user.role, user.token_version)
        return LoginResult(token=token, expires_at=exp, user=user, landing=self.landing_for(user))

    # ganti email perlu verifikasi ulang (K5-US-008.4)

    def request_email_change(self, user: User, new_email: str, password: str) -> None:
        new_email = self.normalize(new_email)
        with self.store.write() as tx:
            user = tx.users.require(user.id)
            if not self.hasher.verify(password, user.password_hash):
                raise Unauthorized("Password salah")
            if tx.users.exists(email=new_email):
                raise Conflict("Email sudah dipakai akun lain")
            token = self._issue(tx, user, TokenPurpose.CHANGE_EMAIL,
                                timedelta(hours=self.settings.verify_email_hours), new_email=new_email)
            self.mailer.send(
                tx, new_email, "Konfirmasi email baru Cakra Space",
                f"Buka link berikut untuk memakai email ini:\n"
                f"{self.settings.frontend_url}/confirm-email?token={token}",
                "change_email", user.id,
            )

    def confirm_email_change(self, token: str) -> User:
        with self.store.write() as tx:
            row = self._use_token(tx, token, TokenPurpose.CHANGE_EMAIL, "Link konfirmasi email")
            if tx.users.exists(lambda u: u.id != row.user_id, email=row.new_email):
                raise Conflict("Email sudah dipakai akun lain")
            return tx.users.update(row.user_id, email=row.new_email, is_verified=True)

    # pembantu

    @staticmethod
    def normalize(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def landing_for(user: User) -> str:
        return "/dashboard" if user.role == Role.MEMBER else "/admin-dashboard"

    @staticmethod
    def ensure_password_changed(user: User) -> None:
        if user.must_change_password:
            raise Forbidden("Ganti password sementara terlebih dahulu", code="password_change_required")

    def _record_failure(self, tx: Tables, user: User, now: datetime) -> None:
        gagal = user.failed_logins + 1
        if gagal >= self.settings.login_max_attempts:
            tx.users.update(user.id, failed_logins=0,
                            locked_until=now + timedelta(minutes=self.settings.login_lock_minutes))
        else:
            tx.users.update(user.id, failed_logins=gagal)

    def _send_verification(self, tx: Tables, user: User) -> None:
        token = self._issue(tx, user, TokenPurpose.VERIFY_EMAIL, timedelta(hours=self.settings.verify_email_hours))
        self.mailer.send(
            tx, user.email, "Verifikasi email Cakra Space",
            f"Halo {user.name}, buka link berikut untuk verifikasi akun (berlaku 24 jam):\n"
            f"{self.settings.frontend_url}/verify-email?token={token}",
            "verify_email", user.id,
        )

    def _issue(self, tx: Tables, user: User, purpose: TokenPurpose, ttl: timedelta,
               new_email: str | None = None) -> str:
        # token lama untuk tujuan yang sama dimatikan supaya hanya link terbaru yang berlaku
        for lama in tx.email_tokens.where(lambda t: t.used_at is None, user_id=user.id, purpose=purpose):
            tx.email_tokens.update(lama.id, used_at=clock.now())
        token, digest = OneTimeToken.new()
        tx.email_tokens.add(EmailToken(user_id=user.id, purpose=purpose, token_hash=digest,
                                       new_email=new_email, expires_at=clock.now() + ttl))
        return token

    def _use_token(self, tx: Tables, token: str, purpose: TokenPurpose, label: str) -> EmailToken:
        row = tx.email_tokens.first(token_hash=OneTimeToken.digest(token), purpose=purpose)
        if row is None or row.used_at is not None:
            raise Invalid(f"{label} tidak valid atau sudah dipakai")
        if row.expires_at < clock.now():
            raise Invalid(f"{label} sudah kedaluwarsa, minta link baru")
        tx.email_tokens.update(row.id, used_at=clock.now())
        return row
