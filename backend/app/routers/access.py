from datetime import date

from fastapi import APIRouter, Depends, Header
from fastapi.responses import Response

from app.container import Container
from app.core.deps import get_container, staff_user
from app.core.errors import Invalid
from app.models.account import User
from app.models.enums import AccessResult
from app.schemas.commerce import ValidateIn

router = APIRouter(prefix="/api/v1", tags=["access"])

@router.post("/access/validate", summary="Validasi QR member atau tamu dari perangkat pintu atau resepsionis (BE-30)")
def validate(body: ValidateIn, x_device_key: str | None = Header(default=None),
             c: Container = Depends(get_container), authorization: str | None = Header(default=None)):
    if x_device_key:
        device = c.devices.authenticate(x_device_key)
        return c.access.validate(body.token, device.building_id, body.door, device, None)
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Invalid("Kirim X-Device-Key dari perangkat atau token login resepsionis")
    scanner, _ = c.auth.authenticate(authorization.split(" ", 1)[1])
    c.auth.ensure_password_changed(scanner)
    if body.building_id is None:
        raise Invalid("building_id wajib diisi saat memindai dari aplikasi resepsionis")
    with c.store.read() as tx:
        c.acl.require_building(tx, scanner, "access.scan", body.building_id)
    return c.access.validate(body.token, body.building_id, body.door, None, scanner)

@router.get("/manage/access-logs", summary="Log keluar masuk gedung, bisa disaring per tanggal dan member (BE-32)")
def access_logs(building_id: int | None = None, date_from: date | None = None, date_to: date | None = None,
                user_id: int | None = None, result: AccessResult | None = None,
                actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.access.logs(actor, building_id, date_from, date_to, user_id, result)

@router.get("/manage/access-logs/export", summary="Ekspor log akses ke Excel (BE-32)",
            response_class=Response,
            responses={200: {"content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}}}})
def export_access_logs(building_id: int | None = None, date_from: date | None = None, date_to: date | None = None,
                       user_id: int | None = None, result: AccessResult | None = None,
                       actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    konten, nama = c.access.export_logs(actor, building_id=building_id, date_from=date_from, date_to=date_to,
                                        user_id=user_id, result=result)
    return Response(konten, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{nama}"'})
