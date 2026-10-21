import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import { api } from "../../api";

const EMPTY = {
  name: "",
  description: "",
  duration_days: 30,
  price: 1500000,
  meeting_room_hours: 10,
  building_ids: [],
};

// kelola paket membership untuk pengelola pusat (BE-34)
export default function PlanManager({ buildings }) {
  const { data: plans, error, loading, reload } = useResource(() => api.manage.plans(), []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const bukaTambah = () => {
    setForm(EMPTY);
    setEditing("new");
    setAlert(null);
  };

  const bukaUbah = (plan) => {
    const kuota = plan.benefits?.find((b) => b.benefit_type === "meeting_room_hours");
    setForm({
      name: plan.name,
      description: plan.description || "",
      duration_days: plan.duration_days,
      price: plan.price,
      meeting_room_hours: kuota ? kuota.quantity : 0,
      building_ids: plan.building_ids || [],
    });
    setEditing(plan.id);
    setAlert(null);
  };

  const toggleGedung = (id) => {
    setForm((prev) => ({
      ...prev,
      building_ids: prev.building_ids.includes(id)
        ? prev.building_ids.filter((x) => x !== id)
        : [...prev.building_ids, id],
    }));
  };

  const simpan = async (e) => {
    e.preventDefault();
    setBusy(true);
    setAlert(null);
    const jam = Number(form.meeting_room_hours || 0);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      duration_days: Number(form.duration_days),
      price: Number(form.price),
      building_ids: form.building_ids,
      benefits: jam > 0 ? [{ benefit_type: "meeting_room_hours", quantity: jam }] : [],
    };
    try {
      if (editing === "new") {
        await api.manage.createPlan(payload);
        setAlert({ type: "success", message: "Paket membership baru berhasil dibuat." });
      } else {
        await api.manage.updatePlan(editing, payload);
        setAlert({ type: "success", message: "Paket membership berhasil diperbarui." });
      }
      setEditing(null);
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const hapus = async (plan) => {
    setBusy(true);
    setAlert(null);
    try {
      const res = await api.manage.removePlan(plan.id);
      setAlert({
        type: "success",
        message: res.archived
          ? `Paket ${plan.name} sudah punya pelanggan sehingga diarsipkan.`
          : `Paket ${plan.name} berhasil dihapus.`,
      });
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const namaGedung = (ids) => {
    if (!ids || ids.length === 0) return "Semua gedung";
    return ids.map((id) => buildings.find((b) => b.id === id)?.name || `#${id}`).join(", ");
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-brown-900">Paket Membership</h2>
        {!editing && (
          <Button className="text-sm" onClick={bukaTambah}>
            <Plus size={16} className="inline mr-1 -mt-0.5" />
            Tambah Paket
          </Button>
        )}
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      {editing && (
        <form onSubmit={simpan} className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 mb-4 space-y-4">
          <h3 className="font-semibold text-brown-900">
            {editing === "new" ? "Tambah Paket Membership" : "Ubah Paket Membership"}
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="sm:col-span-2">
              <label className="block font-medium text-brown-800 mb-1">Nama Paket</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Member Bulanan"
                required
                minLength={3}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Durasi (hari)</label>
              <input
                type="number"
                min={1}
                max={366}
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Harga (Rp)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="sm:col-span-2">
              <label className="block font-medium text-brown-800 mb-1">Deskripsi</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Penjelasan singkat benefit paket"
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Benefit Ruang Rapat (jam)</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={form.meeting_room_hours}
                onChange={(e) => setForm({ ...form, meeting_room_hours: e.target.value })}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
          </div>

          <div className="text-sm">
            <p className="font-medium text-brown-800 mb-1.5">
              Cakupan Gedung <span className="text-xs font-normal text-brown-500">(kosongkan untuk semua gedung)</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {buildings.map((b) => (
                <label key={b.id} className="inline-flex items-center gap-1.5 text-brown-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.building_ids.includes(b.id)}
                    onChange={() => toggleGedung(b.id)}
                    className="accent-brown-600"
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button type="submit" className="text-sm" loading={busy}>
              Simpan Paket
            </Button>
          </div>
        </form>
      )}

      <PageState loading={loading} error={error} onRetry={reload}>
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-cream-50 text-brown-800">
                <th className="p-3 font-semibold">Paket</th>
                <th className="p-3 font-semibold">Cakupan Gedung</th>
                <th className="p-3 font-semibold">Benefit</th>
                <th className="p-3 font-semibold text-right">Harga</th>
                <th className="p-3 font-semibold text-right">Pelanggan</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(plans || []).map((p) => {
                const kuota = p.benefits?.find((b) => b.benefit_type === "meeting_room_hours");
                return (
                  <tr key={p.id} className="hover:bg-cream-50 transition-colors">
                    <td className="p-3">
                      <p className="font-semibold text-brown-900">{p.name}</p>
                      <p className="text-xs text-brown-500">{p.description}</p>
                    </td>
                    <td className="p-3 text-brown-700">{namaGedung(p.building_ids)}</td>
                    <td className="p-3 text-brown-700 whitespace-nowrap">
                      {kuota ? `${kuota.quantity} jam rapat` : "-"} · {p.duration_days} hari
                    </td>
                    <td className="p-3 text-right font-medium text-brown-900 whitespace-nowrap">
                      {Format.rupiah(p.price)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-brown-700">{p.subscriber_count}</td>
                    <td className="p-3">
                      <StatusBadge status={p.is_archived ? "inactive" : "active"} />
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {!p.is_archived && (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => bukaUbah(p)}
                            disabled={busy}
                            title="Ubah paket"
                            className="p-1.5 text-brown-600 hover:text-brown-900 rounded-lg hover:bg-cream-100"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => hapus(p)}
                            disabled={busy}
                            title={p.subscriber_count > 0 ? "Arsipkan paket" : "Hapus paket"}
                            className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
