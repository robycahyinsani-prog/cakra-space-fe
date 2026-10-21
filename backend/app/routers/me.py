from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.container import Container
from app.core.deps import current_user, get_container, member_user
from app.models.account import User
from app.schemas.auth import EmailChangeIn, MessageOut, ProfileUpdateIn, UserOut

router = APIRouter(prefix="/api/v1/me", tags=["member dashboard"])

@router.get("", response_model=UserOut, summary="Profil user yang sedang login")
def me(user: User = Depends(current_user), c: Container = Depends(get_container)):
    return c.profile.me(user)

@router.patch("", response_model=UserOut, summary="Ubah nama, nomor HP, foto dan perusahaan (BE-43)")
def update_me(body: ProfileUpdateIn, user: User = Depends(current_user), c: Container = Depends(get_container)):
    return c.profile.update(user, body.model_dump(exclude_unset=True))

@router.post("/email", response_model=MessageOut, summary="Ganti email, link konfirmasi dikirim ke email baru")
def change_email(body: EmailChangeIn, user: User = Depends(current_user), c: Container = Depends(get_container)):
    c.auth.request_email_change(user, body.new_email, body.password)
    return MessageOut(message="Link konfirmasi sudah dikirim ke email baru")

@router.get("/summary", summary="Status membership, masa berlaku, kuota dan booking berikutnya (BE-40)")
def summary(user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.dashboard.summary(user)

@router.get("/bookings", summary="Booking akan datang dan riwayat dengan paginasi (BE-41)")
def my_bookings(tab: Literal["upcoming", "history"] = "upcoming", page: int = Query(1, ge=1),
                size: int = Query(10, ge=1, le=50), user: User = Depends(member_user),
                c: Container = Depends(get_container)):
    return c.bookings.list_mine(user, tab, page, size)

@router.get("/invoices", summary="Daftar invoice dan status pembayaran (BE-42)")
def my_invoices(user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.invoices.list_mine(user)

@router.get("/invoices/{invoice_id}/pdf", summary="Unduh invoice PDF (BE-24)",
            response_class=Response, responses={200: {"content": {"application/pdf": {}}}})
def invoice_pdf(invoice_id: int, user: User = Depends(current_user), c: Container = Depends(get_container)):
    konten, nama = c.invoices.render(user, invoice_id)
    return Response(konten, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{nama}"'})

@router.get("/subscription", summary="Membership saya beserta sisa kuota benefit (BE-37)")
def my_subscription(user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.membership.my_subscription(user)

@router.get("/access-qr", summary="QR kartu digital yang berganti setiap 30 detik (BE-30)")
def access_qr(user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.access.qr_for(user)

@router.get("/announcements", summary="Pengumuman gedung tempat saya booking atau berlangganan (BE-43)")
def announcements(user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.dashboard.announcements_feed(user)
