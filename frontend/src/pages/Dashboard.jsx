import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  Hourglass,
  Receipt,
  MapPin,
  TrendingUp,
  ArrowRight,
  Megaphone,
  Clock,
  CalendarDays,
  Download,
  UserCog,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Alert from "../components/Alert";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import AccessQr from "../components/access/AccessQr";
import MailboxHint from "../components/auth/MailboxHint";
import useResource from "../hooks/useResource";
import { useAuth } from "../context/AuthContext";
import Format from "../utils/Format";
import FileDownload from "../utils/FileDownload";
import { api } from "../api";

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const { data: summary, error, loading, reload } = useResource(() => api.member.summary(), []);

  const handleProfileSaved = () => {
    refreshUser();
    reload();
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brown-900">Halo, {user?.name}</h1>
          <p className="text-brown-600 mt-1">Selamat datang di dashboard Cakra Space</p>
        </div>

        <PageState loading={loading} error={error} onRetry={reload}>
          {summary && <DashboardBody summary={summary} onProfileSaved={handleProfileSaved} />}
        </PageState>
      </div>
    </div>
  );
}

function DashboardBody({ summary, onProfileSaved }) {
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

          {/* Daftar Invoice & Status Pembayaran (K5-US-008.3) */}
          <InvoiceListSection />

          {/* Ubah Profil & Preferensi Pengingat (K5-US-008.4, K5-US-004.5) */}
          <ProfileSection user={summary.user} onSaved={onProfileSaved} />

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

// daftar invoice member beserta tombol Bayar Sekarang & Unduh PDF (K5-US-008.3: FE-77)
function InvoiceListSection() {
  const { data: invoices, error, loading, reload } = useResource(() => api.member.invoices(), []);
  const [downloadingId, setDownloadingId] = useState(null);

  const unduh = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const blob = await api.member.invoicePdf(inv.id);
      FileDownload.save(blob, `${inv.number.replaceAll("/", "-")}.pdf`);
    } finally {
      setDownloadingId(null);
    }
  };

  const payUrl = (inv) => {
    if (inv.pay?.purpose === "booking" && inv.pay?.reference_id) {
      return `/booking/confirm/${inv.pay.reference_id}`;
    }
    return "/membership";
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-brown-900 mb-3">Daftar Invoice & Pembayaran</h2>
      <PageState loading={loading} error={error} onRetry={reload}>
        {!invoices || invoices.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6 text-center text-sm text-brown-600">
            Belum ada invoice transaksi.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-cream-50 text-brown-800">
                  <th className="p-3 font-semibold">Nomor Invoice</th>
                  <th className="p-3 font-semibold">Deskripsi</th>
                  <th className="p-3 font-semibold text-right">Total</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-cream-50">
                    <td className="p-3 font-mono text-xs font-medium text-brown-900 whitespace-nowrap">
                      {inv.number}
                      <div className="font-sans text-brown-500 mt-0.5">{Format.dateTime(inv.created_at)}</div>
                    </td>
                    <td className="p-3 text-brown-700">{inv.description}</td>
                    <td className="p-3 text-right font-semibold text-brown-900 whitespace-nowrap">
                      {Format.rupiah(inv.total)}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {inv.can_pay && (
                          <Link to={payUrl(inv)}>
                            <Button className="text-xs px-3 py-1.5">Bayar Sekarang</Button>
                          </Link>
                        )}
                        <Button
                          variant="secondary"
                          className="text-xs px-3 py-1.5"
                          loading={downloadingId === inv.id}
                          onClick={() => unduh(inv)}
                        >
                          <Download size={13} className="inline mr-1 -mt-0.5" />
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageState>
    </section>
  );
}

// ubah profil member, ganti email, dan preferensi pengingat (K5-US-008.4 & K5-US-004.5: FE-33, FE-78)
function ProfileSection({ user, onSaved }) {
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [company, setCompany] = useState(user.company || "");
  const [photoUrl, setPhotoUrl] = useState(user.photo_url || "");
  const [remind24h, setRemind24h] = useState(() => localStorage.getItem("cakra_remind_24h") !== "false");
  const [remind1h, setRemind1h] = useState(() => localStorage.getItem("cakra_remind_1h") !== "false");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState(null);
  const [emailErr, setEmailErr] = useState(null);

  const simpanProfil = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      localStorage.setItem("cakra_remind_24h", String(remind24h));
      localStorage.setItem("cakra_remind_1h", String(remind1h));
      await api.member.updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        company: company.trim() || null,
        photo_url: photoUrl.trim() || null,
      });
      setMsg("Profil dan preferensi pengingat berhasil disimpan.");
      onSaved();
    } catch (error) {
      setErr(error);
    } finally {
      setBusy(false);
    }
  };

  const gantiEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !password) return;
    setEmailBusy(true);
    setEmailErr(null);
    setEmailSentTo(null);
    try {
      const target = newEmail.trim();
      await api.member.requestEmailChange(target, password);
      setEmailSentTo(target);
      setNewEmail("");
      setPassword("");
    } catch (error) {
      setEmailErr(error);
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-brown-900 mb-3 flex items-center gap-2">
        <UserCog size={19} className="text-brown-600" />
        Profil & Preferensi Pengingat
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-6">
        <form onSubmit={simpanProfil} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <label className="block">
              <span className="text-brown-700 font-medium">Nama Lengkap</span>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
              />
            </label>
            <label className="block">
              <span className="text-brown-700 font-medium">Nomor HP</span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812..."
                className="mt-1 w-full px-3 py-2 border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
              />
            </label>
            <label className="block">
              <span className="text-brown-700 font-medium">Perusahaan / Instansi</span>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nama perusahaan (opsional)"
                className="mt-1 w-full px-3 py-2 border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
              />
            </label>
            <label className="block">
              <span className="text-brown-700 font-medium">URL Foto Profil</span>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full px-3 py-2 border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
              />
            </label>
          </div>

          <div className="border-t border-cream-200 pt-4 text-sm">
            <p className="font-medium text-brown-800 mb-2">Preferensi Pengingat Jadwal Booking (Email)</p>
            <div className="flex flex-wrap gap-6 text-brown-700">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remind24h}
                  onChange={(e) => setRemind24h(e.target.checked)}
                  className="rounded border-tan-300 text-brown-600 focus:ring-tan-300"
                />
                <span>Pengingat H-1 (24 jam sebelum jadwal mulai)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remind1h}
                  onChange={(e) => setRemind1h(e.target.checked)}
                  className="rounded border-tan-300 text-brown-600 focus:ring-tan-300"
                />
                <span>Pengingat 1 jam sebelum jadwal mulai</span>
              </label>
            </div>
          </div>

          {msg && <p className="text-sm text-green-700">{msg}</p>}
          {err && <p className="text-sm text-red-700">{err.message}</p>}

          <Button type="submit" loading={busy} className="text-sm">
            Simpan Profil
          </Button>
        </form>

        <form onSubmit={gantiEmail} className="border-t border-cream-200 pt-5 space-y-3 text-sm">
          <div>
            <p className="font-medium text-brown-800">Ubah Alamat Email</p>
            <p className="text-xs text-brown-600">
              Email saat ini: <span className="font-medium text-brown-900">{user.email}</span> (perubahan email memerlukan verifikasi ulang)
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email baru"
              aria-label="Email baru"
              className="px-3 py-2 border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password saat ini"
              aria-label="Password saat ini"
              className="px-3 py-2 border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
            />
          </div>
          {emailSentTo && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs">
              <p className="font-medium">Link konfirmasi telah dikirim ke {emailSentTo}.</p>
              <MailboxHint email={emailSentTo} />
            </div>
          )}
          {emailErr && <p className="text-sm text-red-700">{emailErr.message}</p>}
          <Button type="submit" variant="secondary" loading={emailBusy} className="text-sm">
            Kirim Link Verifikasi Email Baru
          </Button>
        </form>
      </div>
    </section>
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
        <p className="text-sm text-brown-600 mb-3">Anda belum berlangganan paket membership.</p>
        <Link to="/membership" className="text-brown-500 hover:text-brown-600 text-sm font-medium inline-flex items-center gap-1">
          Lihat Paket Membership
          <ArrowRight size={15} />
        </Link>
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
      {membership.subscription?.end_date ? (
        <p className="text-sm text-brown-700">
          Berlaku sampai {Format.longDate(membership.subscription.end_date)} ({membership.days_left} hari lagi)
        </p>
      ) : (
        <p className="text-sm text-brown-700">Menunggu penyelesaian pembayaran paket.</p>
      )}
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
      <Link
        to="/membership"
        className="mt-4 text-brown-500 hover:text-brown-600 text-sm font-medium inline-flex items-center gap-1"
      >
        Kelola Membership
        <ArrowRight size={15} />
      </Link>
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
