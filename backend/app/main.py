import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.container import Container
from app.core.config import Settings, get_settings
from app.core.deps import limiter
from app.core.errors import AppError
from app.db.json_store import JsonStore
from app.routers import (
    access,
    areas,
    auth,
    bookings,
    buildings,
    devices,
    finance,
    me,
    membership,
    payments,
    reports,
    staff,
    system,
)

log = logging.getLogger("uvicorn.error")

TAGS = [
    {"name": "auth", "description": "Register member, verifikasi email, login JWT, logout, reset password (Epic 1)"},
    {"name": "member dashboard", "description": "Profil, ringkasan, booking, invoice, kuota dan QR member (Epic 8)"},
    {"name": "staff", "description": "Akun staf, peran dan gedung yang dipegang (BE-07, BE-33)"},
    {"name": "buildings", "description": "Gedung, jam operasional, hari libur, lantai, denah, fasilitas (Epic 2)"},
    {"name": "areas", "description": "Meja, ruang rapat, harga, kapasitas, status area (Epic 3)"},
    {"name": "bookings", "description": "Ketersediaan, booking, batal, reschedule, kalender (Epic 4)"},
    {"name": "payments", "description": "Pembayaran, webhook dan invoice (Epic 5)"},
    {"name": "refunds", "description": "Refund booking yang dibatalkan (Epic 5)"},
    {"name": "finance", "description": "Voucher, pajak, deposit dan tunggakan (Epic 5)"},
    {"name": "access", "description": "Validasi QR member dan tamu, log akses (Epic 6)"},
    {"name": "membership", "description": "Paket, berlangganan, upgrade, freeze (Epic 7)"},
    {"name": "manager dashboard", "description": "Ringkasan, pendapatan, laporan member, ekspor (Epic 9)"},
    {"name": "announcements", "description": "Pengumuman gedung"},
    {"name": "devices", "description": "Perangkat pintu, perintah jarak jauh, maintenance (Epic 10)"},
    {"name": "device api", "description": "Endpoint yang dipanggil perangkat dengan header X-Device-Key"},
    {"name": "sandbox", "description": "Simulasi payment gateway dan kotak keluar email"},
    {"name": "system", "description": "Health check dan tugas terjadwal"},
]

def create_app(settings: Settings | None = None, store: JsonStore | None = None) -> FastAPI:
    settings = settings or get_settings()
    container = Container(settings, store)
    container.bootstrap()

    app = FastAPI(
        title="Cakra Space API",
        description="Backend Coworking Space Management, Kelompok 5 SDLC. Data disimpan di berkas JSON.",
        version="1.0.0",
        openapi_tags=TAGS,
    )
    app.state.container = container
    app.state.limiter = limiter

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "X-Device-Key"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        # halaman /docs butuh script dari CDN, CSP ketat hanya untuk respons API
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        return response

    @app.exception_handler(AppError)
    def app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, **exc.extra})

    @app.exception_handler(RateLimitExceeded)
    def rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(status_code=429, headers={"Retry-After": "60"},
                            content={"detail": "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi."})

    @app.exception_handler(Exception)
    def server_error(request: Request, exc: Exception) -> JSONResponse:
        # detail error cukup di log server, tidak dikirim ke klien
        log.exception("error tak terduga di %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Terjadi error di server"})

    for router in (system, auth, me, staff, buildings, areas, bookings, payments, finance, access, membership,
                   reports, devices):
        app.include_router(router.router)
    return app

app = create_app()
