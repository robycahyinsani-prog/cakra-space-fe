from typing import Literal

from fastapi import APIRouter, Depends

from app.container import Container
from app.core.deps import cron_auth, get_container
from app.core.errors import NotFound

router = APIRouter(tags=["system"])


@router.get("/api/health", summary="Cek API dan berkas data")
def health(c: Container = Depends(get_container)):
    with c.store.read() as tx:
        jumlah = tx.buildings.count()
    return {"status": "ok", "storage": "json", "buildings": jumlah}


@router.post(
    "/api/v1/internal/jobs/run",
    summary="Jalankan tugas terjadwal, dipanggil cron dengan X-Cron-Secret",
    dependencies=[Depends(cron_auth)],
)
def run_jobs(c: Container = Depends(get_container)):
    return c.jobs.run_all()


@router.post(
    "/api/v1/sandbox/payments/{gateway_ref}/{outcome}",
    tags=["sandbox"],
    summary="Simulasi member membayar di halaman gateway, lalu gateway memanggil webhook",
)
def sandbox_pay(
    gateway_ref: str, outcome: Literal["success", "failed", "expired"], c: Container = Depends(get_container)
):
    return c.payments.sandbox_pay(gateway_ref, outcome)


@router.get("/api/v1/dev/mailbox", tags=["sandbox"], summary="Kotak keluar email simulasi (hanya di development)")
def mailbox(email: str | None = None, limit: int = 20, c: Container = Depends(get_container)):
    if c.settings.is_production:
        raise NotFound("Not Found")
    with c.store.read() as tx:
        items = tx.notifications.where(lambda n: email is None or n.to_email == email.strip().lower())
    return sorted(items, key=lambda n: n.id, reverse=True)[:limit]
