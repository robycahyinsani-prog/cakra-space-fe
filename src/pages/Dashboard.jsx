import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Hourglass, Receipt, MapPin, TrendingUp, ArrowRight, Megaphone, Clock, CalendarDays } from "lucide-react";
import Navbar from "../components/Navbar";
import Alert from "../components/Alert";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import AccessQr from "../components/access/AccessQr";
import MailboxHint from "../components/auth/MailboxHint";
import useResource from "../hooks/useResource";
import { useAuth } from "../context/AuthContext";
import Format from "../utils/Format";
import { api } from "../api";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, error, loading, reload } = useResource(() => api.member.summary(), []);

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brown-900">Halo, {user?.name}</h1>
          <p className="text-brown-600 mt-1">Selamat datang di dashboard Cakra Space</p>
        </div>

        <PageState loading={loading} error={error} onRetry={reload}>
          {summary && <DashboardBody summary={summary} />}
        </PageState>
      </div>
    </div>
  );
}

function DashboardBody({ summary }) {
  const next = summary.next_booking;

  return (
    <>
      {!summary.user.is_verified && <VerifyBanner email={summary.user.email} />}
      {summary.has_overdue_arrears && (
        <Alert
          type="error"
          message="Anda punya tunggakan yang lewat jatuh tempo. Booking baru diblokir sampai tunggakan dilunasi di resepsionis."
        />
      )}

      {/* Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={CalendarCheck} label="Booking Akan Datang" value={summary.upcoming_bookings} />
        <StatCard icon={Hourglass} label="Menunggu Pembayaran" value={summary.pending_payment_bookings} />
        <StatCard icon={Receipt} label="Invoice Belum Dibayar" value={summary.unpaid_invoices} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-6 min-w-0">
          {/* Booking Berikutnya */}
          <section>
            <h2 className="text-lg font-semibold text-brown-900 mb-3">Booking Berikutnya</h2>
            {next ? (
              <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={next.status} />
                      <span className="text-xs text-brown-500">Kode: {next.code}</span>
                    </div>
                    <h3 className="font-semibold text-brown-900 text-lg">{next.area_name}</h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-brown-700">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} />
                        {new Date(next.start_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {Format.time(next.start_at)}-{Format.time(next.end_at)}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/booking/confirm/${next.id}`}
                    className="text-brown-500 hover:text-brown-600 font-medium text-sm flex items-center gap-1"
                  >
                    Lihat Detail
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-8 text-center">
                <p className="text-brown-600 mb-4">Belum ada booking yang akan datang</p>
                <Link to="/buildings" className="text-brown-500 hover:underline text-sm font-medium">
                  Cari Ruang & Booking
                </Link>
              </div>
            )}
          </section>

          {/* Pengumuman */}
          {summary.announcements.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-brown-900 mb-3">Pengumuman</h2>
              <div className="space-y-3">
                {summary.announcements.map((a) => (
                  <article key={a.id} className="bg-white rounded-xl shadow-sm border border-cream-200 p-4">
                    <div className="flex items-start gap-3">
                      <Megaphone size={18} className="text-brown-500 mt-0.5 flex-none" />
                      <div>
                        <h3 className="font-semibold text-brown-900">{a.title}</h3>
                        <p className="text-sm text-brown-700 mt-1">{a.body}</p>
                        <p className="text-xs text-brown-500 mt-2">
                          {a.building_name || "Semua gedung"} · {Format.dateTime(a.created_at)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Aksi Cepat */}
          <section>
            <h2 className="text-lg font-semibold text-brown-900 mb-3">Aksi Cepat</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickLink to="/buildings" icon={MapPin} title="Cari Ruang" text="Lihat gedung & ruang tersedia" />
              <QuickLink to="/my-bookings" icon={TrendingUp} title="Booking Saya" text="Lihat riwayat & status booking" />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <AccessQr />
          <MembershipCard membership={summary.membership} />
        </div>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-cream-50 rounded-lg flex items-center justify-center">
          <Icon className="text-brown-600" size={20} />
        </div>
        <div>
          <p className="text-sm text-brown-600">{label}</p>
          <p className="text-xl font-bold text-brown-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, text }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 hover:shadow-md hover:border-tan-300 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-cream-50 rounded-lg flex items-center justify-center group-hover:bg-cream-100 transition-colors">
          <Icon className="text-brown-600" size={22} />
        </div>
        <div>
          <h3 className="font-semibold text-brown-900">{title}</h3>
          <p className="text-sm text-brown-600">{text}</p>
        </div>
      </div>
    </Link>
  );
}

function MembershipCard({ membership }) {
  if (!membership?.plan) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
        <h2 className="font-semibold text-brown-900 mb-1">Membership</h2>
        <p className="text-sm text-brown-600">Anda belum berlangganan paket membership.</p>
      </div>
    );
  }
  const kuota = membership.benefits.find((b) => b.benefit_type === "meeting_room_hours");
  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-brown-900">{membership.plan.name}</h2>
        <StatusBadge status={membership.status} />
      </div>
      <p className="text-sm text-brown-700">
        Berlaku sampai {Format.longDate(membership.subscription.end_date)} ({membership.days_left} hari lagi)
      </p>
      {kuota && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-brown-700 mb-1">
            <span>Kuota ruang rapat</span>
            <span className="font-medium">
              {Format.hours(kuota.remaining_minutes)} dari {Format.hours(kuota.quota_minutes)}
            </span>
          </div>
          <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brown-600"
              style={{ width: `${Math.round((kuota.remaining_minutes / kuota.quota_minutes) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function VerifyBanner({ email }) {
  const [state, setState] = useState({ sent: false, error: null });
  const kirim = async () => {
    try {
      await api.auth.resendVerification(email);
      setState({ sent: true, error: null });
    } catch (err) {
      setState({ sent: false, error: err });
    }
  };
  return (
    <div className="px-4 py-3 rounded-lg border mb-6 bg-blue-100 text-blue-900 border-blue-300 text-sm">
      <p>Email Anda belum terverifikasi. Booking baru bisa dibuat setelah verifikasi.</p>
      {state.sent ? (
        <>
          <p className="mt-1 font-medium">Link verifikasi baru sudah dikirim ke {email}.</p>
          <MailboxHint email={email} />
        </>
      ) : (
        <button type="button" onClick={kirim} className="mt-1 underline font-medium">
          Kirim ulang link verifikasi
        </button>
      )}
      {state.error && <p className="mt-1 text-red-700">{state.error.message}</p>}
    </div>
  );
}
