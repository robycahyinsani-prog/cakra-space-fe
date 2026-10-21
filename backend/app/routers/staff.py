from fastapi import APIRouter, Depends

from app.container import Container
from app.core.deps import get_container, staff_user
from app.models.account import User
from app.models.enums import Role
from app.schemas.auth import StaffCreateIn, StaffUpdateIn

router = APIRouter(prefix="/api/v1", tags=["staff"])


@router.post("/staff", status_code=201, summary="Buat akun staf dengan password sementara (BE-07, BE-33)")
def create_staff(body: StaffCreateIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.staff.create(actor, body.name, body.email, body.role, body.building_ids)


@router.get("/staff", summary="Daftar staf beserta peran dan gedung yang dipegang")
def list_staff(role: Role | None = None, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.staff.list(actor, role)


@router.patch("/staff/{user_id}", summary="Ubah nama, peran atau gedung staf (BE-33)")
def update_staff(
    user_id: int, body: StaffUpdateIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)
):
    return c.staff.update(actor, user_id, body.name, body.role, body.building_ids)


@router.post("/staff/{user_id}/reset-password", summary="Buat password sementara baru untuk staf")
def reset_staff_password(user_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.staff.reset_password(actor, user_id)


@router.get("/roles", summary="Matriks peran dan hak akses (BE-33)")
def roles(actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.staff.roles(actor)


@router.get("/members", summary="Cari member untuk form deposit, tunggakan atau laporan")
def members(q: str | None = None, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.staff.members(actor, q)
