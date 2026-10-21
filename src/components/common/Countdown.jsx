import { useEffect, useState } from "react";

// sisa waktu sampai batas tertentu, format mm:ss
export default function Countdown({ until, onExpire }) {
  const [now, setNow] = useState(() => Date.now());
  const sisa = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sisa === 0 && onExpire) onExpire();
  }, [sisa, onExpire]);

  const menit = String(Math.floor(sisa / 60)).padStart(2, "0");
  const detik = String(sisa % 60).padStart(2, "0");
  return <span className="font-mono font-semibold tabular-nums">{menit}:{detik}</span>;
}
