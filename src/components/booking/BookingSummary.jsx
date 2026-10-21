import { useState } from "react";
import { BadgePercent, X } from "lucide-react";
import Button from "../Button";
import Format from "../../utils/Format";

// ringkasan pilihan dan rincian harga dari POST /bookings/quote
export default function BookingSummary({
  area,
  date,
  range,
  hours,
  quote,
  mode,
  voucherCode,
  onVoucher,
  useBenefit,
  onUseBenefit,
  onSubmit,
  submitting,
}) {
  const [voucherInput, setVoucherInput] = useState("");

  if (!area || !range) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
        <h2 className="font-semibold text-brown-900 mb-2">Ringkasan Booking</h2>
        <p className="text-sm text-brown-600">
          Pilih tanggal lalu klik jam kosong pada salah satu ruang. Klik jam berikutnya untuk menambah durasi.
        </p>
      </div>
    );
  }

  const estimasi = area.price_per_hour * hours;
  const data = quote?.data;
  const bisaPakaiKuota = mode === "member" && area.type === "meeting_room";

  const pakaiVoucher = (e) => {
    e.preventDefault();
    const kode = voucherInput.trim().toUpperCase();
    if (kode) onVoucher(kode);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
      <h2 className="font-semibold text-brown-900 mb-3">Ringkasan Booking</h2>

      <dl className="text-sm space-y-2 mb-4">
        <Row label="Ruang" value={area.name} />
        <Row label="Tanggal" value={Format.longDate(date)} />
        <Row
          label="Jam"
          value={`${Format.clock(range.start_time)}-${Format.clock(range.end_time)} (${hours} jam)`}
        />
      </dl>

      {mode === "member" && (
        <div className="border-t border-cream-200 pt-4 mb-4 space-y-3">
          {voucherCode ? (
            <div className="flex items-center justify-between text-sm bg-cream-50 border border-cream-200 rounded-lg px-3 py-2">
              <span className="flex items-center gap-1.5 text-brown-800">
                <BadgePercent size={15} /> Voucher <strong>{voucherCode}</strong>
              </span>
              <button type="button" onClick={() => onVoucher("")} className="text-brown-600 hover:text-red-600" aria-label="Hapus voucher">
                <X size={16} />
              </button>
            </div>
          ) : (
            <form onSubmit={pakaiVoucher} className="flex gap-2">
              <input
                value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value)}
                placeholder="Kode voucher"
                aria-label="Kode voucher"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-tan-300 rounded-lg uppercase focus:outline-none focus:ring-2 focus:ring-tan-300"
              />
              <Button type="submit" variant="secondary" className="text-sm" disabled={!voucherInput.trim()}>
                Pakai
              </Button>
            </form>
          )}

          {bisaPakaiKuota && (
            <label className="flex items-start gap-2 text-sm text-brown-800">
              <input
                type="checkbox"
                checked={useBenefit}
                onChange={(e) => onUseBenefit(e.target.checked)}
                className="mt-0.5 accent-brown-600"
              />
              Pakai kuota jam ruang rapat dari membership
            </label>
          )}
        </div>
      )}

      <div className="border-t border-cream-200 pt-4 text-sm space-y-2">
        {mode !== "member" ? (
          <>
            <Row label={`Harga (${hours} jam)`} value={Format.rupiah(estimasi)} />
            <p className="text-xs text-brown-600">Pajak dan voucher dihitung setelah login sebagai member.</p>
          </>
        ) : quote?.error ? (
          <p className="text-red-700">{quote.error.message}</p>
        ) : !data ? (
          <p className="text-brown-600">Menghitung harga...</p>
        ) : (
          <>
            <Row label={`Subtotal (${Format.hours(data.minutes)})`} value={Format.rupiah(data.subtotal)} />
            {data.benefit_discount > 0 && (
              <Row label={`Kuota membership (${Format.hours(data.benefit_minutes)})`} value={`-${Format.rupiah(data.benefit_discount)}`} />
            )}
            {data.voucher_discount > 0 && (
              <Row label={`Voucher ${data.voucher_code}`} value={`-${Format.rupiah(data.voucher_discount)}`} />
            )}
            <Row label={`Pajak (${data.tax_rate_percent}%)`} value={Format.rupiah(data.tax)} />
            <div className="flex justify-between text-lg font-bold text-brown-900 pt-2 border-t border-cream-200">
              <span>Total</span>
              <span>{Format.rupiah(data.total)}</span>
            </div>
          </>
        )}
      </div>

      {mode === "staff" ? (
        <p className="mt-4 text-sm text-brown-700 bg-cream-50 border border-cream-200 rounded-lg p-3">
          Booking hanya bisa dibuat dari akun member.
        </p>
      ) : (
        <Button
          onClick={onSubmit}
          loading={submitting}
          disabled={mode === "member" && !data}
          className="w-full mt-4"
        >
          {mode === "guest" ? "Login untuk Booking" : "Booking Sekarang"}
        </Button>
      )}
      {mode === "member" && (
        <p className="text-xs text-brown-600 mt-2">Slot ditahan 15 menit sampai pembayaran selesai.</p>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-brown-600">{label}</dt>
      <dd className="text-brown-900 font-medium text-right">{value}</dd>
    </div>
  );
}
