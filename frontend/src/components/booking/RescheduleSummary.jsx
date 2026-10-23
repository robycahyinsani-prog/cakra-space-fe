import { ArrowDown } from "lucide-react";
import Button from "../Button";
import Format from "../../utils/Format";

// ringkasan pindah jadwal: jadwal lama di atas, jadwal baru di bawah (BE-19)
export default function RescheduleSummary({ original, minutes, date, range, onSubmit, submitting }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
      <h2 className="font-semibold text-brown-900 mb-1">Ubah Jadwal {original.code}</h2>
      <p className="text-sm text-brown-600 mb-4">
        {original.area.name}. Durasi tetap {Format.hours(minutes)} dan harga tidak berubah.
      </p>

      <div className="text-sm rounded-lg bg-cream-50 border border-cream-200 p-3">
        <p className="text-brown-600">Jadwal lama</p>
        <p className="font-medium text-brown-900">
          {Format.longDate(original.local_date)}, {Format.clock(original.local_start)}-{Format.clock(original.local_end)}
        </p>
      </div>
      <ArrowDown size={18} className="mx-auto my-2 text-brown-500" />
      <div className="text-sm rounded-lg border border-brown-500 p-3">
        <p className="text-brown-600">Jadwal baru</p>
        <p className="font-medium text-brown-900">
          {range
            ? `${Format.longDate(date)}, ${Format.clock(range.start_time)}-${Format.clock(range.end_time)}`
            : "Klik jam mulai pada grid"}
        </p>
      </div>

      <Button onClick={onSubmit} loading={submitting} disabled={!range} className="w-full mt-4">
        Pindahkan Jadwal
      </Button>
      {original.cancel_deadline && (
        <p className="text-xs text-brown-600 mt-2">Bisa diubah sampai {Format.dateTime(original.cancel_deadline)}.</p>
      )}
    </div>
  );
}
