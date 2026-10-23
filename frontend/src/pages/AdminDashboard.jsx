import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck, DoorOpen, Clock, Gauge, CircleCheck, CircleX, QrCode } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import BuildingManager from "../components/manage/BuildingManager";
import AreaManager from "../components/manage/AreaManager";
import PlanManager from "../components/manage/PlanManager";
import VoucherManager from "../components/manage/VoucherManager";
import DeviceManager from "../components/manage/DeviceManager";
import AccessLogSection from "../components/manage/AccessLogSection";
import ReportSection from "../components/manage/ReportSection";
import FinanceManager from "../components/manage/FinanceManager";
import StaffAndAnnouncementManager from "../components/manage/StaffAndAnnouncementManager";
import useResource from "../hooks/useResource";
import { useAuth } from "../context/AuthContext";
import Format from "../utils/Format";
import { AREA_TYPES } from "../utils/labels";
import { api } from "../api";

// setiap bagian hanya tampil kalau peran staf punya hak aksesnya (BE-33)
export default function AdminDashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const can = (permission) => Boolean(user?.permissions?.includes(permission));

  const buildings = useResource(() => api.buildings.list(), []);
  const [buildingId, setBuildingId] = useState(null);
  // pengelola pusat melihat semua gedung, staf lain hanya gedung tugasnya
  const pilihan = (buildings.data || []).filter(
    (b) => user.role === "central_manager" || user.building_ids.includes(b.id)
  );
  const aktif = pilihan.some((b) => b.id === buildingId) ? buildingId : (pilihan[0]?.id ?? null);
  const gedung = pilihan.find((b) => b.id === aktif);

  const tabs = [
    { key: "operasional", label: "Operasional", show: true },
    {
      key: "gedung",
      label: "Gedung & Area",
      show: can("buildings.manage") || can("buildings.edit") || can("areas.manage"),
    },
    {
      key: "promo",
      label: "Membership & Voucher",
      show: can("plans.manage") || can("vouchers.manage"),
    },
    {
      key: "keuangan",
      label: "Keuangan & Pajak",
      show: can("finance.manage") || can("settings.manage"),
    },
    {
      key: "akses",
      label: "Perangkat & Log Akses",
      show: can("devices.manage") || can("access.logs"),
    },
    {
      key: "laporan",
      label: "Laporan & Ekspor",
      show: can("reports.view"),
    },
    {
      key: "staf",
      label: "Pengumuman & Staf",
      show: can("announcements.manage") || can("staff.manage"),
    },
  ].filter((t) => t.show);

  const tabParam = params.get("tab");
  const activeTab = tabs.some((t) => t.key === tabParam) ? tabParam : tabs[0].key;

  const gantiTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === "operasional") next.delete("tab");
    else next.set("tab", key);
    setParams(next, { replace: true });
  };

  const muatUlangGedung = (pilihId) => {
    if (pilihId !== undefined) setBuildingId(pilihId);
    buildings.reload();
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brown-900">Dashboard Pengelola</h1>
            <p className="text-brown-600 mt-1">
              {user?.name} · {user?.role_name}
            </p>
          </div>
          {pilihan.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-brown-600">Gedung:</span>
              <select
                value={aktif ?? ""}
                onChange={(e) => setBuildingId(Number(e.target.value))}
                aria-label="Pilih gedung"
                className="px-3 py-2 border border-tan-300 rounded-lg bg-white text-brown-900 text-sm focus:outline-none focus:ring-2 focus:ring-tan-300"
              >
                {pilihan.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {tabs.length > 1 && (
          <div className="flex flex-wrap border-b border-cream-200 gap-1" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => gantiTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.key
                    ? "border-brown-500 text-brown-600"
                    : "border-transparent text-brown-600 hover:text-brown-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "operasional" && (
          <div className="space-y-8">
            {can("reports.view") && <OperationalSummary />}
            {can("access.scan") && aktif && <AccessCheck buildingId={aktif} buildingName={gedung?.name} />}
            <PageState loading={buildings.loading} error={buildings.error} onRetry={buildings.reload}>
              {aktif && can("bookings.calendar") && <BookingList buildingId={aktif} days={7} canSwitchRange />}
              {aktif && !can("bookings.calendar") && can("bookings.today") && (
                <BookingList buildingId={aktif} days={1} />
              )}
            </PageState>
            {can("refunds.manage") && <RefundQueue />}
          </div>
        )}

        {activeTab === "gedung" && (
          <div className="space-y-8">
            {(can("buildings.manage") || can("buildings.edit")) && (
              <BuildingManager
                buildingId={aktif}
                canManage={can("buildings.manage")}
                canEdit={can("buildings.edit")}
                onBuildingsChange={muatUlangGedung}
              />
            )}
            {can("areas.manage") && aktif && <AreaManager buildingId={aktif} />}
          </div>
        )}

        {activeTab === "promo" && (
          <div className="space-y-8">
            {can("plans.manage") && <PlanManager buildings={pilihan} />}
            {can("vouchers.manage") && <VoucherManager buildings={pilihan} />}
          </div>
        )}

        {activeTab === "keuangan" && (
          <FinanceManager
            buildingId={aktif}
            canManageFinance={can("finance.manage")}
            canManageSettings={can("settings.manage")}
          />
        )}

        {activeTab === "akses" && (
          <div className="space-y-8">
            {can("devices.manage") && aktif && (
              <DeviceManager buildingId={aktif} canCommand={can("devices.command")} />
            )}
            {can("access.logs") && aktif && <AccessLogSection buildingId={aktif} />}
          </div>
        )}

        {activeTab === "laporan" && can("reports.view") && <ReportSection buildings={pilihan} />}

        {activeTab === "staf" && (
          <StaffAndAnnouncementManager
            buildingId={aktif}
            buildings={pilihan}
            canManageAnnouncements={can("announcements.manage")}
            canManageStaff={can("staff.manage")}
          />
        )}
      </div>
    </div>
  );
}

// ringkasan operasional hari ini per gedung (BE-44)
function OperationalSummary() {
  const { data, error, loading, reload } = useResource(() => api.manage.summary(), []);
  return (
    <section>
      <h2 className="text-lg font-semibold text-brown-900 mb-3">Hari Ini</h2>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <Kpi icon={CalendarCheck} label="Booking" value={data.total.bookings} />
              <Kpi icon={DoorOpen} label="Check-in" value={data.total.check_ins} />
              <Kpi icon={Clock} label="Jam Terpakai" value={`${data.total.booked_hours} jam`} />
              <Kpi icon={Gauge} label="Okupansi" value={`${data.total.occupancy_percent}%`} />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-cream-50 text-brown-800">
                    <th className="p-3 font-semibold">Gedung</th>
                    <th className="p-3 font-semibold text-right">Booking</th>
                    <th className="p-3 font-semibold text-right">Check-in</th>
                    <th className="p-3 font-semibold text-right">Jam Terpakai</th>
                    <th className="p-3 font-semibold text-right">Okupansi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {data.buildings.map((b) => (
                    <tr key={b.building_id}>
                      <td className="p-3 text-brown-900">{b.building_name}</td>
                      <td className="p-3 text-right tabular-nums">{b.bookings}</td>
                      <td className="p-3 text-right tabular-nums">{b.check_ins}</td>
                      <td className="p-3 text-right tabular-nums">
                        {b.booked_hours} / {b.available_hours}
                      </td>
                      <td className="p-3 text-right tabular-nums">{b.occupancy_percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PageState>
    </section>
  );
}

// validasi QR member atau tamu di meja resepsionis; pemindai QR USB mengetik token ke input ini
function AccessCheck({ buildingId, buildingName }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState(null);

  const periksa = async (e) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    try {
      setHasil(await api.manage.validateAccess(token.trim(), buildingId));
      setToken("");
    } catch (err) {
      setHasil({ result: "error", reason: err.message });
    } finally {
      setBusy(false);
    }
  };

  const diizinkan = hasil?.result === "granted";
  return (
    <section>
      <h2 className="text-lg font-semibold text-brown-900 mb-3">Validasi QR Akses</h2>
      <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
        <form onSubmit={periksa} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <QrCode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brown-500" />
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={`Pindai atau ketik token QR di ${buildingName || "gedung ini"}`}
              aria-label="Token QR"
              className="w-full pl-9 pr-3 py-2 text-sm border border-tan-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-tan-300"
            />
          </div>
          <Button type="submit" loading={busy} disabled={!token.trim()}>
            Periksa
          </Button>
        </form>
        {hasil && (
          <div
            className={`mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${
              diizinkan ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-900"
            }`}
            role="status"
          >
            {diizinkan ? <CircleCheck size={20} className="flex-none" /> : <CircleX size={20} className="flex-none" />}
            <div>
              <p className="font-semibold">
                {diizinkan ? "Akses diizinkan" : "Akses ditolak"}
                {hasil.name ? ` · ${hasil.name}` : ""}
              </p>
              <p>{hasil.reason}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// booking satu gedung: 7 hari ke depan (BE-21) atau hari ini saja untuk resepsionis
function BookingList({ buildingId, days: initialDays, canSwitchRange = false }) {
  const [rangeDays, setRangeDays] = useState(initialDays);
  const [floorId, setFloorId] = useState("");
  const [areaType, setAreaType] = useState("");

  const activeDays = canSwitchRange ? rangeDays : initialDays;
  const today = new Date();
  const dari = Format.isoDate(today);
  const sampai = Format.isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + activeDays - 1));

  const buildingDetail = useResource(() => api.buildings.detail(buildingId), [buildingId]);
  const floors = buildingDetail.data?.floors || [];

  const { data, error, loading, reload } = useResource(
    () =>
      !canSwitchRange && activeDays === 1
        ? api.manage.bookingsToday(buildingId)
        : api.manage.bookings(buildingId, dari, sampai),
    [buildingId, activeDays, dari, sampai, canSwitchRange]
  );

  const rawItems = data?.items || [];
  const items = rawItems.filter((b) => {
    if (floorId && String(b.area?.floor_id) !== String(floorId)) return false;
    if (areaType && b.area?.area_type !== areaType) return false;
    return true;
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-brown-900">
          {activeDays === 1 ? "Booking Hari Ini" : `Booking ${activeDays} Hari ke Depan`}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {canSwitchRange && (
            <div className="inline-flex rounded-lg border border-tan-300 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setRangeDays(1)}
                className={`px-3 py-1.5 font-medium ${
                  activeDays === 1 ? "bg-brown-500 text-white" : "text-brown-700 hover:bg-cream-50"
                }`}
              >
                Harian
              </button>
              <button
                type="button"
                onClick={() => setRangeDays(7)}
                className={`px-3 py-1.5 font-medium ${
                  activeDays === 7 ? "bg-brown-500 text-white" : "text-brown-700 hover:bg-cream-50"
                }`}
              >
                Mingguan (7 Hari)
              </button>
            </div>
          )}
          {floors.length > 0 && (
            <select
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
              aria-label="Filter lantai"
              className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white text-brown-900"
            >
              <option value="">Semua Lantai</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={areaType}
            onChange={(e) => setAreaType(e.target.value)}
            aria-label="Filter tipe area"
            className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white text-brown-900"
          >
            <option value="">Semua Tipe Area</option>
            {Object.entries(AREA_TYPES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <PageState loading={loading} error={error} onRetry={reload}>
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-cream-50 text-brown-800">
                <th className="p-3 font-semibold">Kode</th>
                <th className="p-3 font-semibold">Member</th>
                <th className="p-3 font-semibold">Ruang</th>
                <th className="p-3 font-semibold">Jadwal</th>
                <th className="p-3 font-semibold text-right">Total</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-brown-500">
                    Belum ada booking pada periode dan filter ini.
                  </td>
                </tr>
              ) : (
                items.map((b) => (
                  <tr key={b.id} className="hover:bg-cream-50 transition-colors">
                    <td className="p-3 font-medium text-brown-900 whitespace-nowrap">{b.code}</td>
                    <td className="p-3 text-brown-700">
                      {b.member?.name}
                      <br />
                      <span className="text-xs text-brown-500">{b.member?.email}</span>
                    </td>
                    <td className="p-3 text-brown-700">
                      {b.area.name}
                      <span className="block text-xs text-brown-500">
                        {AREA_TYPES[b.area.area_type] || b.area.area_type}
                      </span>
                    </td>
                    <td className="p-3 text-brown-700 whitespace-nowrap">
                      {Format.shortDate(b.local_date)}
                      <br />
                      <span className="text-xs">
                        {Format.clock(b.local_start)}-{Format.clock(b.local_end)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium text-brown-900 whitespace-nowrap">{Format.rupiah(b.total)}</td>
                    <td className="p-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}

// antrean refund yang menunggu keputusan atau seluruh riwayat refund (BE-27)
function RefundQueue() {
  const [filterStatus, setFilterStatus] = useState("requested");
  const { data, error, loading, reload } = useResource(() => api.manage.refunds(), []);
  const daftar = (data || []).filter((r) => !filterStatus || r.status === filterStatus);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-brown-900">Manajemen Pengajuan Refund</h2>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter status refund"
          className="px-3 py-1.5 text-sm border border-tan-300 rounded-lg bg-white text-brown-900"
        >
          <option value="requested">Menunggu Persetujuan</option>
          <option value="">Semua Status</option>
          <option value="processed">Diproses / Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>
      <PageState loading={loading} error={error} onRetry={reload}>
        {daftar.length === 0 ? (
          <p className="text-brown-600 bg-white rounded-xl border border-cream-200 p-6 text-center text-sm">
            Tidak ada pengajuan refund pada filter ini.
          </p>
        ) : (
          <div className="space-y-3">
            {daftar.map((r) => (
              <RefundItem key={r.id} refund={r} onDone={reload} />
            ))}
          </div>
        )}
      </PageState>
    </section>
  );
}

function RefundItem({ refund, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const jalankan = async (aksi) => {
    setBusy(true);
    setError(null);
    try {
      await aksi();
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-brown-900">
              {refund.member_name} · {refund.booking_code}
            </p>
            <StatusBadge status={refund.status} />
          </div>
          <p className="text-brown-700 mt-1">
            {Format.rupiah(refund.amount)} ({refund.percent}%) · {refund.reason}
          </p>
          {refund.note && (
            <p className="text-xs text-brown-600 mt-1">Catatan pengelola: {refund.note}</p>
          )}
          <p className="text-xs text-brown-500 mt-1">Diajukan {Format.dateTime(refund.created_at)}</p>
        </div>
        {refund.status === "requested" && !rejecting && (
          <div className="flex gap-2">
            <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setRejecting(true)}>
              Tolak
            </Button>
            <Button className="text-sm" loading={busy} onClick={() => jalankan(() => api.manage.approveRefund(refund.id))}>
              Setujui
            </Button>
          </div>
        )}
      </div>
      {rejecting && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Alasan penolakan (minimal 3 karakter)"
            aria-label="Alasan penolakan"
            className="flex-1 px-3 py-2 text-sm border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
          />
          <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setRejecting(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            className="text-sm"
            loading={busy}
            disabled={note.trim().length < 3}
            onClick={() => jalankan(() => api.manage.rejectRefund(refund.id, note.trim()))}
          >
            Tolak Refund
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-700 mt-2">{error.message}</p>}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-cream-50 rounded-full flex items-center justify-center flex-none">
        <Icon className="text-brown-600" size={20} />
      </div>
      <div>
        <p className="text-sm text-brown-600">{label}</p>
        <p className="text-xl font-bold text-brown-900">{value}</p>
      </div>
    </div>
  );
}
