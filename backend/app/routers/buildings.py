from datetime import date, datetime, time

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse

from app.container import Container
from app.core.deps import get_container, optional_user, staff_user
from app.models.account import User
from app.models.enums import AreaType, FacilityScope
from app.schemas.locations import (
    BuildingIn,
    BuildingStatusIn,
    BuildingUpdateIn,
    FacilityIdsIn,
    FacilityIn,
    FloorIn,
    FloorUpdateIn,
    HolidayIn,
    HoursIn,
    RefundPolicyIn,
)

router = APIRouter(prefix="/api/v1", tags=["buildings"])

@router.get("/buildings", summary="Daftar gedung, member hanya melihat gedung Aktif")
def list_buildings(city: str | None = None, q: str | None = None, user: User | None = Depends(optional_user),
                   c: Container = Depends(get_container)):
    return c.buildings.list(user, city, q)

@router.get("/buildings/{building_id}", summary="Detail gedung: jam buka, hari libur, lantai dan fasilitas")
def building_detail(building_id: int, user: User | None = Depends(optional_user),
                    c: Container = Depends(get_container)):
    return c.buildings.detail(user, building_id)

@router.post("/buildings", status_code=201, summary="Tambah gedung, tersimpan sebagai Draf (BE-08)")
def create_building(body: BuildingIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.buildings.create(actor, body.model_dump())

@router.patch("/buildings/{building_id}", summary="Ubah data gedung (BE-08)")
def update_building(building_id: int, body: BuildingUpdateIn, actor: User = Depends(staff_user),
                    c: Container = Depends(get_container)):
    return c.buildings.update(actor, building_id, body.model_dump(exclude_unset=True))

@router.put("/buildings/{building_id}/status", summary="Aktifkan atau nonaktifkan gedung (BE-08)")
def set_building_status(building_id: int, body: BuildingStatusIn, actor: User = Depends(staff_user),
                        c: Container = Depends(get_container)):
    return c.buildings.set_status(actor, building_id, body.status)

@router.delete("/buildings/{building_id}", status_code=204, summary="Hapus gedung tanpa riwayat booking")
def delete_building(building_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    c.buildings.delete(actor, building_id)

@router.put("/buildings/{building_id}/refund-policy", summary="Batas batal dan aturan refund gedung (BE-26)")
def refund_policy(building_id: int, body: RefundPolicyIn, actor: User = Depends(staff_user),
                  c: Container = Depends(get_container)):
    return c.buildings.set_refund_policy(actor, building_id, body.model_dump())

@router.put("/buildings/{building_id}/operating-hours", summary="Jam operasional tujuh hari (BE-09)")
def set_hours(building_id: int, body: HoursIn, actor: User = Depends(staff_user),
              c: Container = Depends(get_container)):
    return c.buildings.set_hours(actor, building_id, [h.model_dump() for h in body.hours])

@router.post("/buildings/{building_id}/holidays", status_code=201, summary="Tambah hari libur khusus gedung (BE-09)")
def add_holiday(building_id: int, body: HolidayIn, actor: User = Depends(staff_user),
                c: Container = Depends(get_container)):
    return c.buildings.add_holiday(actor, building_id, body.date, body.description)

@router.delete("/holidays/{holiday_id}", status_code=204, summary="Hapus hari libur")
def delete_holiday(holiday_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    c.buildings.delete_holiday(actor, holiday_id)

@router.post("/buildings/{building_id}/floors", status_code=201, summary="Tambah lantai (BE-10)")
def add_floor(building_id: int, body: FloorIn, actor: User = Depends(staff_user),
              c: Container = Depends(get_container)):
    return c.buildings.add_floor(actor, building_id, body.name, body.level)

@router.patch("/floors/{floor_id}", summary="Ubah lantai")
def update_floor(floor_id: int, body: FloorUpdateIn, actor: User = Depends(staff_user),
                 c: Container = Depends(get_container)):
    return c.buildings.update_floor(actor, floor_id, body.model_dump(exclude_unset=True))

@router.delete("/floors/{floor_id}", status_code=204, summary="Hapus lantai yang sudah kosong")
def delete_floor(floor_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    c.buildings.delete_floor(actor, floor_id)

@router.put("/floors/{floor_id}/plan", summary="Unggah gambar denah lantai (BE-14)")
async def upload_plan(floor_id: int, file: UploadFile = File(...), actor: User = Depends(staff_user),
                      c: Container = Depends(get_container)):
    return c.buildings.save_floor_plan(actor, floor_id, await file.read(), file.content_type or "")

@router.get("/floors/{floor_id}/plan", summary="Gambar denah lantai", response_class=FileResponse)
def get_plan(floor_id: int, c: Container = Depends(get_container)):
    path, tipe = c.buildings.floor_plan(floor_id)
    return FileResponse(path, media_type=tipe)

@router.get("/floors/{floor_id}/map", summary="Titik area di denah dengan status Tersedia, Terisi atau Perawatan")
def floor_map(floor_id: int, at: datetime | None = None, user: User | None = Depends(optional_user),
              c: Container = Depends(get_container)):
    return c.areas.floor_map(user, floor_id, at)

@router.get("/facilities", summary="Fasilitas master dan fasilitas khusus satu gedung")
def facilities(scope: FacilityScope | None = None, building_id: int | None = None,
               c: Container = Depends(get_container)):
    return c.buildings.list_facilities(scope, building_id)

@router.post("/facilities", status_code=201, summary="Tambah fasilitas master atau khusus lokasi (BE-10)")
def create_facility(body: FacilityIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.buildings.create_facility(actor, body.name, body.scope, body.building_id)

@router.put("/buildings/{building_id}/facilities", summary="Set fasilitas umum gedung (BE-10)")
def set_building_facilities(building_id: int, body: FacilityIdsIn, actor: User = Depends(staff_user),
                            c: Container = Depends(get_container)):
    return c.buildings.set_facilities(actor, building_id, body.facility_ids)

@router.get("/buildings/{building_id}/availability", tags=["bookings"],
            summary="Cari meja atau ruang rapat kosong (BE-15)")
def availability(building_id: int, date: date, start_time: time | None = None, end_time: time | None = None,
                 type: AreaType | None = None, min_capacity: int | None = Query(None, ge=1),
                 user: User | None = Depends(optional_user), c: Container = Depends(get_container)):
    return c.availability.search(user, building_id, date, start_time, end_time, type, min_capacity)

@router.get("/buildings/{building_id}/slots", tags=["bookings"],
            summary="Grid slot per jam per area untuk halaman booking")
def slots(building_id: int, date: date, type: AreaType | None = None, area_id: int | None = None,
          user: User | None = Depends(optional_user), c: Container = Depends(get_container)):
    return c.availability.slots(user, building_id, date, type, area_id)
