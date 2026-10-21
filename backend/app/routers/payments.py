from fastapi import APIRouter, Depends, Header, Request

from app.container import Container
from app.core.deps import get_container, member_user, staff_user
from app.core.errors import Invalid
from app.models.account import User
from app.models.enums import PaymentPurpose, RefundStatus
from app.schemas.commerce import PaymentIn, RejectIn

router = APIRouter(prefix="/api/v1", tags=["payments"])


@router.post(
    "/payments",
    status_code=201,
    summary="Bayar booking atau membership lewat VA, e-wallet atau kartu (BE-22, BE-35, BE-36)",
)
def create_payment(body: PaymentIn, user: User = Depends(member_user), c: Container = Depends(get_container)):
    if body.purpose in (PaymentPurpose.BOOKING, PaymentPurpose.SUBSCRIPTION) and body.reference_id is None:
        raise Invalid("reference_id wajib diisi untuk pembayaran booking atau langganan")
    return c.payments.create(user, body.purpose, body.reference_id or 0, body.method, body.plan_id)


@router.get("/payments/{payment_id}", summary="Cek status pembayaran (polling halaman menunggu pembayaran)")
def payment_status(payment_id: int, user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.payments.get(user, payment_id)


@router.post("/payments/webhook", summary="Webhook status pembayaran dari gateway (BE-23)")
async def webhook(
    request: Request, x_signature: str | None = Header(default=None), c: Container = Depends(get_container)
):
    # signature dihitung dari body mentah, jadi body dibaca sebagai bytes
    return c.payments.handle_webhook(await request.body(), x_signature)


@router.get("/manage/refunds", tags=["refunds"], summary="Daftar permintaan refund gedung (BE-27)")
def list_refunds(
    building_id: int | None = None,
    status: RefundStatus | None = None,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    return c.refunds.list(actor, building_id, status)


@router.post(
    "/manage/refunds/{refund_id}/approve",
    tags=["refunds"],
    summary="Setujui refund lalu proses ke payment gateway (BE-27)",
)
def approve_refund(refund_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.refunds.approve(actor, refund_id)


@router.post("/manage/refunds/{refund_id}/reject", tags=["refunds"], summary="Tolak refund dengan alasan")
def reject_refund(
    refund_id: int, body: RejectIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)
):
    return c.refunds.reject(actor, refund_id, body.note)
