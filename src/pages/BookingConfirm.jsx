import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CalendarClock, Download } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Alert from "../components/Alert";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import AccessQr from "../components/access/AccessQr";
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
