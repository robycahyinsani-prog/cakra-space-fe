from datetime import date, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from app.core.clock import clock
from app.core.config import Settings
from app.core.errors import Conflict, Invalid, NotFound
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.integrations.documents import TableExporter
from app.integrations.mailer import Mailer
from app.models.account import User
from app.models.enums import (
    AccessResult,
    AreaStatus,
    BookingStatus,
    ExportFormat,
    ExportStatus,
    InvoiceStatus,
    RefundStatus,
    ReportKind,
    SubscriptionStatus,
)
from app.models.operations import ReportExport
from app.services.access import AccessService
from app.services.access_control import AccessControl
from app.services.locations import Schedule


def months_between(start: date, end: date) -> list[str]:
    hasil, cur = [], date(start.year, start.month, 1)
    while cur <= end:
        hasil.append(f"{cur:%Y-%m}")
        cur = date(cur.year + (cur.month == 12), cur.month % 12 + 1, 1)
    return hasil


def month_end(key: str) -> date:
    tahun, bulan = map(int, key.split("-"))
    awal_berikut = date(tahun + (bulan == 12), bulan % 12 + 1, 1)
    return awal_berikut - timedelta(days=1)


class ReportService:
    """Dashboard pengelola: ringkasan (BE-44), pendapatan (BE-45), member dan churn (BE-46)."""

    def __init__(self, store: JsonStore, settings: Settings, acl: AccessControl):
        self.store = store
        self.settings = settings
        self.acl = acl

    def summary(self, actor: User, building_id: int | None, day: date | None) -> dict:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "reports.view")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            buildings = [b for b in tx.buildings.all() if gedung is None or b.id in gedung]
            hasil = [self._summary_one(tx, b, day or clock.local_today(b.timezone)) for b in buildings]
        total_tersedia = sum(r["available_hours"] for r in hasil)
        total_terisi = sum(r["booked_hours"] for r in hasil)
        return {
            "date": day or clock.local_today(self.settings.timezone),
            "buildings": sorted(hasil, key=lambda r: r["building_name"]),
            "total": {
                "bookings": sum(r["bookings"] for r in hasil),
                "check_ins": sum(r["check_ins"] for r in hasil),
                "booked_hours": total_terisi,
                "available_hours": total_tersedia,
                "occupancy_percent": round(total_terisi * 100 / total_tersedia, 1) if total_tersedia else 0.0,
            },
        }

    def _summary_one(self, tx: Tables, building, day: date) -> dict:
        buka = Schedule.opening(tx, building, day)
        areas = tx.areas.where(building_id=building.id, status=AreaStatus.AVAILABLE)
        tersedia = ((buka[1] - buka[0]).total_seconds() / 3600 * len(areas)) if buka else 0
        awal = clock.combine(day, time(0), building.timezone)
        akhir = awal + timedelta(days=1)
        bookings = tx.bookings.where(
            lambda b: b.overlaps(awal, akhir), building_id=building.id, status=BookingStatus.CONFIRMED
        )
        terisi = sum((min(b.end_at, akhir) - max(b.start_at, awal)).total_seconds() / 3600 for b in bookings)
        check_in = tx.access_logs.count(
            lambda log: awal <= log.scanned_at < akhir, building_id=building.id, result=AccessResult.GRANTED
        )
        return {
            "building_id": building.id,
            "building_name": building.name,
            "date": day,
            "bookings": len(bookings),
            "check_ins": check_in,
            "booked_hours": round(terisi, 1),
            "available_hours": round(tersedia, 1),
            "occupancy_percent": round(terisi * 100 / tersedia, 1) if tersedia else 0.0,
        }

    def revenue(self, actor: User, date_from: date, date_to: date, building_id: int | None) -> dict:
        """Pendapatan dari pembayaran lunas dikurangi refund (AC K5-US-009.2)."""
        if date_to < date_from:
            raise Invalid("Tanggal akhir harus setelah tanggal awal")
        tz = ZoneInfo(self.settings.timezone)
        with self.store.read() as tx:
            self.acl.require(tx, actor, "reports.view")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            nama = {b.id: b.name for b in tx.buildings.all()}
            baris: dict[tuple, dict] = {}

            def slot(bid, tanggal):
                key = (bid, f"{tanggal:%Y-%m}")
                return baris.setdefault(
                    key,
                    {
                        "building_id": bid,
                        "building_name": nama.get(bid, "Membership"),
                        "month": key[1],
                        "gross": 0,
                        "refunds": 0,
                        "net": 0,
                    },
                )

            for inv in tx.invoices.where(
                lambda i: i.paid_at is not None and i.status in (InvoiceStatus.PAID, InvoiceStatus.REFUNDED)
            ):
                tanggal = inv.paid_at.astimezone(tz).date()
                if not date_from <= tanggal <= date_to or not self._in_scope(inv.building_id, gedung):
                    continue
                slot(inv.building_id, tanggal)["gross"] += inv.total
            for r in tx.refunds.where(lambda r: r.decided_at is not None, status=RefundStatus.PROCESSED):
                tanggal = r.decided_at.astimezone(tz).date()
                if not date_from <= tanggal <= date_to or not self._in_scope(r.building_id, gedung):
                    continue
                slot(r.building_id, tanggal)["refunds"] += r.amount
        for row in baris.values():
            row["net"] = row["gross"] - row["refunds"]
        rows = sorted(baris.values(), key=lambda r: (r["month"], r["building_name"]))
        return {
            "date_from": date_from,
            "date_to": date_to,
            "rows": rows,
            "total_net": sum(r["net"] for r in rows),
            "months": months_between(date_from, date_to),
        }

    @staticmethod
    def _in_scope(building_id: int | None, gedung: set[int] | None) -> bool:
        # invoice membership (tanpa gedung) hanya masuk laporan pengelola pusat
        if gedung is None:
            return True
        return building_id is not None and building_id in gedung

    def members(
        self, actor: User, date_from: date, date_to: date, plan_id: int | None, building_id: int | None
    ) -> dict:
        """Member baru, aktif dan berhenti per bulan. Berhenti = habis dan tidak diperpanjang 7 hari."""
        today = clock.local_today(self.settings.timezone)
        with self.store.read() as tx:
            self.acl.require(tx, actor, "reports.view")
            self.acl.filter_buildings(tx, actor, building_id)
            plans = {
                p.id: p
                for p in tx.plans.all()
                if (plan_id is None or p.id == plan_id) and (building_id is None or p.covers(building_id))
            }
            subs = [
                s
                for s in tx.subscriptions.all()
                if s.plan_id in plans and s.start_date and s.status != SubscriptionStatus.CANCELLED
            ]
            semua_sub = tx.subscriptions.all()
        rows = []
        for bulan in months_between(date_from, date_to):
            akhir = min(month_end(bulan), today)
            awal = date(int(bulan[:4]), int(bulan[5:]), 1)
            for pid, plan in sorted(plans.items()):
                milik = [s for s in subs if s.plan_id == pid]
                baru = sum(1 for s in milik if awal <= s.start_date <= akhir)
                aktif = sum(1 for s in milik if s.start_date <= akhir <= s.end_date)
                berhenti = sum(
                    1
                    for s in milik
                    if awal <= s.end_date <= akhir
                    and s.end_date + timedelta(days=self.settings.churn_grace_days) <= today
                    and not self._renewed(s, semua_sub)
                )
                rows.append(
                    {
                        "month": bulan,
                        "plan_id": pid,
                        "plan_name": plan.name,
                        "new": baru,
                        "active": aktif,
                        "churned": berhenti,
                    }
                )
        return {"date_from": date_from, "date_to": date_to, "rows": rows}

    def _renewed(self, sub, semua) -> bool:
        batas = sub.end_date + timedelta(days=self.settings.churn_grace_days)
        return any(
            s.user_id == sub.user_id and s.id != sub.id and s.start_date and sub.end_date < s.start_date <= batas
            for s in semua
        )

    def bookings(self, actor: User, date_from: date, date_to: date, building_id: int | None) -> list[dict]:
        tz = ZoneInfo(self.settings.timezone)
        with self.store.read() as tx:
            self.acl.require(tx, actor, "reports.view")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            hasil = []
            for b in tx.bookings.where(lambda b: gedung is None or b.building_id in gedung):
                tanggal = b.start_at.astimezone(tz).date()
                if not date_from <= tanggal <= date_to:
                    continue
                area = tx.areas.get(b.area_id)
                member = tx.users.get(b.user_id)
                hasil.append(
                    {
                        "code": b.code,
                        "date": tanggal,
                        "start": b.start_at.astimezone(tz).strftime("%H:%M"),
                        "end": b.end_at.astimezone(tz).strftime("%H:%M"),
                        "building_id": b.building_id,
                        "area": area.name if area else "",
                        "member": member.name if member else "",
                        "status": b.status,
                        "total": b.total,
                    }
                )
            return sorted(hasil, key=lambda r: (r["date"], r["start"]))


class ExportService:
    """Ekspor laporan ke xlsx dan PDF di latar belakang (BE-47)."""

    def __init__(
        self,
        store: JsonStore,
        settings: Settings,
        acl: AccessControl,
        reports: ReportService,
        access: AccessService,
        mailer: Mailer,
    ):
        self.store = store
        self.settings = settings
        self.acl = acl
        self.reports = reports
        self.access = access
        self.mailer = mailer
        self.exporter = TableExporter()

    def create(self, actor: User, report: ReportKind, fmt: ExportFormat, filters: dict) -> ReportExport:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "reports.view")
            # pengelola lokasi hanya bisa mengekspor data gedungnya (AC K5-US-009.4)
            self.acl.filter_buildings(tx, actor, filters.get("building_id"))
            return tx.report_exports.add(
                ReportExport(requested_by=actor.id, report=report, format=fmt, filters=filters)
            )

    def run(self, export_id: int) -> None:
        with self.store.read() as tx:
            job = tx.report_exports.require(export_id)
            actor = tx.users.require(job.requested_by)
        try:
            judul, headers, rows = self._rows(actor, job.report, job.filters)
            konten = (
                self.exporter.xlsx(judul, headers, rows)
                if job.format == ExportFormat.XLSX
                else self.exporter.pdf(judul, headers, rows)
            )
            self.settings.export_dir.mkdir(parents=True, exist_ok=True)
            nama = f"{job.report}-{job.id}-{clock.now():%Y%m%d%H%M}.{job.format}"
            (self.settings.export_dir / nama).write_bytes(konten)
            besar = len(rows) >= self.settings.export_email_threshold
            with self.store.write() as tx:
                tx.report_exports.update(
                    job.id,
                    status=ExportStatus.DONE,
                    filename=nama,
                    row_count=len(rows),
                    finished_at=clock.now(),
                    emailed=besar,
                )
                if besar:
                    # ekspor besar dikirim tautannya lewat email
                    self.mailer.send(
                        tx,
                        actor.email,
                        f"Ekspor {judul} siap",
                        f"Unduh di {self.settings.frontend_url}/reports/exports/{job.id}",
                        "report_export",
                        actor.id,
                    )
        except Exception as exc:  # noqa: BLE001 - status gagal dicatat supaya pengguna tahu
            with self.store.write() as tx:
                tx.report_exports.update(
                    job.id, status=ExportStatus.FAILED, error=str(exc)[:300], finished_at=clock.now()
                )

    def get(self, actor: User, export_id: int) -> ReportExport:
        with self.store.read() as tx:
            job = tx.report_exports.get(export_id)
        if job is None or job.requested_by != actor.id:
            raise NotFound("Ekspor tidak ditemukan")
        return job

    def file(self, actor: User, export_id: int) -> tuple[Path, str]:
        job = self.get(actor, export_id)
        if job.status != ExportStatus.DONE:
            raise Conflict("Ekspor belum selesai")
        return self.settings.export_dir / job.filename, job.filename

    def _rows(self, actor: User, report: ReportKind, f: dict) -> tuple[str, list[str], list[list]]:
        awal = date.fromisoformat(f["date_from"])
        akhir = date.fromisoformat(f["date_to"])
        gedung = f.get("building_id")
        if report == ReportKind.REVENUE:
            data = self.reports.revenue(actor, awal, akhir, gedung)["rows"]
            return (
                "Laporan Pendapatan",
                ["Bulan", "Gedung", "Kotor", "Refund", "Bersih"],
                [[r["month"], r["building_name"], r["gross"], r["refunds"], r["net"]] for r in data],
            )
        if report == ReportKind.MEMBERS:
            data = self.reports.members(actor, awal, akhir, f.get("plan_id"), gedung)["rows"]
            return (
                "Laporan Member",
                ["Bulan", "Paket", "Baru", "Aktif", "Berhenti"],
                [[r["month"], r["plan_name"], r["new"], r["active"], r["churned"]] for r in data],
            )
        if report == ReportKind.BOOKINGS:
            data = self.reports.bookings(actor, awal, akhir, gedung)
            return (
                "Laporan Booking",
                ["Kode", "Tanggal", "Mulai", "Selesai", "Area", "Member", "Status", "Total"],
                [
                    [r["code"], str(r["date"]), r["start"], r["end"], r["area"], r["member"], r["status"], r["total"]]
                    for r in data
                ],
            )
        data = self.access.logs(actor, gedung, awal, akhir, None, None)
        tz = ZoneInfo(self.settings.timezone)
        return (
            "Log Akses",
            ["Waktu", "Gedung", "Nama", "Hasil", "Alasan"],
            [
                [
                    r["scanned_at"].astimezone(tz).strftime("%Y-%m-%d %H:%M"),
                    r["building_name"],
                    r["member_name"] or r["guest_name"] or "",
                    r["result"],
                    r["reason"],
                ]
                for r in data
            ],
        )
