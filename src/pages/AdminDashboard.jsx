import { useState } from "react";
import { CalendarCheck, DoorOpen, Clock, Gauge } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import useResource from "../hooks/useResource";
import { useAuth } from "../context/AuthContext";
import Format from "../utils/Format";
import { api } from "../api";

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-brown-900">Dashboard Pengelola</h1>
          <p className="text-brown-600 mt-1">
            {user?.name} · {user?.role_name}
          </p>
        </div>

        <OperationalSummary />
        <BookingCalendar />
        <RefundQueue />
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

// daftar booking satu gedung untuk 7 hari ke depan (BE-21)
function BookingCalendar() {
  const { user } = useAuth();
  const buildings = useResource(() => api.buildings.list(), []);
  const [buildingId, setBuildingId] = useState(null);

  // pengelola pusat melihat semua gedung, staf lain hanya gedung tugasnya
  const pilihan = (buildings.data || []).filter(
    (b) => user.role === "central_manager" || user.building_ids.includes(b.id)
  );
  const aktif = buildingId ?? pilihan[0]?.id ?? null;
  const today = new Date();
  const dari = Format.isoDate(today);
  const sampai = Format.isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6));

  const bookings = useResource(
    () => (aktif ? api.manage.bookings(aktif, dari, sampai) : Promise.resolve(null)),
    [aktif, dari, sampai]
  );
  const items = bookings.data?.items || [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-brown-900">Booking 7 Hari ke Depan</h2>
        {pilihan.length > 0 && (
          <select
            value={aktif ?? ""}
            onChange={(e) => setBuildingId(Number(e.target.value))}
            aria-label="Pilih gedung"
            className="px-3 py-2 border border-tan-300 rounded-lg bg-white text-brown-900 text-sm focus:outline-none focus:ring-2 focus:ring-tan-300"
          >
            {pilihan.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <PageState loading={buildings.loading || bookings.loading} error={buildings.error || bookings.error} onRetry={bookings.reload}>
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
                    Belum ada booking di periode ini.
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
                    <td className="p-3 text-brown-700">{b.area.name}</td>
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

// antrean refund yang menunggu keputusan (BE-27)
function RefundQueue() {
  const { data, error, loading, reload } = useResource(() => api.manage.refunds(), []);
  const menunggu = (data || []).filter((r) => r.status === "requested");

  return (
    <section>
      <h2 className="text-lg font-semibold text-brown-900 mb-3">Refund Menunggu Persetujuan</h2>
      <PageState loading={loading} error={error} onRetry={reload}>
        {menunggu.length === 0 ? (
          <p className="text-brown-600 bg-white rounded-xl border border-cream-200 p-6 text-center">
            Tidak ada refund yang menunggu.
          </p>
        ) : (
          <div className="space-y-3">
            {menunggu.map((r) => (
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
          <p className="font-semibold text-brown-900">
            {refund.member_name} · {refund.booking_code}
          </p>
          <p className="text-brown-700 mt-1">
            {Format.rupiah(refund.amount)} ({refund.percent}%) · {refund.reason}
          </p>
          <p className="text-xs text-brown-500 mt-1">Diajukan {Format.dateTime(refund.created_at)}</p>
        </div>
        {!rejecting && (
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
