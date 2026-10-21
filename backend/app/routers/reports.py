from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse

from app.container import Container
from app.core.deps import get_container, staff_user
from app.models.account import User
from app.schemas.commerce import AnnouncementIn, ExportIn

router = APIRouter(prefix="/api/v1/manage", tags=["manager dashboard"])


@router.get("/reports/summary", summary="Okupansi, booking dan check-in hari ini per gedung (BE-44)")
def summary(
    building_id: int | None = None,
    date: date | None = None,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    return c.reports.summary(actor, building_id, date)


@router.get("/reports/revenue", summary="Pendapatan per gedung per bulan, lunas dikurangi refund (BE-45)")
def revenue(
    date_from: date,
    date_to: date,
    building_id: int | None = None,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    return c.reports.revenue(actor, date_from, date_to, building_id)


@router.get("/reports/members", summary="Member baru, aktif dan berhenti per bulan per paket (BE-46)")
def members(
    date_from: date,
    date_to: date,
    plan_id: int | None = None,
    building_id: int | None = None,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    return c.reports.members(actor, date_from, date_to, plan_id, building_id)


@router.post("/reports/exports", status_code=202, summary="Ekspor laporan ke Excel atau PDF di latar belakang (BE-47)")
def create_export(
    body: ExportIn,
    background: BackgroundTasks,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    filters = body.model_dump(mode="json", exclude={"report", "format"})
    job = c.exports.create(actor, body.report, body.format, filters)
    background.add_task(c.exports.run, job.id)
    return job


@router.get("/reports/exports/{export_id}", summary="Status ekspor")
def export_status(export_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.exports.get(actor, export_id)


@router.get("/reports/exports/{export_id}/download", summary="Unduh hasil ekspor", response_class=FileResponse)
def export_download(export_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    path, nama = c.exports.file(actor, export_id)
    return FileResponse(path, filename=nama)


@router.get("/announcements", tags=["announcements"], summary="Pengumuman gedung yang saya kelola")
def list_announcements(
    building_id: int | None = None, actor: User = Depends(staff_user), c: Container = Depends(get_container)
):
    return c.announcements.list_for_staff(actor, building_id)


@router.post(
    "/announcements",
    status_code=201,
    tags=["announcements"],
    summary="Buat pengumuman untuk gedung, misalnya jadwal perawatan (BE-43)",
)
def create_announcement(body: AnnouncementIn, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.announcements.create(actor, body.building_id, body.title, body.body)


@router.delete("/announcements/{announcement_id}", status_code=204, tags=["announcements"], summary="Hapus pengumuman")
def delete_announcement(announcement_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    c.announcements.delete(actor, announcement_id)


@router.get("/audit-logs", tags=["audit"], summary="Audit log perubahan data oleh staf")
def audit_logs(
    entity: str | None = None,
    entity_id: int | None = None,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    with c.store.read() as tx:
        c.acl.require(tx, actor, "audit.view")
        items = tx.audit_logs.where(
            lambda a: (entity is None or a.entity == entity) and (entity_id is None or a.entity_id == entity_id)
        )
    return sorted(items, key=lambda a: a.id, reverse=True)[:500]
