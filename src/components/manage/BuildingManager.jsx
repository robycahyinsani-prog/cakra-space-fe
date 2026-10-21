import { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import { BUILDING_STATUS } from "../../utils/labels";
import { api } from "../../api";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const EMPTY_BUILDING = {
  code: "",
  name: "",
  city: "",
  address: "",
  contact_phone: "",
  contact_email: "",
  timezone: "Asia/Jakarta",
  image_url: "",
};

// kelola gedung: tambah draf, status, jam operasional, hari libur, lantai, fasilitas, dan aturan refund (BE-08..10, BE-14, BE-26)
export default function BuildingManager({ buildingId, canManage, canEdit, onBuildingsChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_BUILDING);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const { data, error, loading, reload } = useResource(
    () =>
      buildingId
        ? Promise.all([api.buildings.detail(buildingId), api.buildings.facilities("building", buildingId)])
        : Promise.resolve(null),
    [buildingId]
  );

  const buatGedung = async (e) => {
    e.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      const payload = {
        code: newForm.code.trim().toUpperCase(),
        name: newForm.name.trim(),
        city: newForm.city.trim(),
        address: newForm.address.trim(),
        contact_phone: newForm.contact_phone.trim() || null,
        contact_email: newForm.contact_email.trim() || null,
        timezone: newForm.timezone,
        image_url: newForm.image_url.trim() || null,
      };
      const created = await api.buildings.create(payload);
      setNewForm(EMPTY_BUILDING);
      setShowAdd(false);
      setAlert({ type: "success", message: `Gedung ${created.name} ditambahkan sebagai Draf.` });
      onBuildingsChange(created.id);
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-brown-900">Pengelolaan Gedung</h2>
        {canManage && !showAdd && (
          <Button className="text-sm" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="inline mr-1 -mt-0.5" />
            Tambah Gedung Baru
          </Button>
        )}
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      {showAdd && (
        <form onSubmit={buatGedung} className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-4">
          <h3 className="font-semibold text-brown-900">Tambah Gedung Baru (Tersimpan sebagai Draf)</h3>
          <BuildingFields form={newForm} onChange={setNewForm} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setShowAdd(false)}>
              Batal
            </Button>
            <Button type="submit" className="text-sm" loading={busy}>
              Simpan Gedung
            </Button>
          </div>
        </form>
      )}

      {buildingId && (
        <PageState loading={loading} error={error} onRetry={reload}>
          {data && (
            <BuildingDetailEditor
              key={data[0].building.id}
              detail={data[0]}
              facilityOptions={data[1]}
              canManage={canManage}
              canEdit={canEdit}
              onReload={() => {
                reload();
                onBuildingsChange(buildingId);
              }}
              onDeleted={() => onBuildingsChange(null)}
              onAlert={setAlert}
            />
          )}
        </PageState>
      )}
    </section>
  );
}

function BuildingDetailEditor({ detail, facilityOptions, canManage, canEdit, onReload, onDeleted, onAlert }) {
  const { building, operating_hours: hours, holidays, floors, facilities } = detail;
  const [section, setSection] = useState("profil");
  const [busy, setBusy] = useState(false);

  const [infoForm, setInfoForm] = useState({
    code: building.code,
    name: building.name,
    city: building.city,
    address: building.address,
    contact_phone: building.contact_phone || "",
    contact_email: building.contact_email || "",
    timezone: building.timezone || "Asia/Jakarta",
    image_url: building.image_url || "",
  });

  const [policyForm, setPolicyForm] = useState({
    cancel_deadline_hours: building.cancel_deadline_hours ?? 2,
    refund_full_hours: building.refund_full_hours ?? 24,
    refund_partial_hours: building.refund_partial_hours ?? 6,
    refund_partial_percent: building.refund_partial_percent ?? 50,
  });

  const [hoursForm, setHoursForm] = useState(() =>
    HARI.map((_, weekday) => {
      const h = hours.find((x) => x.weekday === weekday);
      return {
        weekday,
        open_time: h ? h.open_time.slice(0, 5) : "08:00",
        close_time: h ? h.close_time.slice(0, 5) : "21:00",
        is_closed: h ? h.is_closed : weekday === 6,
      };
    })
  );

  const [selectedFacilities, setSelectedFacilities] = useState(() => facilities.map((f) => f.id));
  const [newFacName, setNewFacName] = useState("");
  const [holidayForm, setHolidayForm] = useState({ date: "", description: "" });
  const [floorForm, setFloorForm] = useState({ name: "", level: floors.length + 1 });

  const ubahStatus = async (status) => {
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.setStatus(building.id, status);
      onAlert({ type: "success", message: `Status gedung diubah menjadi ${BUILDING_STATUS[status]}.` });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const hapusGedung = async () => {
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.remove(building.id);
      onAlert({ type: "success", message: `Gedung ${building.name} berhasil dihapus.` });
      onDeleted();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
      setBusy(false);
    }
  };

  const simpanProfil = async (e) => {
    e.preventDefault();
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.update(building.id, {
        code: infoForm.code.trim().toUpperCase(),
        name: infoForm.name.trim(),
        city: infoForm.city.trim(),
        address: infoForm.address.trim(),
        contact_phone: infoForm.contact_phone.trim() || null,
        contact_email: infoForm.contact_email.trim() || null,
        timezone: infoForm.timezone,
        image_url: infoForm.image_url.trim() || null,
      });
      await api.buildings.setRefundPolicy(building.id, {
        cancel_deadline_hours: Number(policyForm.cancel_deadline_hours),
        refund_full_hours: Number(policyForm.refund_full_hours),
        refund_partial_hours: Number(policyForm.refund_partial_hours),
        refund_partial_percent: Number(policyForm.refund_partial_percent),
      });
      onAlert({ type: "success", message: "Data profil dan aturan refund gedung disimpan." });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const simpanJam = async (e) => {
    e.preventDefault();
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.setHours(building.id, hoursForm);
      onAlert({ type: "success", message: "Jam operasional 7 hari berhasil disimpan." });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const tambahLibur = async (e) => {
    e.preventDefault();
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.addHoliday(building.id, holidayForm.date, holidayForm.description.trim());
      setHolidayForm({ date: "", description: "" });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const hapusLibur = async (id) => {
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.deleteHoliday(id);
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const tambahLantai = async (e) => {
    e.preventDefault();
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.addFloor(building.id, floorForm.name.trim(), Number(floorForm.level));
      setFloorForm({ name: "", level: floors.length + 2 });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const hapusLantai = async (id) => {
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.deleteFloor(id);
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const unggahDenah = async (floorId, file) => {
    if (!file) return;
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.uploadFloorPlan(floorId, file);
      onAlert({ type: "success", message: "Gambar denah lantai berhasil diunggah." });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const simpanFasilitas = async () => {
    setBusy(true);
    onAlert(null);
    try {
      await api.buildings.setBuildingFacilities(building.id, selectedFacilities);
      onAlert({ type: "success", message: "Fasilitas umum gedung berhasil diperbarui." });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const tambahFasilitasBaru = async (e) => {
    e.preventDefault();
    if (!newFacName.trim()) return;
    setBusy(true);
    onAlert(null);
    try {
      const created = await api.buildings.createFacility(newFacName.trim(), "building", building.id);
      setNewFacName("");
      const nextIds = [...selectedFacilities, created.id];
      setSelectedFacilities(nextIds);
      await api.buildings.setBuildingFacilities(building.id, nextIds);
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-5">
      {/* Header Gedung & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-cream-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-brown-900">{building.name}</h3>
            <span className="font-mono text-xs bg-cream-100 text-brown-700 px-2 py-0.5 rounded">{building.code}</span>
            <StatusBadge status={building.status} />
          </div>
          <p className="text-sm text-brown-600 mt-0.5">
            {building.address}, {building.city}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(BUILDING_STATUS).map(([st, label]) => (
              <Button
                key={st}
                variant={building.status === st ? "primary" : "secondary"}
                className="text-xs py-1.5 px-3"
                disabled={busy || building.status === st}
                onClick={() => ubahStatus(st)}
              >
                {label}
              </Button>
            ))}
            <Button variant="danger" className="text-xs py-1.5 px-3" disabled={busy} onClick={hapusGedung}>
              <Trash2 size={14} className="inline mr-1 -mt-0.5" />
              Hapus
            </Button>
          </div>
        )}
      </div>

      {canEdit && (
        <>
          {/* Sub-tab navigasi gedung */}
          <div className="flex flex-wrap gap-2" role="tablist">
            {[
              ["profil", "Profil & Aturan Refund"],
              ["jadwal", "Jam Operasional & Libur"],
              ["lantai", "Lantai, Denah & Fasilitas"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={section === key}
                onClick={() => setSection(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  section === key ? "bg-brown-600 text-white" : "bg-cream-50 text-brown-700 hover:bg-cream-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {section === "profil" && (
            <form onSubmit={simpanProfil} className="space-y-4">
              <BuildingFields form={infoForm} onChange={setInfoForm} />

              <div className="border-t border-cream-200 pt-4">
                <h4 className="font-semibold text-brown-900 text-sm mb-3">Aturan Pembatalan & Refund (BE-26)</h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <label className="block font-medium text-brown-800 mb-1">Batas Batal (jam sebelum)</label>
                    <input
                      type="number"
                      min={0}
                      max={168}
                      value={policyForm.cancel_deadline_hours}
                      onChange={(e) => setPolicyForm({ ...policyForm, cancel_deadline_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-tan-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-brown-800 mb-1">Refund 100% (jam sebelum)</label>
                    <input
                      type="number"
                      min={0}
                      max={168}
                      value={policyForm.refund_full_hours}
                      onChange={(e) => setPolicyForm({ ...policyForm, refund_full_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-tan-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-brown-800 mb-1">Refund Sebagian (jam sebelum)</label>
                    <input
                      type="number"
                      min={0}
                      max={168}
                      value={policyForm.refund_partial_hours}
                      onChange={(e) => setPolicyForm({ ...policyForm, refund_partial_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-tan-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-brown-800 mb-1">Persen Refund Sebagian (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={policyForm.refund_partial_percent}
                      onChange={(e) => setPolicyForm({ ...policyForm, refund_partial_percent: e.target.value })}
                      className="w-full px-3 py-2 border border-tan-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="text-sm" loading={busy}>
                  Simpan Perubahan Gedung
                </Button>
              </div>
            </form>
          )}

          {section === "jadwal" && (
            <div className="grid lg:grid-cols-2 gap-6 text-sm">
              <form onSubmit={simpanJam} className="space-y-3">
                <h4 className="font-semibold text-brown-900">Jam Operasional 7 Hari (BE-09)</h4>
                <div className="space-y-2">
                  {hoursForm.map((row, idx) => (
                    <div
                      key={row.weekday}
                      className="flex items-center justify-between gap-2 bg-cream-50 rounded-lg px-3 py-2"
                    >
                      <span className="font-medium text-brown-900 w-20">{HARI[row.weekday]}</span>
                      <label className="inline-flex items-center gap-1.5 text-brown-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.is_closed}
                          onChange={(e) => {
                            const next = [...hoursForm];
                            next[idx] = { ...row, is_closed: e.target.checked };
                            setHoursForm(next);
                          }}
                          className="accent-brown-600"
                        />
                        Tutup
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          disabled={row.is_closed}
                          value={row.open_time}
                          onChange={(e) => {
                            const next = [...hoursForm];
                            next[idx] = { ...row, open_time: e.target.value };
                            setHoursForm(next);
                          }}
                          className="px-2 py-1 border border-tan-300 rounded bg-white disabled:opacity-50"
                        />
                        <span>–</span>
                        <input
                          type="time"
                          disabled={row.is_closed}
                          value={row.close_time}
                          onChange={(e) => {
                            const next = [...hoursForm];
                            next[idx] = { ...row, close_time: e.target.value };
                            setHoursForm(next);
                          }}
                          className="px-2 py-1 border border-tan-300 rounded bg-white disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="submit" className="text-sm" loading={busy}>
                  Simpan Jam Operasional
                </Button>
              </form>

              <div>
                <h4 className="font-semibold text-brown-900 mb-3">Hari Libur Khusus Gedung</h4>
                <form onSubmit={tambahLibur} className="flex flex-wrap gap-2 mb-4">
                  <input
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    required
                    className="px-3 py-1.5 border border-tan-300 rounded-lg"
                  />
                  <input
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    placeholder="Keterangan libur"
                    required
                    minLength={2}
                    className="flex-1 px-3 py-1.5 border border-tan-300 rounded-lg"
                  />
                  <Button type="submit" className="text-sm py-1.5" loading={busy}>
                    Tambah
                  </Button>
                </form>

                {holidays.length === 0 ? (
                  <p className="text-brown-500 text-xs">Belum ada hari libur khusus tercatat.</p>
                ) : (
                  <ul className="space-y-2">
                    {holidays.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center justify-between bg-cream-50 rounded-lg px-3 py-2"
                      >
                        <span>
                          <strong>{Format.shortDate(h.date)}</strong> · {h.description}
                        </span>
                        <button
                          type="button"
                          onClick={() => hapusLibur(h.id)}
                          disabled={busy}
                          className="text-red-600 hover:text-red-800"
                          title="Hapus hari libur"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "lantai" && (
            <div className="grid lg:grid-cols-2 gap-6 text-sm">
              {/* Lantai & Denah */}
              <div>
                <h4 className="font-semibold text-brown-900 mb-3">Lantai & Denah (BE-10, BE-14)</h4>
                <form onSubmit={tambahLantai} className="flex flex-wrap gap-2 mb-4">
                  <input
                    type="number"
                    min={-5}
                    max={200}
                    value={floorForm.level}
                    onChange={(e) => setFloorForm({ ...floorForm, level: e.target.value })}
                    placeholder="Nomor"
                    required
                    className="w-20 px-3 py-1.5 border border-tan-300 rounded-lg"
                  />
                  <input
                    value={floorForm.name}
                    onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                    placeholder="Nama lantai (contoh: Lantai 3)"
                    required
                    className="flex-1 px-3 py-1.5 border border-tan-300 rounded-lg"
                  />
                  <Button type="submit" className="text-sm py-1.5" loading={busy}>
                    Tambah Lantai
                  </Button>
                </form>

                <ul className="space-y-2">
                  {floors.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-cream-50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <span className="font-medium text-brown-900">
                          {f.name} (Level {f.level})
                        </span>
                        {f.plan_file && <span className="ml-2 text-xs text-green-700">· Denah terunggah</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-xs text-brown-700 hover:text-brown-900 inline-flex items-center gap-1 bg-white border border-tan-300 px-2.5 py-1 rounded-lg">
                          <Upload size={13} />
                          Denah
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => unggahDenah(f.id, e.target.files?.[0])}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => hapusLantai(f.id)}
                          disabled={busy}
                          className="text-red-600 hover:text-red-800"
                          title="Hapus lantai kosong"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fasilitas Gedung */}
              <div>
                <h4 className="font-semibold text-brown-900 mb-3">Fasilitas Umum Gedung (BE-10)</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  {(facilityOptions || []).map((f) => (
                    <label
                      key={f.id}
                      className="inline-flex items-center gap-1.5 bg-cream-50 px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFacilities.includes(f.id)}
                        onChange={() =>
                          setSelectedFacilities((prev) =>
                            prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                          )
                        }
                        className="accent-brown-600"
                      />
                      {f.name}
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Button className="text-sm py-1.5" loading={busy} onClick={simpanFasilitas}>
                    Simpan Pilihan Fasilitas
                  </Button>
                </div>

                <form onSubmit={tambahFasilitasBaru} className="flex gap-2">
                  <input
                    value={newFacName}
                    onChange={(e) => setNewFacName(e.target.value)}
                    placeholder="Tambah fasilitas gedung baru..."
                    minLength={2}
                    className="flex-1 px-3 py-1.5 border border-tan-300 rounded-lg"
                  />
                  <Button type="submit" variant="secondary" className="text-sm py-1.5" disabled={busy || !newFacName.trim()}>
                    Tambah
                  </Button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BuildingFields({ form, onChange }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
      <div>
        <label className="block font-medium text-brown-800 mb-1">Kode Gedung</label>
        <input
          value={form.code}
          onChange={(e) => onChange({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="SDR"
          required
          minLength={2}
          maxLength={10}
          className="w-full px-3 py-2 border border-tan-300 rounded-lg font-mono"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block font-medium text-brown-800 mb-1">Nama Gedung</label>
        <input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Cakra Space Sudirman"
          required
          minLength={3}
          className="w-full px-3 py-2 border border-tan-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block font-medium text-brown-800 mb-1">Kota</label>
        <input
          value={form.city}
          onChange={(e) => onChange({ ...form, city: e.target.value })}
          placeholder="Jakarta"
          required
          minLength={2}
          className="w-full px-3 py-2 border border-tan-300 rounded-lg"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block font-medium text-brown-800 mb-1">Alamat Lengkap</label>
        <input
          value={form.address}
          onChange={(e) => onChange({ ...form, address: e.target.value })}
          placeholder="Jl. Jend. Sudirman No. 1"
          required
          minLength={5}
          className="w-full px-3 py-2 border border-tan-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block font-medium text-brown-800 mb-1">Telepon Kontak</label>
        <input
          value={form.contact_phone}
          onChange={(e) => onChange({ ...form, contact_phone: e.target.value })}
          placeholder="021-1234567"
          className="w-full px-3 py-2 border border-tan-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block font-medium text-brown-800 mb-1">Email Kontak</label>
        <input
          type="email"
          value={form.contact_email}
          onChange={(e) => onChange({ ...form, contact_email: e.target.value })}
          placeholder=" cabang@cakraspace.id"
          className="w-full px-3 py-2 border border-tan-300 rounded-lg"
        />
      </div>
      <div className="sm:col-span-3">
        <label className="block font-medium text-brown-800 mb-1">URL Gambar Gedung</label>
        <input
          value={form.image_url}
          onChange={(e) => onChange({ ...form, image_url: e.target.value })}
          placeholder="https://placehold.co/400x200?text=Gedung"
          className="w-full px-3 py-2 border border-tan-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block font-medium text-brown-800 mb-1">Zona Waktu</label>
        <select
          value={form.timezone}
          onChange={(e) => onChange({ ...form, timezone: e.target.value })}
          className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
        >
          <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
          <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
          <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
        </select>
      </div>
    </div>
  );
}
