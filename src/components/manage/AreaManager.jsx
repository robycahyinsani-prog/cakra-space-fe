import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import FloorPlanMap from "../building/FloorPlanMap";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import { AREA_TYPES, AREA_STATUS } from "../../utils/labels";
import { api } from "../../api";

// kelola meja kerja dan ruang rapat di gedung aktif (BE-11..13)
export default function AreaManager({ buildingId }) {
  const { data, error, loading, reload } = useResource(
    () =>
      Promise.all([
        api.buildings.areas(buildingId),
        api.buildings.detail(buildingId),
        api.buildings.facilities("area", buildingId),
      ]),
    [buildingId]
  );

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);
  const [newFacName, setNewFacName] = useState("");

  const areas = data?.[0] || [];
  const floors = data?.[1]?.floors || [];
  const facilityOptions = data?.[2] || [];

  const bukaTambah = () => {
    setForm({
      floor_id: floors[0]?.id || "",
      code: "",
      name: "",
      type: "hot_desk",
      capacity: 4,
      price_per_hour: 25000,
      price_per_day: 150000,
      facility_ids: [],
    });
    setEditing("new");
    setAlert(null);
  };

  const bukaUbah = (area) => {
    const facIds = facilityOptions.filter((f) => area.facilities?.includes(f.name)).map((f) => f.id);
    setForm({
      floor_id: area.floor_id,
      code: area.code,
      name: area.name,
      type: area.type,
      capacity: area.capacity || 4,
      price_per_hour: area.price_per_hour,
      price_per_day: area.price_per_day,
      facility_ids: facIds,
    });
    setEditing(area.id);
    setAlert(null);
  };

  const toggleFasilitas = (id) => {
    setForm((prev) => ({
      ...prev,
      facility_ids: prev.facility_ids.includes(id)
        ? prev.facility_ids.filter((x) => x !== id)
        : [...prev.facility_ids, id],
    }));
  };

  const tambahFasilitasArea = async () => {
    if (!newFacName.trim()) return;
    setBusy(true);
    try {
      const created = await api.buildings.createFacility(newFacName.trim(), "area", buildingId);
      setNewFacName("");
      if (form) {
        setForm({ ...form, facility_ids: [...form.facility_ids, created.id] });
      }
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const simpan = async (e) => {
    e.preventDefault();
    setBusy(true);
    setAlert(null);
    const payload = {
      floor_id: Number(form.floor_id),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      type: form.type,
      capacity: form.type === "meeting_room" ? Number(form.capacity) : 1,
      price_per_hour: Number(form.price_per_hour),
      price_per_day: Number(form.price_per_day),
    };
    try {
      if (editing === "new") {
        const created = await api.buildings.createArea({ ...payload, building_id: buildingId });
        if (form.facility_ids.length > 0) {
          await api.buildings.setAreaFacilities(created.id, form.facility_ids);
        }
        setAlert({ type: "success", message: `Area ${created.name} berhasil ditambahkan.` });
      } else {
        await api.buildings.updateArea(editing, payload);
        await api.buildings.setAreaFacilities(editing, form.facility_ids);
        setAlert({ type: "success", message: "Data dan fasilitas area berhasil diperbarui." });
      }
      setEditing(null);
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const simpanStatus = async (e) => {
    e.preventDefault();
    if (!statusModal) return;
    setBusy(true);
    setAlert(null);
    try {
      const res = await api.buildings.setAreaStatus(
        statusModal.area.id,
        statusModal.status,
        statusModal.reason.trim() || null
      );
      const terdampak = res.affected_bookings || [];
      setAlert({
        type: "success",
        message:
          terdampak.length > 0
            ? `Status ${res.name} diubah. Booking aktif terdampak yang perlu dipindah: ${terdampak.join(", ")}.`
            : `Status ${res.name} diubah menjadi ${AREA_STATUS[res.status]}.`,
      });
      setStatusModal(null);
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const hapus = async (area) => {
    setBusy(true);
    setAlert(null);
    try {
      await api.buildings.deleteArea(area.id);
      setAlert({ type: "success", message: `Area ${area.name} berhasil dihapus.` });
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-brown-900">Area Meja & Ruang Rapat</h2>
        {!editing && floors.length > 0 && (
          <Button className="text-sm" onClick={bukaTambah}>
            <Plus size={16} className="inline mr-1 -mt-0.5" />
            Tambah Area
          </Button>
        )}
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      {editing && form && (
        <form onSubmit={simpan} className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 mb-4 space-y-4">
          <h3 className="font-semibold text-brown-900">
            {editing === "new" ? "Tambah Area Baru" : `Ubah Area ${form.code}`}
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block font-medium text-brown-800 mb-1">Lantai</label>
              <select
                value={form.floor_id}
                onChange={(e) => setForm({ ...form, floor_id: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Kode Area</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="A1 / M1"
                required
                maxLength={10}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-brown-800 mb-1">Nama Area</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Hot Desk A1 / Meeting Room Merdeka"
                required
                minLength={2}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block font-medium text-brown-800 mb-1">Tipe Area</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
              >
                {Object.entries(AREA_TYPES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Kapasitas (orang)</label>
              <input
                type="number"
                min={form.type === "meeting_room" ? 2 : 1}
                max={200}
                disabled={form.type !== "meeting_room"}
                value={form.type === "meeting_room" ? form.capacity : 1}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg disabled:bg-cream-50"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Harga per Jam (Rp)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={form.price_per_hour}
                onChange={(e) => setForm({ ...form, price_per_hour: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Batas Harga Harian (Rp)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={form.price_per_day}
                onChange={(e) => setForm({ ...form, price_per_day: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
          </div>

          <div className="text-sm">
            <p className="font-medium text-brown-800 mb-1.5">Fasilitas Area</p>
            <div className="flex flex-wrap gap-3 mb-2">
              {facilityOptions.map((f) => (
                <label key={f.id} className="inline-flex items-center gap-1.5 text-brown-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.facility_ids.includes(f.id)}
                    onChange={() => toggleFasilitas(f.id)}
                    className="accent-brown-600"
                  />
                  {f.name}
                </label>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <input
                value={newFacName}
                onChange={(e) => setNewFacName(e.target.value)}
                placeholder="Tambah fasilitas area baru..."
                className="flex-1 px-3 py-1.5 text-xs border border-tan-300 rounded-lg"
              />
              <Button
                type="button"
                variant="secondary"
                className="text-xs py-1.5"
                disabled={busy || !newFacName.trim()}
                onClick={tambahFasilitasArea}
              >
                Tambah
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button type="submit" className="text-sm" loading={busy}>
              Simpan Area
            </Button>
          </div>
        </form>
      )}

      {statusModal && (
        <form
          onSubmit={simpanStatus}
          className="bg-white rounded-xl shadow-sm border border-cream-200 p-4 mb-4 flex flex-wrap items-end gap-3 text-sm"
        >
          <div>
            <label className="block text-xs font-medium text-brown-800 mb-1">
              Ubah Status: <strong>{statusModal.area.name}</strong>
            </label>
            <select
              value={statusModal.status}
              onChange={(e) => setStatusModal({ ...statusModal, status: e.target.value })}
              className="px-3 py-2 border border-tan-300 rounded-lg bg-white"
            >
              {Object.entries(AREA_STATUS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-brown-800 mb-1">Alasan (dicatat di audit log)</label>
            <input
              value={statusModal.reason}
              onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
              placeholder="Contoh: Perbaikan AC / proyektor"
              className="w-full px-3 py-2 border border-tan-300 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setStatusModal(null)}>
              Batal
            </Button>
            <Button type="submit" className="text-sm" loading={busy}>
              Simpan Status
            </Button>
          </div>
        </form>
      )}

      <PageState loading={loading} error={error} onRetry={reload}>
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-cream-50 text-brown-800">
                <th className="p-3 font-semibold">Kode</th>
                <th className="p-3 font-semibold">Nama & Fasilitas</th>
                <th className="p-3 font-semibold">Lantai</th>
                <th className="p-3 font-semibold">Tipe</th>
                <th className="p-3 font-semibold text-right">Kapasitas</th>
                <th className="p-3 font-semibold text-right">Tarif/Jam</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {areas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-brown-500">
                    Belum ada area di gedung ini.
                  </td>
                </tr>
              ) : (
                areas.map((a) => (
                  <tr key={a.id} className="hover:bg-cream-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-brown-900">{a.code}</td>
                    <td className="p-3">
                      <p className="font-semibold text-brown-900">{a.name}</p>
                      {a.facilities?.length > 0 && (
                        <p className="text-xs text-brown-500 mt-0.5">{a.facilities.join(" · ")}</p>
                      )}
                    </td>
                    <td className="p-3 text-brown-700 whitespace-nowrap">{a.floor_name || "-"}</td>
                    <td className="p-3 text-brown-700 whitespace-nowrap">{AREA_TYPES[a.type]}</td>
                    <td className="p-3 text-right tabular-nums text-brown-700">{a.capacity} org</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <span className="font-medium text-brown-900">{Format.rupiah(a.price_per_hour)}</span>
                      <span className="text-xs text-brown-500 block">Maks {Format.rupiah(a.price_per_day)}/hari</span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setStatusModal({ area: a, status: a.status, reason: "" })}
                        title="Klik untuk ubah status area"
                      >
                        <StatusBadge status={a.status} />
                      </button>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => bukaUbah(a)}
                          disabled={busy}
                          title="Ubah area"
                          className="p-1.5 text-brown-600 hover:text-brown-900 rounded-lg hover:bg-cream-100"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => hapus(a)}
                          disabled={busy}
                          title="Hapus area"
                          className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <FloorPlanMap floors={floors} areas={areas} editable={true} onChanged={reload} />
        </div>
      </PageState>
    </section>
  );
}
