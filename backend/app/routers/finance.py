from fastapi import APIRouter, Depends

from app.container import Container
from app.core.deps import get_container, staff_user
from app.models.account import User
from app.models.enums import DepositStatus
from app.schemas.commerce import ArrearIn, DepositIn, TaxIn, VoucherIn, VoucherUpdateIn

router = APIRouter(prefix="/api/v1/manage", tags=["finance"])


@router.get("/vouchers", summary="Daftar voucher (BE-29)")
def list_vouchers(actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.vouchers.list(actor)


@router.post("/vouchers", status_code=201, summary="Buat voucher dengan kuota, masa berlaku dan gedung (BE-29)")
def create_voucher(body: VoucherIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.vouchers.create(actor, body.model_dump())


@router.patch("/vouchers/{voucher_id}", summary="Ubah atau nonaktifkan voucher")
def update_voucher(
    voucher_id: int, body: VoucherUpdateIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)
):
    return c.vouchers.update(actor, voucher_id, body.model_dump(exclude_unset=True))


@router.delete("/vouchers/{voucher_id}", status_code=204, summary="Hapus voucher yang belum pernah dipakai")
def delete_voucher(voucher_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    c.vouchers.delete(actor, voucher_id)


@router.get("/settings", summary="Pengaturan tarif pajak")
def get_settings(actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.settings_service.get()


@router.put("/settings/tax", summary="Ubah tarif pajak (dipakai setelah diskon)")
def set_tax(body: TaxIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.settings_service.set_tax_rate(actor, body.tax_rate_percent)


@router.get("/deposits", summary="Daftar deposit member per gedung (BE-28)")
def list_deposits(
    building_id: int | None = None,
    status: DepositStatus | None = None,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    return c.finance.list_deposits(actor, building_id, status)


@router.post("/deposits", status_code=201, summary="Catat deposit, misalnya kunci loker (BE-28)")
def add_deposit(body: DepositIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.finance.add_deposit(actor, body.model_dump())


@router.post("/deposits/{deposit_id}/return", summary="Kembalikan deposit")
def return_deposit(deposit_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.finance.return_deposit(actor, deposit_id)


@router.get("/arrears", summary="Daftar tunggakan, bisa disaring per gedung (BE-28)")
def list_arrears(
    building_id: int | None = None,
    overdue_only: bool = False,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    return c.finance.list_arrears(actor, building_id, overdue_only)


@router.post("/arrears", status_code=201, summary="Catat tagihan tertunggak member (BE-28)")
def add_arrear(body: ArrearIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.finance.add_arrear(actor, body.model_dump())


@router.post("/arrears/{arrear_id}/settle", summary="Tandai tunggakan lunas")
def settle_arrear(arrear_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.finance.settle_arrear(actor, arrear_id)
