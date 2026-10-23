import { useEffect, useState } from "react";
import { CreditCard, Landmark, Smartphone, Copy } from "lucide-react";
import Button from "../Button";
import Countdown from "../common/Countdown";
import Format from "../../utils/Format";
import { PAYMENT_METHODS } from "../../utils/labels";
import { api } from "../../api";

const ICONS = { virtual_account: Landmark, e_wallet: Smartphone, credit_card: CreditCard };
const POLL_MS = 4000;

// pilih metode, tampilkan instruksi bayar, lalu pantau status sampai webhook gateway masuk
export default function PaymentPanel({ booking, amount, onPay, title, onCancel, onChanged }) {
  const initial = booking?.payment;
  const total = amount ?? booking?.total ?? 0;

  // ringkasan dari data booking dipakai dulu supaya instruksi bayar langsung tampil
  const [payment, setPayment] = useState(() => (initial?.status === "pending" ? initial : null));
  const [method, setMethod] = useState("virtual_account");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // pembayaran yang sudah dibuat sebelumnya dimuat lengkap (butuh gateway_ref)
  useEffect(() => {
    if (initial?.status === "pending") {
      api.payments.get(initial.id).then(setPayment, setError);
    }
  }, [initial]);

  // status dicek berkala selama masih pending
  useEffect(() => {
    if (payment?.status !== "pending") return;
    const timer = setInterval(async () => {
      try {
        const latest = await api.payments.get(payment.id);
        if (latest.status !== "pending") {
          setPayment(latest);
          onChanged();
        }
      } catch {
        // dicoba lagi pada putaran berikutnya
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [payment, onChanged]);

  const bayar = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = onPay ? await onPay(method) : await api.payments.payBooking(booking.id, method);
      if (res.payment) {
        setPayment(res.payment);
      } else {
        onChanged();
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const simulasi = async (outcome) => {
    setBusy(true);
    try {
      await api.payments.simulate(payment.gateway_ref, outcome);
      setPayment(await api.payments.get(payment.id));
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (payment?.status === "pending") {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-brown-900">Pembayaran {PAYMENT_METHODS[payment.method]}</h2>
          <span className="text-sm text-brown-700">
            Sisa waktu <Countdown until={payment.expires_at} onExpire={onChanged} />
          </span>
        </div>

        <p className="text-sm text-brown-600">Jumlah yang harus dibayar</p>
        <p className="text-2xl font-bold text-brown-900 mb-4">{Format.rupiah(payment.amount ?? total)}</p>

        {payment.va_number && (
          <div className="bg-cream-50 border border-cream-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-brown-600 mb-1">Nomor Virtual Account</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xl font-bold tracking-wider text-brown-900 break-all">{payment.va_number}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(payment.va_number)}
                className="text-brown-600 hover:text-brown-900"
                aria-label="Salin nomor virtual account"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>
        )}
        {payment.payment_url && (
          <a href={payment.payment_url} className="block mb-4">
            <Button className="w-full">Lanjut ke Halaman Pembayaran</Button>
          </a>
        )}

        <p className="text-xs text-brown-600">Status diperbarui otomatis setelah pembayaran diterima.</p>
        {error && <p className="text-sm text-red-700 mt-3">{error.message}</p>}

        {import.meta.env.DEV && (
          <div className="mt-4 border-t border-dashed border-cream-200 pt-4">
            <p className="text-xs text-brown-600 mb-2">Mode pengembangan: tiru notifikasi dari payment gateway sandbox.</p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="text-sm flex-1"
                loading={busy}
                disabled={!payment.gateway_ref}
                onClick={() => simulasi("success")}
              >
                Simulasikan Berhasil
              </Button>
              <Button
                variant="secondary"
                className="text-sm flex-1"
                disabled={busy || !payment.gateway_ref}
                onClick={() => simulasi("failed")}
              >
                Simulasikan Gagal
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
      <h2 className="font-semibold text-brown-900 mb-1">{title || "Pilih Metode Pembayaran"}</h2>
      {payment && payment.status !== "success" && (
        <p className="text-sm text-red-700 mb-2">Pembayaran sebelumnya gagal atau kedaluwarsa. Silakan coba lagi.</p>
      )}
      <div className="grid gap-2 my-4" role="radiogroup">
        {Object.entries(PAYMENT_METHODS).map(([value, label]) => {
          const Icon = ICONS[value];
          return (
            <label
              key={value}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer ${
                method === value ? "border-brown-600 bg-cream-50" : "border-cream-200 hover:bg-cream-50"
              }`}
            >
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
                className="accent-brown-600"
              />
              <Icon size={18} className="text-brown-700" />
              <span className="text-brown-900">{label}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-700 mb-3">{error.message}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">
            Batal
          </Button>
        )}
        <Button onClick={bayar} loading={busy} className="flex-1">
          Bayar {Format.rupiah(total)}
        </Button>
      </div>
    </div>
  );
}
