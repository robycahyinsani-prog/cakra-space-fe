import { useEffect, useRef } from "react";

// strip tanggal yang bisa digeser, hari tutup atau libur tidak bisa dipilih
export default function DateStrip({ days, value, onChange }) {
  const stripRef = useRef(null);

  // tanggal terpilih digeser ke area terlihat, misalnya saat dibuka dari link berisi ?date=
  useEffect(() => {
    // diukur sesudah layout selesai supaya posisi tombol sudah final
    const frame = requestAnimationFrame(() => {
      const strip = stripRef.current;
      const aktif = strip?.querySelector('[aria-selected="true"]');
      if (!strip || !aktif) return;
      const kiri = aktif.offsetLeft - strip.offsetLeft;
      const terlihat = kiri >= strip.scrollLeft && kiri + aktif.offsetWidth <= strip.scrollLeft + strip.clientWidth;
      if (!terlihat) strip.scrollLeft = kiri - 8;
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x" role="listbox" aria-label="Pilih tanggal">
      {days.map((day) => {
        const aktif = day.iso === value;
        const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
        return (
          <button
            key={day.iso}
            type="button"
            role="option"
            aria-selected={aktif}
            disabled={day.closed}
            title={day.note}
            onClick={() => onChange(day.iso)}
            className={`snap-start flex-none w-[76px] flex flex-col items-center rounded-xl border px-1.5 py-2.5 leading-tight transition-colors ${
              aktif
                ? "bg-brown-600 border-brown-600 text-white"
                : day.closed
                  ? "bg-cream-50 border-cream-200 text-brown-700/50 cursor-not-allowed"
                  : "bg-white border-cream-200 text-brown-900 hover:border-brown-500"
            }`}
          >
            <span className={`text-xs font-semibold ${aktif ? "text-white/85" : weekend ? "text-brown-500" : "text-brown-600"}`}>
              {day.date.toLocaleDateString("id-ID", { weekday: "short" })}
            </span>
            <span className="text-xl font-extrabold my-0.5">{day.date.getDate()}</span>
            <span className={`text-xs ${aktif ? "text-white/85" : "text-brown-600"}`}>
              {day.date.toLocaleDateString("id-ID", { month: "short" })}
            </span>
            <span
              className={`mt-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                aktif ? "bg-white/20" : day.closed ? "bg-cream-100 text-brown-700/70" : "bg-cream-50 text-brown-700"
              }`}
            >
              {day.closed ? "Tutup" : "Buka"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
