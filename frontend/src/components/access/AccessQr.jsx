import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { QrCode } from "lucide-react";
import { api } from "../../api";

// QR akses member yang berganti tiap 30 detik (BE-30), dipindai di pintu atau resepsionis
export default function AccessQr() {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let aktif = true;
    let timer;
    const muat = async () => {
      try {
        const data = await api.member.accessQr();
        if (!aktif) return;
        setQr({ ...data, expiresAt: Date.now() + data.expires_in * 1000 });
        setError(null);
        timer = setTimeout(muat, Math.max(data.refresh_after, 1) * 1000);
      } catch (err) {
        if (aktif) setError(err);
      }
    };
    muat();
    return () => {
      aktif = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const sisa = qr ? Math.max(0, Math.ceil((qr.expiresAt - now) / 1000)) : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 text-center">
      <div className="flex items-center justify-center gap-2 mb-3 text-brown-900 font-semibold">
        <QrCode size={18} />
        QR Akses Gedung
      </div>
      {error ? (
        <p className="text-sm text-red-700">{error.message}</p>
      ) : qr ? (
        <>
          <div className="inline-block bg-white p-3 border-2 border-cream-200 rounded-xl">
            <QRCode value={qr.token} size={168} bgColor="#ffffff" fgColor="#583101" />
          </div>
          <p className="text-xs text-brown-600 mt-3">
            Berganti otomatis dalam <span className="font-semibold tabular-nums">{sisa} detik</span>. Tunjukkan di
            pintu atau resepsionis.
          </p>
        </>
      ) : (
        <p className="text-sm text-brown-600 py-16">Menyiapkan QR...</p>
      )}
    </div>
  );
}
