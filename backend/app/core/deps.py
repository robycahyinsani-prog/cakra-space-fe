import hmac
import os

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.container import Container
from app.core.errors import Forbidden, Unauthorized
from app.models.account import User
from app.models.enums import Role
from app.models.operations import Device

bearer = HTTPBearer(auto_error=False, description="Token JWT dari POST /api/v1/auth/login")


def client_ip(request: Request) -> str:
    # di Vercel IP asli ada di x-real-ip yang ditulis ulang Vercel, request.client milik proxy
    if os.getenv("VERCEL"):
        return request.headers.get("x-real-ip") or get_remote_address(request)
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)


def get_container(request: Request) -> Container:
    return request.app.state.container


def _authenticate(
    request: Request, credentials: HTTPAuthorizationCredentials | None, container: Container
) -> tuple[User, dict]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise Unauthorized("Silakan login terlebih dahulu")
    user, payload = container.auth.authenticate(credentials.credentials)
    request.state.token_payload = payload
    return user, payload


def current_user_any(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    container: Container = Depends(get_container),
) -> User:
    """Login wajib, tapi password sementara belum harus diganti (dipakai halaman ganti password)."""
    user, _ = _authenticate(request, credentials, container)
    return user


def current_user(user: User = Depends(current_user_any)) -> User:
    if user.must_change_password:
        raise Forbidden("Ganti password sementara terlebih dahulu", code="password_change_required")
    return user


def optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    container: Container = Depends(get_container),
) -> User | None:
    if credentials is None:
        return None
    user, _ = _authenticate(request, credentials, container)
    return user


def member_user(user: User = Depends(current_user)) -> User:
    if user.role != Role.MEMBER:
        raise Forbidden("Fitur ini khusus member")
    return user


def staff_user(user: User = Depends(current_user)) -> User:
    if not user.is_staff:
        raise Forbidden("Fitur ini khusus staf Cakra Space")
    return user


def current_device(
    x_device_key: str | None = Header(default=None), container: Container = Depends(get_container)
) -> Device:
    return container.devices.authenticate(x_device_key)


def cron_auth(x_cron_secret: str | None = Header(default=None), container: Container = Depends(get_container)) -> None:
    rahasia = container.settings.cron_secret
    if not rahasia or not hmac.compare_digest(rahasia, x_cron_secret or ""):
        raise Unauthorized("Cron secret tidak valid")
