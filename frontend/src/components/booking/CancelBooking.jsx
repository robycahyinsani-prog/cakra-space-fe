import { useState } from "react";
import Button from "../Button";
import Format from "../../utils/Format";
import { api } from "../../api";

// pembatalan dengan konfirmasi; besar refund mengikuti aturan gedung (BE-19, BE-26)
export default function CancelBooking({ booking, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const batalkan = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.bookings.cancel(booking.id, reason.trim());
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="danger" className="w-full" onClick={() => setOpen(true)}>
        Batalkan Booking
      </Button>
    );
  }

  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-4">
      <p className="text-sm text-red-800 mb-1 font-medium">Yakin membatalkan booking {booking.code}?</p>
      {booking.status === "confirmed" && booking.cancel_deadline && (
        <p className="text-xs text-red-800 mb-3">
          Batas pembatalan {Format.dateTime(booking.cancel_deadline)}. Refund diproses sesuai aturan gedung.
        </p>
      )}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={255}
        rows={2}
        placeholder="Alasan pembatalan (opsional)"
        className="w-full text-sm px-3 py-2 border border-red-200 rounded-lg bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-red-200"
      />
      {error && <p className="text-sm text-red-700 mb-2">{error.message}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
          Tidak Jadi
        </Button>
        <Button variant="danger" className="flex-1" onClick={batalkan} loading={busy}>
          Ya, Batalkan
        </Button>
      </div>
    </div>
  );
}
