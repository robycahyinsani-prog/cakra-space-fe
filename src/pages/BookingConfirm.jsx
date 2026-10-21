import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CalendarClock, Download, UserPlus, Users } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Alert from "../components/Alert";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import AccessQr from "../components/access/AccessQr";
import MailboxHint from "../components/auth/MailboxHint";
import PaymentPanel from "../components/booking/PaymentPanel";
import CancelBooking from "../components/booking/CancelBooking";
import useResource from "../hooks/useResource";
import Format from "../utils/Format";
import FileDownload from "../utils/FileDownload";
import { AREA_TYPES } from "../utils/labels";
import { api } from "../api";

// detail booking: bayar saat masih menunggu, QR akses saat sudah terkonfirmasi
export default function BookingConfirm() {
  const { id } = useParams();
  const { data: booking, error, loading, reload } = useResource(() => api.bookings.get(id), [id]);

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <PageState loading={loading && !booking} error={error} onRetry={reload}>
          {booking && <BookingDetail booking={booking} onChanged={reload} />}
        </PageState>
      </div>
    </div>
  );
}

const PESAN = {
  pending_payment: ["info", "Booking dibuat. Selesaikan pembayaran sebelum waktu habis supaya slot tidak dilepas."],
  confirmed: ["success", "Booking terkonfirmasi. Tunjukkan QR akses saat datang ke gedung."],
  cancelled: ["error", "Booking ini sudah dibatalkan."],
  expired: ["error", "Waktu pembayaran habis sehingga slot sudah dilepas."],
};

function BookingDetail({ booking, onChanged }) {
  const [params] = useSearchParams();
  const [tipe, pesan] = PESAN[booking.status] || ["info", ""];
  const menit = (new Date(booking.end_at) - new Date(booking.start_at)) / 60000;
  const ubahJadwal = `/booking/${booking.area.id}?reschedule=${booking.id}&date=${booking.local_date}`;

  return (
    <>
      {params.get("moved") && booking.status !== "cancelled" && (
        <Alert type="success" message="Jadwal booking berhasil dipindah." />
      )}
      <Alert type={tipe} message={pesan} />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div>
                <p className="text-sm text-brown-600">Kode Booking</p>
                <p className="text-xl font-bold text-brown-900 tracking-wider">{booking.code}</p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <dl className="space-y-3 text-sm">
              <Row label="Ruang" value={`${booking.area.name} (${AREA_TYPES[booking.area.type]})`} />
              <Row label="Gedung" value={`${booking.building.name}, ${booking.building.city}`} />
              <Row label="Tanggal" value={Format.longDate(booking.local_date)} />
              <Row
                label="Jam"
                value={`${Format.clock(booking.local_start)}-${Format.clock(booking.local_end)} (${Format.hours(menit)})`}
              />
            </dl>

            <dl className="border-t border-cream-200 mt-5 pt-5 space-y-2 text-sm">
              <Row label="Subtotal" value={Format.rupiah(booking.subtotal)} />
              {booking.benefit_discount > 0 && <Row label="Kuota membership" value={`-${Format.rupiah(booking.benefit_discount)}`} />}
              {booking.voucher_discount > 0 && <Row label="Voucher" value={`-${Format.rupiah(booking.voucher_discount)}`} />}
              <Row label="Pajak" value={Format.rupiah(booking.tax)} />
              <div className="flex justify-between border-t border-cream-200 pt-3">
                <span className="font-semibold text-brown-800">Total</span>
                <span className="text-lg font-bold text-brown-500">{Format.rupiah(booking.total)}</span>
              </div>
            </dl>

            {booking.invoice && <InvoiceRow invoice={booking.invoice} />}
            {booking.refund && <RefundInfo refund={booking.refund} />}
            {booking.cancel_reason && (
              <p className="text-sm text-brown-600 mt-4">Alasan pembatalan: {booking.cancel_reason}</p>
            )}
          </div>

          {booking.area.type === "meeting_room" && (
            <GuestInviteSection booking={booking} onChanged={onChanged} />
          )}
        </div>

        <div className="space-y-4">
          {booking.status === "pending_payment" && booking.can_pay && (
            <PaymentPanel booking={booking} onChanged={onChanged} />
          )}
          {booking.status === "confirmed" && <AccessQr />}
          {booking.can_reschedule && (
            <Link to={ubahJadwal} className="block">
              <Button variant="secondary" className="w-full">
                <CalendarClock size={16} className="inline mr-2 -mt-0.5" />
                Ubah Jadwal
              </Button>
            </Link>
          )}
          {booking.can_cancel && <CancelBooking booking={booking} onDone={onChanged} />}
          <div className="flex gap-3">
            <Link to={`/booking/${booking.rebook.area_id}`} className="flex-1">
              <Button variant="secondary" className="w-full">
                Pesan Lagi
              </Button>
            </Link>
            <Link to="/my-bookings" className="flex-1">
              <Button variant="secondary" className="w-full">
                Booking Saya
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// undang tamu rapat & daftar tamu (K5-US-006.2: FE-47, FE-48)
function GuestInviteSection({ booking, onChanged }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastInvitedEmail, setLastInvitedEmail] = useState(null);

  const guests = booking.guests || [];
  const maxGuests = Math.max(0, (booking.area.capacity || 1) - 1);
  const remaining = Math.max(0, maxGuests - guests.length);
  const canInvite = booking.status === "confirmed" && remaining > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const targetEmail = email.trim();
      await api.bookings.inviteGuests(booking.id, [{ name: name.trim(), email: targetEmail }]);
      setLastInvitedEmail(targetEmail);
      setName("");
      setEmail("");
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-brown-600" />
          <h2 className="font-semibold text-brown-900">Tamu Rapat ({guests.length}/{maxGuests})</h2>
        </div>
        <span className="text-xs text-brown-600">
          Kapasitas ruang {booking.area.capacity} orang (termasuk Anda)
        </span>
      </div>

      {guests.length === 0 ? (
        <p className="text-sm text-brown-600 mb-4">
          Belum ada tamu yang diundang untuk jadwal rapat ini.
        </p>
      ) : (
        <ul className="divide-y divide-cream-100 border border-cream-200 rounded-lg mb-4 text-sm">
          {guests.map((g) => (
            <li key={g.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-brown-900">{g.guest_name}</p>
                <p className="text-xs text-brown-600">{g.guest_email}</p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  g.used_at ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                }`}
              >
                {g.used_at ? `Sudah masuk (${Format.time(g.used_at)})` : "QR terkirim ke email"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {lastInvitedEmail && (
        <div className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="font-medium">QR akses sekali pakai berhasil dikirim ke {lastInvitedEmail}.</p>
          <MailboxHint email={lastInvitedEmail} />
        </div>
      )}

      {booking.status !== "confirmed" ? (
        <p className="text-xs text-brown-500">
          Undangan tamu dapat dikirim setelah pembayaran booking ruang rapat terkonfirmasi.
        </p>
      ) : canInvite ? (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs font-medium text-brown-700">
            Undang Tamu (sisa kuota {remaining} orang) — tamu menerima QR sekali pakai via email
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap tamu"
              aria-label="Nama tamu"
              className="px-3 py-2 text-sm border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email tamu"
              aria-label="Email tamu"
              className="px-3 py-2 text-sm border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
            />
          </div>
          {error && <p className="text-sm text-red-700">{error.message}</p>}
          <Button type="submit" loading={busy} className="text-sm">
            <UserPlus size={15} className="inline mr-1.5 -mt-0.5" />
            Kirim Undangan QR
          </Button>
        </form>
      ) : (
        <p className="text-xs text-brown-600">Kuota tamu untuk ruang rapat ini sudah penuh.</p>
      )}
    </div>
  );
}

function InvoiceRow({ invoice }) {
  const [busy, setBusy] = useState(false);
  const unduh = async () => {
    setBusy(true);
    try {
      const blob = await api.member.invoicePdf(invoice.id);
      FileDownload.save(blob, `${invoice.number.replaceAll("/", "-")}.pdf`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-5 border-t border-cream-200 text-sm">
      <div>
        <p className="text-brown-600">Invoice</p>
        <p className="font-medium text-brown-900">{invoice.number}</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={invoice.status} />
        {invoice.status === "paid" && (
          <Button variant="secondary" className="text-sm" onClick={unduh} loading={busy}>
            <Download size={14} className="inline mr-1 -mt-0.5" /> PDF
          </Button>
        )}
      </div>
    </div>
  );
}

function RefundInfo({ refund }) {
  return (
    <div className="mt-5 pt-5 border-t border-cream-200 text-sm flex items-center justify-between gap-3">
      <div>
        <p className="text-brown-600">Refund {refund.percent != null ? `(${refund.percent}%)` : ""}</p>
        <p className="font-medium text-brown-900">{Format.rupiah(refund.amount)}</p>
      </div>
      <StatusBadge status={refund.status} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-brown-600">{label}</dt>
      <dd className="font-medium text-brown-900 text-right">{value}</dd>
    </div>
  );
}
