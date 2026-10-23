import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import { DISCOUNT_TYPES } from "../../utils/labels";
import { api } from "../../api";

function defaultDates() {
  const today = new Date();
  const until = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return {
    code: "",
    description: "",
    discount_type: "percent",
    discount_value: 10,
    max_discount: 50000,
    quota: 50,
    valid_from: Format.isoDate(today),
    valid_until: Format.isoDate(until),
    building_ids: [],
    is_active: true,
  };
}

// kelola voucher diskon per gedung atau semua gedung (BE-29)
export default function VoucherManager({ buildings }) {
  const { data: vouchers, error, loading, reload } = useResource(() => api.manage.vouchers(), []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultDates);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const bukaTambah = () => {
    setForm(defaultDates());
    setEditing("new");
    setAlert(null);
  };

  const bukaUbah = (v) => {
    setForm({
      code: v.code,
      description: v.description || "",
      discount_type: v.discount_type,
      discount_value: v.discount_value,
      max_discount: v.max_discount ?? "",
      quota: v.quota,
      valid_from: v.valid_from,
      valid_until: v.valid_until,
      building_ids: v.building_ids || [],
      is_active: v.is_active,
    });
    setEditing(v.id);
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
    const payload = {
      description: form.description.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_discount:
        form.discount_type === "percent" && form.max_discount !== "" && Number(form.max_discount) > 0
          ? Number(form.max_discount)
          : null,
      quota: Number(form.quota),
      valid_from: form.valid_from,
      valid_until: form.valid_until,
      building_ids: form.building_ids,
      is_active: form.is_active,
    };
    try {
      if (editing === "new") {
        await api.manage.createVoucher({ ...payload, code: form.code.trim().toUpperCase() });
        setAlert({ type: "success", message: "Voucher baru berhasil dibuat." });
      } else {
        await api.manage.updateVoucher(editing, payload);
        setAlert({ type: "success", message: "Voucher berhasil diperbarui." });
      }
      setEditing(null);
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleAktif = async (v) => {
    setBusy(true);
    setAlert(null);
    try {
      await api.manage.updateVoucher(v.id, { is_active: !v.is_active });
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const hapus = async (v) => {
    setBusy(true);
    setAlert(null);
    try {
      await api.manage.deleteVoucher(v.id);
      setAlert({ type: "success", message: `Voucher ${v.code} berhasil dihapus.` });
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
        <h2 className="text-lg font-semibold text-brown-900">Voucher Promo</h2>
        {!editing && (
          <Button className="text-sm" onClick={bukaTambah}>
            <Plus size={16} className="inline mr-1 -mt-0.5" />
            Buat Voucher
          </Button>
        )}
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      {editing && (
        <form onSubmit={simpan} className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 mb-4 space-y-4">
          <h3 className="font-semibold text-brown-900">
            {editing === "new" ? "Buat Voucher Baru" : `Ubah Voucher ${form.code}`}
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block font-medium text-brown-800 mb-1">Kode Voucher</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                disabled={editing !== "new"}
                placeholder="CAKRA10"
                required
                minLength={3}
                maxLength={30}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg font-mono disabled:bg-cream-50"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Jenis Diskon</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
              >
                {Object.entries(DISCOUNT_TYPES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">
                Nilai Diskon ({form.discount_type === "percent" ? "%" : "Rp"})
              </label>
              <input
                type="number"
                min={1}
                max={form.discount_type === "percent" ? 100 : undefined}
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            {form.discount_type === "percent" && (
              <div>
                <label className="block font-medium text-brown-800 mb-1">Maks. Potongan (Rp)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={form.max_discount}
                  onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                  placeholder="Tanpa batas"
                  className="w-full px-3 py-2 border border-tan-300 rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block font-medium text-brown-800 mb-1">Kuota Pemakaian</label>
              <input
                type="number"
                min={1}
                value={form.quota}
                onChange={(e) => setForm({ ...form, quota: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Berlaku Dari</label>
              <input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Berlaku Sampai</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                required
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Keterangan</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Diskon promo bulanan"
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-medium text-brown-800 mb-1">
                Berlaku di Gedung <span className="text-xs font-normal text-brown-500">(kosongkan untuk semua gedung)</span>
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

            <label className="inline-flex items-center gap-2 font-medium text-brown-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="accent-brown-600"
              />
              Voucher Aktif
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button type="submit" className="text-sm" loading={busy}>
              Simpan Voucher
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
                <th className="p-3 font-semibold">Potongan</th>
                <th className="p-3 font-semibold">Gedung</th>
                <th className="p-3 font-semibold">Masa Berlaku</th>
                <th className="p-3 font-semibold text-right">Terpakai</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(vouchers || []).length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-brown-500">
                    Belum ada voucher.
                  </td>
                </tr>
              ) : (
                (vouchers || []).map((v) => (
                  <tr key={v.id} className="hover:bg-cream-50 transition-colors">
                    <td className="p-3">
                      <span className="font-mono font-bold text-brown-900">{v.code}</span>
                      {v.description && <p className="text-xs text-brown-500 mt-0.5">{v.description}</p>}
                    </td>
                    <td className="p-3 text-brown-800 whitespace-nowrap">
                      {v.discount_type === "percent"
                        ? `${v.discount_value}%${v.max_discount ? ` (maks ${Format.rupiah(v.max_discount)})` : ""}`
                        : Format.rupiah(v.discount_value)}
                    </td>
                    <td className="p-3 text-brown-700">{namaGedung(v.building_ids)}</td>
                    <td className="p-3 text-brown-700 whitespace-nowrap">
                      {Format.shortDate(v.valid_from)} – {Format.shortDate(v.valid_until)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-brown-700">
                      {v.used_count} / {v.quota}
                    </td>
                    <td className="p-3">
                      <button type="button" onClick={() => toggleAktif(v)} disabled={busy} title="Klik untuk ubah status">
                        <StatusBadge status={v.is_active ? "active" : "inactive"} />
                      </button>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => bukaUbah(v)}
                          disabled={busy}
                          title="Ubah voucher"
                          className="p-1.5 text-brown-600 hover:text-brown-900 rounded-lg hover:bg-cream-100"
                        >
                          <Pencil size={15} />
                        </button>
                        {v.used_count === 0 && (
                          <button
                            type="button"
                            onClick={() => hapus(v)}
                            disabled={busy}
                            title="Hapus voucher"
                            className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
