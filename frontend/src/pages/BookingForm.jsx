import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import Navbar from "../components/Navbar";
import Alert from "../components/Alert";
import Button from "../components/Button";
import PageState from "../components/common/PageState";
import DateStrip from "../components/booking/DateStrip";
import SlotGrid, { SlotLegend } from "../components/booking/SlotGrid";
import BookingSummary from "../components/booking/BookingSummary";
import RescheduleSummary from "../components/booking/RescheduleSummary";
import useResource from "../hooks/useResource";
import { useAuth } from "../context/AuthContext";
import OpeningSchedule from "../utils/OpeningSchedule";
import SlotSelection from "../utils/SlotSelection";
import Format from "../utils/Format";
import { AREA_TYPES } from "../utils/labels";
import { api } from "../api";

const JUMLAH_HARI = 14;

// halaman booking: /booking/:roomId (dari kartu ruang) atau /buildings/:id/booking,
// ditambah ?reschedule=<id booking> untuk memindah jadwal booking yang sudah ada
export default function BookingForm() {
  const { roomId, id: buildingId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const rescheduleId = params.get("reschedule");

  const ctx = useResource(async () => {
    if (rescheduleId && !isAuthenticated) return null;
    const area = roomId ? await api.buildings.area(roomId) : null;
    const detail = await api.buildings.detail(area ? area.building_id : buildingId);
    const original = rescheduleId ? await api.bookings.get(rescheduleId) : null;
    return { area, detail, original };
  }, [roomId, buildingId, rescheduleId, isAuthenticated]);

  if (rescheduleId && !isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return (
    <div className="min-h-screen bg-cream-50 pb-24 lg:pb-0">
      <Navbar />
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <PageState loading={ctx.loading} error={ctx.error} onRetry={ctx.reload}>
          {ctx.data && (
            <BookingPlanner focusArea={ctx.data.area} detail={ctx.data.detail} original={ctx.data.original} />
          )}
        </PageState>
      </div>
    </div>
  );
}

function BookingPlanner({ focusArea, detail, original }) {
  const { building } = detail;
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const summaryRef = useRef(null);

  const days = useMemo(
    () => new OpeningSchedule(detail.operating_hours, detail.holidays).nextDays(JUMLAH_HARI),
    [detail]
  );
  const firstOpen = days.find((d) => !d.closed)?.iso || days[0].iso;
  const date = days.some((d) => d.iso === params.get("date") && !d.closed) ? params.get("date") : firstOpen;

  const slotsRes = useResource(() => api.buildings.slots(building.id, date), [building.id, date]);
  const allAreas = useMemo(() => {
    const rows = slotsRes.data?.areas || [];
    if (!original) return rows;
    // reschedule: hanya ruang booking awal, dan jam milik booking itu sendiri boleh dipilih lagi
    const milikSendiri = (s) =>
      date === original.local_date && s.start_time >= original.local_start && s.end_time <= original.local_end;
    return rows
      .filter((r) => r.area.id === original.area_id)
      .map((r) => ({
        ...r,
        slots: r.slots.map((s) => (s.status === "booked" && milikSendiri(s) ? { ...s, status: "available" } : s)),
      }));
  }, [slotsRes.data, original, date]);
  const blokJam = original ? (new Date(original.end_at) - new Date(original.start_at)) / 3600000 : 0;
  const types = Object.keys(AREA_TYPES).filter((t) => allAreas.some((a) => a.area.type === t));
  const typeParam = params.get("type") || focusArea?.type;
  const type = types.includes(typeParam) ? typeParam : types[0];
  const areas = allAreas
    .filter((a) => a.area.type === type)
    .sort((a, b) => (b.area.id === focusArea?.id) - (a.area.id === focusArea?.id));

  // undefined = belum disentuh, pilihan dari query (sesudah login) dipakai kalau slotnya masih kosong
  const [touched, setTouched] = useState(undefined);
  const selection = useMemo(() => {
    if (touched !== undefined) return touched;
    const areaId = Number(params.get("area"));
    const target = allAreas.find((a) => a.area.id === areaId);
    return target ? SlotSelection.fromRange(areaId, target.slots, params.get("from"), params.get("to")) : null;
  }, [touched, allAreas, params]);

  const selected = selection ? allAreas.find((a) => a.area.id === selection.areaId) : null;
  const range = selected ? selection.range(selected.slots) : null;

  const [voucherCode, setVoucherCode] = useState("");
  const [useBenefit, setUseBenefit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);

  const mode = !isAuthenticated ? "guest" : isStaff ? "staff" : "member";
  const request = range
    ? {
        area_id: selected.area.id,
        date,
        start_time: range.start_time,
        end_time: range.end_time,
        voucher_code: voucherCode || null,
        use_benefit: useBenefit && selected.area.type === "meeting_room",
      }
    : null;
  const quote = useQuote(mode === "member" && !original ? request : null);

  const updateParams = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const pilihTanggal = (iso) => {
    setTouched(null);
    setAlert(null);
    updateParams({ date: iso, area: null, from: null, to: null });
  };

  const pilihTipe = (t) => {
    setTouched(null);
    updateParams({ type: t, area: null, from: null, to: null });
  };

  const pilihSlot = (areaRow, index) => {
    setAlert(null);
    if (!original) {
      setTouched(SlotSelection.click(selection, areaRow.area.id, index, areaRow.slots));
      return;
    }
    const blok = Number.isInteger(blokJam) ? SlotSelection.block(areaRow.area.id, index, blokJam, areaRow.slots) : null;
    if (blok) setTouched(blok);
    else setAlert({ message: `Pilih jam mulai yang diikuti ${Format.hours(blokJam * 60)} kosong berturut-turut.` });
  };

  const pindahkan = async () => {
    setSubmitting(true);
    try {
      await api.bookings.reschedule(original.id, { date, start_time: range.start_time, end_time: range.end_time });
      navigate(`/booking/confirm/${original.id}?moved=1`);
    } catch (err) {
      setSubmitting(false);
      setAlert(err);
      if (err.code === "slot_taken") {
        setTouched(null);
        slotsRes.reload();
      }
    }
  };

  const submit = async () => {
    if (!request) return;
    if (original) return pindahkan();
    if (mode === "guest") {
      // pilihan dibawa lewat query supaya bisa dipulihkan setelah login
      const back = new URLSearchParams({ date, type, area: request.area_id, from: request.start_time, to: request.end_time });
      const redirect = `${window.location.pathname}?${back}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setSubmitting(true);
    try {
      const booking = await api.bookings.create(request);
      navigate(`/booking/confirm/${booking.id}`);
    } catch (err) {
      setSubmitting(false);
      setAlert(err);
      if (err.code === "slot_taken") {
        setTouched(null);
        slotsRes.reload();
      }
    }
  };

  return (
    <>
      <Link
        to={original ? `/booking/confirm/${original.id}` : `/buildings/${building.id}`}
        className="text-brown-500 hover:underline text-sm mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Kembali ke {original ? `booking ${original.code}` : building.name}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brown-900">
          {original ? "Ubah Jadwal Booking" : `Booking di ${building.name}`}
        </h1>
        <p className="text-brown-600 flex items-center gap-1 mt-1">
          <MapPin size={15} /> {building.address}, {building.city}
        </p>
      </div>

      {user && !user.is_verified && mode === "member" && (
        <Alert type="info" message="Email Anda belum terverifikasi. Verifikasi dulu lewat link di email sebelum membuat booking." />
      )}
      {alert && <BookingError error={alert} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-6 min-w-0">
          {/* 1. tanggal */}
          <section className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
            <h2 className="font-semibold text-brown-900 mb-3">1. Pilih tanggal</h2>
            <DateStrip days={days} value={date} onChange={pilihTanggal} />
          </section>

          {/* 2. ruang dan jam */}
          <section className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-brown-900">{original ? "2. Pilih jam mulai baru" : "2. Pilih ruang dan jam"}</h2>
              <SlotLegend />
            </div>

            {types.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-5" role="tablist">
                {types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={t === type}
                    onClick={() => pilihTipe(t)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      t === type
                        ? "bg-brown-600 border-brown-600 text-white"
                        : "bg-white border-tan-300 text-brown-800 hover:bg-cream-50"
                    }`}
                  >
                    {AREA_TYPES[t]}
                  </button>
                ))}
              </div>
            )}

            <PageState loading={slotsRes.loading} error={slotsRes.error} onRetry={slotsRes.reload}>
              {slotsRes.data && !slotsRes.data.is_open ? (
                <p className="text-brown-600">Gedung tutup pada {Format.longDate(date)}.</p>
              ) : areas.length === 0 ? (
                <p className="text-brown-600">Belum ada ruang yang bisa dibooking.</p>
              ) : (
                <div className="space-y-5">
                  {areas.map((row) => (
                    <AreaSlots
                      key={row.area.id}
                      row={row}
                      focus={row.area.id === focusArea?.id}
                      selection={selection}
                      onPick={(i) => pilihSlot(row, i)}
                    />
                  ))}
                </div>
              )}
            </PageState>
          </section>
        </div>

        {/* 3. ringkasan */}
        <aside ref={summaryRef} className="lg:sticky lg:top-20">
          {original ? (
            <RescheduleSummary
              original={original}
              minutes={blokJam * 60}
              date={date}
              range={range}
              onSubmit={submit}
              submitting={submitting}
            />
          ) : (
            <BookingSummary
              area={selected?.area}
              date={date}
              range={range}
              hours={selection?.length || 0}
              quote={quote}
              mode={mode}
              voucherCode={voucherCode}
              onVoucher={setVoucherCode}
              useBenefit={useBenefit}
              onUseBenefit={setUseBenefit}
              onSubmit={submit}
              submitting={submitting}
            />
          )}
        </aside>
      </div>

      {/* bar bawah di HP supaya ringkasan tidak perlu dicari */}
      {range && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-cream-200 px-4 py-3 flex items-center justify-between gap-3 z-40">
          <div className="min-w-0">
            <p className="font-bold text-brown-900">
              {original
                ? "Jadwal baru"
                : quote?.data
                  ? Format.rupiah(quote.data.total)
                  : Format.rupiah(selected.area.price_per_hour * selection.length)}
            </p>
            <p className="text-xs text-brown-600 truncate">
              {selected.area.name} · {Format.clock(range.start_time)}-{Format.clock(range.end_time)}
            </p>
          </div>
          <Button onClick={() => summaryRef.current?.scrollIntoView({ behavior: "smooth" })}>Lanjut</Button>
        </div>
      )}
    </>
  );
}

function AreaSlots({ row, focus, selection, onPick }) {
  const { area, slots } = row;
  const kosong = slots.filter((s) => s.status === "available").length;
  return (
    <div className={`rounded-xl border p-4 ${focus ? "border-brown-500 bg-cream-50/60" : "border-cream-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-brown-900">{area.name}</h3>
          <p className="text-xs text-brown-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="flex items-center gap-1">
              <Users size={13} /> {area.capacity} orang
            </span>
            <span>{area.floor_name}</span>
            {area.facilities.length > 0 && <span>{area.facilities.join(" · ")}</span>}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="font-bold text-brown-500">
            {Format.rupiah(area.price_per_hour)}
            <span className="text-xs font-normal text-brown-600">/jam</span>
          </p>
          <p className="text-xs text-brown-600">{kosong} jam kosong</p>
        </div>
      </div>
      <SlotGrid areaId={area.id} slots={slots} selection={selection} onPick={onPick} />
    </div>
  );
}

function BookingError({ error }) {
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const kirimUlang = async () => {
    await api.auth.resendVerification(user.email).catch(() => {});
    setSent(true);
  };
  const saran = error.extra?.suggestions || [];
  return (
    <div className="px-4 py-3 rounded-lg border mb-4 bg-red-100 text-red-800 border-red-300 text-sm">
      <p>{error.message}</p>
      {saran.length > 0 && (
        <p className="mt-1">Ruang lain yang masih kosong di jam yang sama: {saran.map((s) => s.name).join(", ")}.</p>
      )}
      {error.code === "email_not_verified" && (
        <button type="button" onClick={kirimUlang} disabled={sent} className="mt-2 underline font-medium">
          {sent ? "Link verifikasi baru sudah dikirim" : "Kirim ulang link verifikasi"}
        </button>
      )}
    </div>
  );
}

// harga dihitung ulang setiap pilihan berubah, dengan jeda kecil supaya klik beruntun tidak membanjiri API
function useQuote(request) {
  const key = request ? JSON.stringify(request) : null;
  const [result, setResult] = useState({ key: null });

  useEffect(() => {
    if (!key) return;
    let aktif = true;
    const timer = setTimeout(() => {
      api.bookings.quote(JSON.parse(key)).then(
        (data) => aktif && setResult({ key, data }),
        (error) => aktif && setResult({ key, error })
      );
    }, 250);
    return () => {
      aktif = false;
      clearTimeout(timer);
    };
  }, [key]);

  return key && result.key === key ? result : null;
}
