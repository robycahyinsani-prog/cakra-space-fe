import Format from "../../utils/Format";
import { SLOT_STATUS } from "../../utils/labels";

const STYLE = {
  available: "bg-white border-tan-300 text-brown-900 hover:bg-cream-50 cursor-pointer",
  booked: "bg-cream-100 border-transparent text-brown-700/70 line-through",
  past: "bg-gray-100 border-transparent text-gray-400",
  closed: "bg-gray-100 border-transparent text-gray-400",
};

// grid jam per area: klik jam kosong untuk memilih, klik jam lain untuk memperpanjang rentang
export default function SlotGrid({ areaId, slots, selection, onPick, disabled = false }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] gap-2">
      {slots.map((slot, index) => {
        const dipilih = Boolean(selection?.contains(areaId, index));
        const bisa = slot.status === "available" && !disabled;
        return (
          <li key={slot.start_time}>
            <button
              type="button"
              disabled={!bisa}
              aria-pressed={dipilih}
              aria-label={`${Format.clock(slot.start_time)}, ${SLOT_STATUS[slot.status]}`}
              onClick={() => onPick(index)}
              className={`w-full flex flex-col items-center rounded-lg border px-1 py-2 leading-tight transition-colors disabled:cursor-not-allowed ${
                dipilih ? "bg-brown-600 border-brown-600 text-white" : STYLE[slot.status]
              }`}
            >
              <span className="text-sm font-bold tabular-nums">{Format.clock(slot.start_time)}</span>
              <span className={`text-[11px] mt-0.5 ${dipilih ? "text-white/90" : slot.status === "available" ? "text-brown-600 font-medium" : ""}`}>
                {slot.status === "available" ? Format.rupiahShort(slot.price) : SLOT_STATUS[slot.status]}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SlotLegend() {
  const item = (cls, label) => (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3.5 h-3.5 rounded border ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-brown-700">
      {item("bg-white border-tan-300", "Tersedia")}
      {item("bg-brown-600 border-brown-600", "Dipilih")}
      {item("bg-cream-100 border-transparent", "Terisi")}
      {item("bg-gray-100 border-transparent", "Lewat")}
    </div>
  );
}
