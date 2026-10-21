import { useState } from "react";
import { Link } from "react-router-dom";
import { Map, Upload, Crosshair } from "lucide-react";
import Button from "../Button";
import PageState from "../common/PageState";
import useResource from "../../hooks/useResource";
import { AREA_TYPES } from "../../utils/labels";
import { api } from "../../api";

const PIN_STYLE = {
  available: {
    dot: "bg-emerald-600 border-white text-white ring-emerald-200",
    label: "Tersedia",
    badge: "bg-emerald-100 text-emerald-800",
  },
  occupied: {
    dot: "bg-amber-500 border-white text-white ring-amber-200",
    label: "Terisi",
    badge: "bg-amber-100 text-amber-800",
  },
  maintenance: {
    dot: "bg-red-600 border-white text-white ring-red-200",
    label: "Perawatan",
    badge: "bg-red-100 text-red-800",
  },
};

// denah lantai interaktif untuk member (FE-23) & editor posisi titik untuk pengelola (FE-61)
export default function FloorPlanMap({ floors = [], areas = [], editable = false, onChanged }) {
  const [selectedFloorId, setSelectedFloorId] = useState(floors[0]?.id ?? null);
  const floorId = floors.some((f) => f.id === selectedFloorId) ? selectedFloorId : (floors[0]?.id ?? null);

  const { data: mapData, error, loading, reload } = useResource(
    () => (floorId ? api.buildings.floorMap(floorId) : Promise.resolve(null)),
    [floorId]
  );

  const [selectedPin, setSelectedPin] = useState(null);
  const [placingAreaId, setPlacingAreaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [imgKey, setImgKey] = useState(0);

  if (!floors.length) return null;

  const floorAreas = areas.filter((a) => a.floor_id === floorId);
  const pins = mapData?.areas || [];
  const activePin = pins.find((p) => p.area_id === selectedPin) || pins[0] || null;

  const handleCanvasClick = async (e) => {
    if (!editable || !placingAreaId || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const posX = Math.max(2, Math.min(98, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1))));
    const posY = Math.max(2, Math.min(98, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1))));
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.buildings.setAreaPosition(Number(placingAreaId), posX, posY);
      setSelectedPin(Number(placingAreaId));
      setMsg(`Titik koordinat berhasil disimpan (${posX}%, ${posY}%).`);
      reload();
      if (onChanged) onChanged();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUploadPlan = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !floorId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.buildings.uploadFloorPlan(floorId, file);
      setImgKey((k) => k + 1);
      setMsg("Gambar denah lantai berhasil diunggah.");
      reload();
      if (onChanged) onChanged();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Map size={18} className="text-brown-600" />
          <h2 className="text-lg font-semibold text-brown-900">
            {editable ? "Editor Denah Lantai & Titik Koordinat Area" : "Denah Lantai & Posisi Meja/Ruang"}
          </h2>
        </div>

        {/* Pilihan Lantai */}
        <div className="flex flex-wrap gap-1.5">
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setSelectedFloorId(f.id);
                setSelectedPin(null);
                setPlacingAreaId("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                f.id === floorId
                  ? "bg-brown-600 text-white"
                  : "bg-cream-100 text-brown-700 hover:bg-cream-200"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs text-brown-700">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Tersedia
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Terisi
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Perawatan
          </span>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-tan-300 bg-cream-50 hover:bg-cream-100 text-brown-800 cursor-pointer font-medium">
              <Upload size={13} />
              <span>Unggah Gambar Denah</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleUploadPlan}
                disabled={busy}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {editable && (
        <div className="mb-3 p-3 rounded-lg bg-cream-50 border border-cream-200 flex flex-wrap items-center gap-3 text-xs text-brown-800">
          <Crosshair size={15} className="text-brown-600" />
          <span className="font-medium">Atur Posisi Titik Area:</span>
          <select
            value={placingAreaId}
            onChange={(e) => setPlacingAreaId(e.target.value)}
            aria-label="Pilih area untuk ditempatkan di denah"
            className="px-2.5 py-1.5 border border-tan-300 rounded-lg bg-white text-brown-900"
          >
            <option value="">-- Pilih area di lantai ini lalu klik pada gambar denah --</option>
            {floorAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name} {a.pos_x != null ? `(${a.pos_x}%, ${a.pos_y}%)` : "(belum ditempatkan)"}
              </option>
            ))}
          </select>
          {placingAreaId && (
            <span className="text-brown-600">
              Klik di mana saja pada area denah di bawah untuk menaruh titik <strong>{floorAreas.find((a) => a.id === Number(placingAreaId))?.code}</strong>.
            </span>
          )}
        </div>
      )}

      {msg && <p className="text-xs text-green-700 mb-2">{msg}</p>}
      {err && <p className="text-xs text-red-700 mb-2">{err}</p>}

      <PageState loading={loading} error={error} onRetry={reload}>
        {mapData && (
          <div className="grid gap-4 lg:grid-cols-[1fr_260px] items-start">
            {/* Kanvas Denah Responsif (bisa dipakai di ponsel maupun desktop) */}
            <div
              onClick={handleCanvasClick}
              role={editable && placingAreaId ? "button" : undefined}
              tabIndex={editable && placingAreaId ? 0 : undefined}
              className={`relative w-full aspect-[16/10] min-h-56 rounded-xl border border-cream-200 overflow-hidden select-none ${
                editable && placingAreaId ? "cursor-crosshair ring-2 ring-brown-400" : ""
              }`}
              style={{
                background:
                  "repeating-linear-gradient(0deg, #faf6f0, #faf6f0 23px, #efe6d8 24px), repeating-linear-gradient(90deg, #faf6f0, #faf6f0 23px, #efe6d8 24px)",
              }}
            >
              {mapData.has_plan ? (
                <img
                  key={`${floorId}-${imgKey}`}
                  src={`${api.buildings.floorPlanUrl(floorId)}?v=${imgKey}`}
                  alt={`Denah ${mapData.floor.name}`}
                  className="w-full h-full object-contain bg-cream-50"
                />
              ) : (
                <div className="absolute inset-3 border-2 border-dashed border-tan-300 rounded-lg pointer-events-none flex flex-col justify-between p-3 text-[11px] text-brown-500">
                  <div className="flex justify-between">
                    <span>Pintu Masuk & Resepsionis</span>
                    <span>{mapData.floor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Area Kerja Bersama & Pantry</span>
                    <span>Ruang Rapat</span>
                  </div>
                </div>
              )}

              {/* Titik-titik Area */}
              {pins.map((pin) => {
                const st = PIN_STYLE[pin.status] || PIN_STYLE.available;
                const isSelected = activePin?.area_id === pin.area_id;
                return (
                  <button
                    key={pin.area_id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPin(pin.area_id);
                    }}
                    style={{ left: `${pin.pos_x}%`, top: `${pin.pos_y}%` }}
                    title={`${pin.code} · ${pin.name} (${st.label})`}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full border-2 text-[11px] font-bold shadow-md transition-transform ${
                      st.dot
                    } ${isSelected ? "scale-125 ring-4 z-10" : "hover:scale-110"}`}
                  >
                    {pin.code}
                  </button>
                );
              })}
            </div>

            {/* Panel Detail Titik yang Dipilih */}
            <div className="bg-cream-50 rounded-xl border border-cream-200 p-4 text-sm">
              {activePin ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-brown-900 text-base">{activePin.code}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        (PIN_STYLE[activePin.status] || PIN_STYLE.available).badge
                      }`}
                    >
                      {(PIN_STYLE[activePin.status] || PIN_STYLE.available).label}
                    </span>
                  </div>
                  <p className="font-semibold text-brown-900">{activePin.name}</p>
                  <p className="text-xs text-brown-600">
                    {AREA_TYPES[activePin.type]} · Posisi ({activePin.pos_x}%, {activePin.pos_y}%)
                  </p>
                  {!editable && activePin.status === "available" && (
                    <Link to={`/booking/${activePin.area_id}`} className="block pt-2">
                      <Button className="w-full text-xs">Pilih & Booking Ruang Ini</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-xs text-brown-600">
                  Belum ada titik area yang ditempatkan pada {mapData.floor.name}.
                </p>
              )}
            </div>
          </div>
        )}
      </PageState>
    </div>
  );
}
