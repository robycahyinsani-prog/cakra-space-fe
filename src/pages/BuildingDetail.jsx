import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import FloorPlanMap from "../components/building/FloorPlanMap";
import useResource from "../hooks/useResource";
import Format from "../utils/Format";
import { AREA_TYPES } from "../utils/labels";
import { api } from "../api";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const TYPE_BADGE = {
  hot_desk: "bg-blue-100 text-blue-800",
  dedicated_desk: "bg-purple-100 text-purple-700",
  meeting_room: "bg-orange-100 text-orange-800",
};

export default function BuildingDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useResource(
    () => Promise.all([api.buildings.detail(id), api.buildings.areas(id)]),
    [id]
  );

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <Link to="/buildings" className="text-brown-500 hover:underline text-sm mb-4 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Kembali ke Daftar Gedung
        </Link>

        <PageState loading={loading} error={error} onRetry={reload}>
          {data && <BuildingBody detail={data[0]} areas={data[1]} />}
        </PageState>
      </div>
    </div>
  );
}

function BuildingBody({ detail, areas }) {
  const { building, operating_hours: hours, facilities, floors } = detail;
  const [filterType, setFilterType] = useState("");
  const [minCap, setMinCap] = useState("");

  const filteredAreas = areas.filter((a) => {
    if (filterType && a.type !== filterType) return false;
    if (minCap && a.capacity < Number(minCap)) return false;
    return true;
  });

  return (
    <>
      {/* Header Gedung */}
      <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-hidden mb-6">
        <img src={building.image_url} alt={building.name} className="w-full h-48 object-cover bg-cream-100" />
        <div className="p-6 grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-start gap-3 mb-2">
              <h1 className="text-2xl font-bold text-brown-900">{building.name}</h1>
              <StatusBadge status={building.status} />
            </div>
            <p className="text-brown-600 flex items-center gap-1">
              <MapPin size={16} /> {building.city}
            </p>
            <p className="text-brown-500 text-sm mt-1">{building.address}</p>
            {facilities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {facilities.map((f) => (
                  <span key={f.id} className="text-xs bg-cream-50 border border-cream-200 text-brown-700 px-2 py-1 rounded-full">
                    {f.name}
                  </span>
                ))}
              </div>
            )}
            <Link to={`/buildings/${building.id}/booking`} className="inline-block mt-5">
              <Button>
                <CalendarDays size={16} className="inline mr-2 -mt-0.5" />
                Lihat Jadwal & Booking
              </Button>
            </Link>
          </div>

          {/* Jam operasional */}
          <div className="text-sm min-w-56">
            <p className="font-semibold text-brown-900 mb-2 flex items-center gap-1">
              <Clock size={15} /> Jam Operasional
            </p>
            <dl className="space-y-1">
              {HARI.map((nama, weekday) => {
                const jam = hours.find((h) => h.weekday === weekday);
                return (
                  <div key={nama} className="flex justify-between gap-6">
                    <dt className="text-brown-600">{nama}</dt>
                    <dd className="text-brown-900 tabular-nums">
                      {!jam || jam.is_closed ? "Tutup" : `${Format.clock(jam.open_time)}-${Format.clock(jam.close_time)}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </div>

      {/* Denah Lantai Interaktif (K5-US-003.4) */}
      <FloorPlanMap floors={floors} areas={areas} editable={false} />

      {/* Daftar Ruang & Filter (K5-US-004.1) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-brown-900">Ruang Tersedia ({filteredAreas.length})</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter tipe area"
            className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white text-brown-800"
          >
            <option value="">Semua Tipe Area</option>
            {Object.entries(AREA_TYPES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={minCap}
            onChange={(e) => setMinCap(e.target.value)}
            placeholder="Min. kapasitas"
            aria-label="Minimal kapasitas"
            className="w-36 px-3 py-1.5 border border-tan-300 rounded-lg bg-white text-brown-800"
          />
        </div>
      </div>

      {filteredAreas.length === 0 ? (
        <p className="text-brown-600">Tidak ada ruang yang sesuai dengan filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAreas.map((area) => (
            <div key={area.id} className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded-full ${TYPE_BADGE[area.type]}`}>
                  {AREA_TYPES[area.type]}
                </span>
                <span className="text-xs font-mono text-brown-500">{area.code}</span>
              </div>

              <h3 className="font-semibold text-brown-900 mb-1">{area.name}</h3>
              <p className="text-xs text-brown-500 mb-2">{area.floor_name}</p>

              <p className="text-sm text-brown-600 mb-1 flex items-center gap-1">
                <Users size={14} /> Kapasitas {area.capacity} orang
              </p>
              {area.facilities.length > 0 && (
                <p className="text-sm text-brown-600 mb-3">{area.facilities.join(" · ")}</p>
              )}

              <div className="mt-auto">
                <p className="text-lg font-bold text-brown-500 mb-3">
                  {Format.rupiah(area.price_per_hour)}
                  <span className="text-sm font-normal text-brown-600">/jam</span>
                </p>

                <Link to={`/booking/${area.id}`}>
                  <Button variant="primary" className="w-full">
                    Booking Sekarang
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
