import hashlib
import hmac
import secrets
import string
import uuid
from datetime import datetime, timedelta

import bcrypt
import jwt

from app.core.clock import clock
from app.core.errors import Invalid, Unauthorized


class PasswordHasher:
    MAX_BYTES = 72  # batas bcrypt, lebih dari ini ditolak bcrypt 5

    def hash(self, password: str) -> str:
        self._check(password)
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def verify(self, password: str, hashed: str) -> bool:
        if len(password.encode()) > self.MAX_BYTES:
            return False
        return bcrypt.checkpw(password.encode(), hashed.encode())

    def _check(self, password: str) -> None:
        if len(password.encode()) > self.MAX_BYTES:
            raise Invalid("Password maksimal 72 byte")

    @staticmethod
    def temporary() -> str:
        alfabet = string.ascii_letters + string.digits
        return "Tmp-" + "".join(secrets.choice(alfabet) for _ in range(10))


class TokenService:
    ALGORITHM = "HS256"

    def __init__(self, secret: str, minutes: int):
        self.secret = secret
        self.minutes = minutes

    def issue(self, user_id: int, role: str, version: int) -> tuple[str, datetime]:
        now = clock.now()
        exp = now + timedelta(minutes=self.minutes)
        payload = {
            "sub": str(user_id),
            "role": role,
            "ver": version,
            "jti": uuid.uuid4().hex,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }
        return jwt.encode(payload, self.secret, algorithm=self.ALGORITHM), exp

    def decode(self, token: str) -> dict:
        try:
            # exp dicek manual memakai clock aplikasi supaya test bisa memajukan waktu
            data = jwt.decode(
                token,
                self.secret,
                algorithms=[self.ALGORITHM],
                options={"verify_exp": False, "verify_iat": False, "require": ["sub", "exp", "jti"]},
            )
        except jwt.PyJWTError as exc:
            raise Unauthorized("Token tidak valid") from exc
        if data["exp"] < clock.now().timestamp():
            raise Unauthorized("Sesi sudah berakhir, silakan login lagi")
        return data


class OneTimeToken:
    """Token acak untuk link email, yang disimpan hanya hash-nya."""

    @staticmethod
    def new() -> tuple[str, str]:
        token = secrets.token_urlsafe(32)
        return token, OneTimeToken.digest(token)

    @staticmethod
    def digest(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()


class Signer:
    """Tanda tangan HMAC-SHA256 untuk QR dinamis dan webhook pembayaran."""

    def __init__(self, secret: str):
        self.secret = secret.encode()

    def sign(self, data: bytes | str) -> str:
        raw = data.encode() if isinstance(data, str) else data
        return hmac.new(self.secret, raw, hashlib.sha256).hexdigest()

    def verify(self, data: bytes | str, signature: str) -> bool:
        return hmac.compare_digest(self.sign(data), signature or "")
