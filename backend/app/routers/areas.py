from fastapi import APIRouter, Depends, Query

from app.container import Container
from app.core.deps import get_container, optional_user, staff_user
from app.models.account import User
from app.models.enums import AreaType
from app.schemas.locations import AreaIn, AreaStatusIn, AreaUpdateIn, FacilityIdsIn, PositionIn

router = APIRouter(prefix="/api/v1", tags=["areas"])

@router.get("/buildings/{building_id}/areas", summary="Daftar meja dan ruang rapat di gedung (BE-11)")
def list_areas(building_id: int, type: AreaType | None = None, floor_id: int | None = None,
               min_capacity: int | None = Query(None, ge=1), user: User | None = Depends(optional_user),
               c: Container = Depends(get_container)):
    return c.areas.list(user, building_id, type, floor_id, min_capacity)

@router.get("/areas/{area_id}", summary="Detail area beserta fasilitas")
def area_detail(area_id: int, user: User | None = Depends(optional_user), c: Container = Depends(get_container)):
    return c.areas.detail(user, area_id)

@router.post("/areas", status_code=201, summary="Tambah hot desk, dedicated desk atau ruang rapat (BE-11, BE-12)")
def create_area(body: AreaIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.areas.create(actor, body.model_dump())

@router.patch("/areas/{area_id}", summary="Ubah area, harga dan kapasitas (BE-12)")
def update_area(area_id: int, body: AreaUpdateIn, actor: User = Depends(staff_user),
                c: Container = Depends(get_container)):
    return c.areas.update(actor, area_id, body.model_dump(exclude_unset=True))

@router.delete("/areas/{area_id}", status_code=204, summary="Hapus area tanpa riwayat booking")
def delete_area(area_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    c.areas.delete(actor, area_id)

@router.put("/areas/{area_id}/facilities", summary="Set fasilitas area seperti proyektor dan TV (BE-12)")
def set_area_facilities(area_id: int, body: FacilityIdsIn, actor: User = Depends(staff_user),
                        c: Container = Depends(get_container)):
    return c.areas.set_facilities(actor, area_id, body.facility_ids)

@router.put("/areas/{area_id}/status", summary="Tandai area Tersedia, Perawatan atau Nonaktif (BE-13)")
def set_area_status(area_id: int, body: AreaStatusIn, actor: User = Depends(staff_user),
                    c: Container = Depends(get_container)):
    return c.areas.set_status(actor, area_id, body.status, body.reason)

@router.put("/areas/{area_id}/position", summary="Posisi titik area di denah (BE-14)")
def set_position(area_id: int, body: PositionIn, actor: User = Depends(staff_user),
                 c: Container = Depends(get_container)):
    return c.areas.set_position(actor, area_id, body.pos_x, body.pos_y)
