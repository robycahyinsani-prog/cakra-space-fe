from fastapi import APIRouter, Depends

from app.container import Container
from app.core.deps import get_container, member_user, staff_user
from app.models.account import User
from app.schemas.commerce import FreezeIn, PlanIn, PlanUpdateIn, SubscribeIn

router = APIRouter(prefix="/api/v1", tags=["membership"])

@router.get("/plans", summary="Paket membership yang dijual")
def list_plans(building_id: int | None = None, c: Container = Depends(get_container)):
    return c.membership.list_plans(building_id=building_id)

@router.get("/plans/{plan_id}", summary="Detail paket beserta benefit")
def plan_detail(plan_id: int, c: Container = Depends(get_container)):
    return c.membership.get_plan(plan_id)

@router.get("/manage/plans", summary="Semua paket termasuk yang diarsipkan")
def manage_plans(actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    with c.store.read() as tx:
        c.acl.require(tx, actor, "plans.manage")
    return c.membership.list_plans(include_archived=True)

@router.post("/manage/plans", status_code=201, summary="Buat paket membership dan benefitnya (BE-34)")
def create_plan(body: PlanIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    data = body.model_dump(exclude={"benefits"})
    return c.membership.create_plan(actor, data, [b.model_dump() for b in body.benefits])

@router.patch("/manage/plans/{plan_id}", summary="Ubah paket membership (BE-34)")
def update_plan(plan_id: int, body: PlanUpdateIn, actor: User = Depends(staff_user),
                c: Container = Depends(get_container)):
    data = body.model_dump(exclude_unset=True, exclude={"benefits"})
    benefits = [b.model_dump() for b in body.benefits] if body.benefits is not None else None
    return c.membership.update_plan(actor, plan_id, data, benefits)

@router.delete("/manage/plans/{plan_id}", summary="Hapus paket, atau arsipkan kalau sudah punya pelanggan (BE-34)")
def remove_plan(plan_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.membership.remove_plan(actor, plan_id)

@router.post("/subscriptions", status_code=201,
             summary="Pilih paket, lanjutkan dengan POST /payments purpose=subscription (BE-35)")
def subscribe(body: SubscribeIn, user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.membership.subscribe(user, body.plan_id)

@router.post("/subscriptions/freeze", summary="Bekukan membership maksimal 30 hari per periode (BE-38)")
def freeze(body: FreezeIn, user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.membership.freeze(user, body.start_date, body.days)

@router.post("/subscriptions/unfreeze", summary="Akhiri freeze lebih cepat")
def unfreeze(user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.membership.unfreeze(user)
