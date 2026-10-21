from fastapi import APIRouter, Depends, Request

from app.container import Container
from app.core.deps import current_user_any, get_container, limiter
from app.models.account import User
from app.schemas.auth import (
    ChangePasswordIn,
    EmailIn,
    LoginIn,
    MessageOut,
    RegisterIn,
    ResetPasswordIn,
    TokenIn,
    TokenOut,
    UserOut,
)
from app.services.auth import LoginResult

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

def _token_out(c: Container, hasil: LoginResult) -> TokenOut:
    return TokenOut(access_token=hasil.token, expires_at=hasil.expires_at,
                    must_change_password=hasil.user.must_change_password, landing=hasil.landing,
                    user=UserOut(**c.profile.me(hasil.user)))

@router.post("/register", response_model=UserOut, status_code=201, summary="Daftar akun member (BE-03)")
@limiter.limit("5/minute")
def register(request: Request, body: RegisterIn, c: Container = Depends(get_container)):
    # akun dari form registrasi selalu member, akun staf dibuat pengelola pusat lewat /staff
    user = c.auth.register(body.name, body.email, body.password, body.phone)
    return c.profile.me(user)

@router.post("/verify-email", response_model=UserOut, summary="Verifikasi email dari link (BE-04)")
def verify_email(body: TokenIn, c: Container = Depends(get_container)):
    return c.profile.me(c.auth.verify_email(body.token))

@router.post("/resend-verification", response_model=MessageOut, summary="Kirim ulang link verifikasi")
@limiter.limit("3/minute")
def resend_verification(request: Request, body: EmailIn, c: Container = Depends(get_container)):
    c.auth.resend_verification(body.email)
    return MessageOut(message="Kalau akun belum terverifikasi, link baru sudah dikirim ke email tersebut.")

@router.post("/login", response_model=TokenOut, summary="Login email dan password (BE-01, BE-02, BE-52)")
@limiter.limit("20/minute")
def login(request: Request, body: LoginIn, c: Container = Depends(get_container)):
    return _token_out(c, c.auth.login(body.email, body.password))

@router.post("/logout", response_model=MessageOut, summary="Logout dan cabut token (BE-06)")
def logout(request: Request, user: User = Depends(current_user_any), c: Container = Depends(get_container)):
    c.auth.logout(request.state.token_payload)
    return MessageOut(message="Berhasil logout")

@router.post("/forgot-password", response_model=MessageOut, summary="Minta link reset password (BE-05)")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: EmailIn, c: Container = Depends(get_container)):
    return MessageOut(message=c.auth.forgot_password(body.email))

@router.post("/reset-password", response_model=MessageOut, summary="Simpan password baru dari link reset (BE-05)")
def reset_password(body: ResetPasswordIn, c: Container = Depends(get_container)):
    c.auth.reset_password(body.token, body.new_password)
    return MessageOut(message="Password berhasil diganti, silakan login dengan password baru")

@router.post("/change-password", response_model=TokenOut,
             summary="Ganti password, termasuk password sementara saat login pertama (BE-07)")
def change_password(body: ChangePasswordIn, user: User = Depends(current_user_any),
                    c: Container = Depends(get_container)):
    return _token_out(c, c.auth.change_password(user, body.current_password, body.new_password))

@router.post("/confirm-email-change", response_model=UserOut, summary="Konfirmasi email baru dari link (BE-43)")
def confirm_email_change(body: TokenIn, c: Container = Depends(get_container)):
    return c.profile.me(c.auth.confirm_email_change(body.token))
