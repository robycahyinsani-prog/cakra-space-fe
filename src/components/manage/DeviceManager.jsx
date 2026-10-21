import { useState } from "react";
import { Plus, Copy, LockOpen, RotateCcw, ShieldOff, Wrench } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import { DEVICE_TYPES, DEVICE_COMMANDS } from "../../utils/labels";
import { api } from "../../api";

// perangkat pintu: registrasi API key sekali tampil, perintah jarak jauh, dan maintenance (BE-48..51)
export default function DeviceManager({ buildingId, canCommand }) {
  const { data: devices, error, loading, reload } = useResource(
    () => api.manage.devices(buildingId),
    [buildingId]
  );

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "qr_reader", door: "Pintu Utama" });
  const [newKey, setNewKey] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const daftarkan = async (e) => {
    e.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      const created = await api.manage.registerDevice({
        building_id: buildingId,
        name: form.name.trim(),
        type: form.type,
        door: form.door.trim(),
      });
      setNewKey({ name: created.name, door: created.door, key: created.api_key });
      setForm({ name: "", type: "qr_reader", door: "Pintu Utama" });
      setShowAdd(false);
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const kirimPerintah = async (device, command) => {
    setBusy(true);
    setAlert(null);
    try {
      await api.manage.sendCommand(device.id, command);
      setAlert({
        type: "success",
        message: `Perintah "${DEVICE_COMMANDS[command]}" dikirim ke ${device.name}.`,
      });
      reload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const cabutKunci = async (device) => {
    setBusy(true);
    setAlert(null);
    try {
      await api.manage.revokeDevice(device.id);
      setAlert({ type: "success", message: `API key perangkat ${device.name} berhasil dicabut.` });
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
        <h2 className="text-lg font-semibold text-brown-900">Perangkat Pintu & Pembaca QR</h2>
        {!showAdd && (
          <Button className="text-sm" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="inline mr-1 -mt-0.5" />
            Daftarkan Perangkat
          </Button>
        )}
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      {/* API Key hanya ditampilkan sekali saat perangkat baru didaftarkan */}
      {newKey && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-4 text-sm text-yellow-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                Simpan API Key untuk {newKey.name} ({newKey.door})
              </p>
              <p className="text-xs mt-0.5">
                API key ini hanya ditampilkan sekali untuk dipasang di header <code>X-Device-Key</code> perangkat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewKey(null)}
              className="text-xs underline font-medium"
            >
              Tutup
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 bg-white border border-yellow-300 rounded-lg px-3 py-2">
            <code className="font-mono text-sm font-bold break-all text-brown-900">{newKey.key}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(newKey.key)}
              className="text-brown-700 hover:text-brown-900 flex-none"
              title="Salin API Key"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <form onSubmit={daftarkan} className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 mb-4 space-y-4">
          <h3 className="font-semibold text-brown-900">Daftarkan Perangkat Baru</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block font-medium text-brown-800 mb-1">Nama Perangkat</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Pembaca QR Pintu Utama"
                required
                minLength={2}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Jenis Perangkat</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
              >
                {Object.entries(DEVICE_TYPES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-brown-800 mb-1">Lokasi Pintu</label>
              <input
                value={form.door}
                onChange={(e) => setForm({ ...form, door: e.target.value })}
                placeholder="Pintu Utama / Lantai 2"
                required
                minLength={2}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="text-sm" disabled={busy} onClick={() => setShowAdd(false)}>
              Batal
            </Button>
            <Button type="submit" className="text-sm" loading={busy}>
              Simpan & Buat API Key
            </Button>
          </div>
        </form>
      )}

      <PageState loading={loading} error={error} onRetry={reload}>
        {(devices || []).length === 0 ? (
          <p className="text-brown-600 bg-white rounded-xl border border-cream-200 p-6 text-center">
            Belum ada perangkat terdaftar di gedung ini.
          </p>
        ) : (
          <div className="space-y-3">
            {(devices || []).map((dev) => (
              <div key={dev.id} className="bg-white rounded-xl shadow-sm border border-cream-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-brown-900">{dev.name}</h3>
                      <StatusBadge status={dev.status} />
                      <span className="text-xs bg-cream-100 text-brown-700 px-2 py-0.5 rounded-full">
                        {DEVICE_TYPES[dev.type]}
                      </span>
                    </div>
                    <p className="text-sm text-brown-700 mt-1">
                      Pintu: <strong>{dev.door}</strong> · Key prefix: <code className="font-mono">dev_{dev.key_prefix}_…</code>
                    </p>
                    <p className="text-xs text-brown-500 mt-1">
                      Heartbeat terakhir:{" "}
                      {dev.last_heartbeat_at ? Format.dateTime(dev.last_heartbeat_at) : "Belum pernah"}
                      {dev.pending_commands > 0 ? ` · ${dev.pending_commands} perintah menunggu` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!dev.is_revoked && canCommand && (
                      <>
                        <Button
                          variant="secondary"
                          className="text-xs"
                          disabled={busy}
                          onClick={() => kirimPerintah(dev, "unlock")}
                        >
                          <LockOpen size={14} className="inline mr-1 -mt-0.5" />
                          Buka Pintu
                        </Button>
                        <Button
                          variant="secondary"
                          className="text-xs"
                          disabled={busy}
                          onClick={() => kirimPerintah(dev, "restart")}
                        >
                          <RotateCcw size={14} className="inline mr-1 -mt-0.5" />
                          Restart
                        </Button>
                      </>
                    )}
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => setExpandedId(expandedId === dev.id ? null : dev.id)}
                    >
                      <Wrench size={14} className="inline mr-1 -mt-0.5" />
                      {expandedId === dev.id ? "Tutup Detail" : "Riwayat & Maintenance"}
                    </Button>
                    {!dev.is_revoked && (
                      <Button
                        variant="danger"
                        className="text-xs"
                        disabled={busy}
                        onClick={() => cabutKunci(dev)}
                      >
                        <ShieldOff size={14} className="inline mr-1 -mt-0.5" />
                        Cabut Key
                      </Button>
                    )}
                  </div>
                </div>

                {expandedId === dev.id && <DeviceDetailPanel deviceId={dev.id} />}
              </div>
            ))}
          </div>
        )}
      </PageState>
    </section>
  );
}

function DeviceDetailPanel({ deviceId }) {
  const { data, error, loading, reload } = useResource(
    () => Promise.all([api.manage.deviceCommands(deviceId), api.manage.deviceMaintenances(deviceId)]),
    [deviceId]
  );

  const [form, setForm] = useState({
    date: Format.isoDate(new Date()),
    issue: "",
    action: "",
    technician: "",
  });
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const catatMaintenance = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrMsg("");
    try {
      await api.manage.addMaintenance(deviceId, form);
      setForm({ ...form, issue: "", action: "", technician: "" });
      reload();
    } catch (err) {
      setErrMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-cream-200">
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            {/* Riwayat Perintah */}
            <div>
              <h4 className="font-semibold text-brown-900 mb-2">Riwayat Perintah Jarak Jauh</h4>
              {data[0].length === 0 ? (
                <p className="text-brown-500 text-xs">Belum ada perintah yang dikirim.</p>
              ) : (
                <ul className="space-y-2">
                  {data[0].slice(0, 6).map((cmd) => (
                    <li
                      key={cmd.id}
                      className="flex items-center justify-between gap-2 bg-cream-50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-brown-900">
                          {DEVICE_COMMANDS[cmd.command] || cmd.command}
                          {cmd.requested_by_name ? ` · oleh ${cmd.requested_by_name}` : ""}
                        </p>
                        <p className="text-xs text-brown-500">
                          {Format.dateTime(cmd.created_at)}
                          {cmd.result ? ` · ${cmd.result}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={cmd.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Riwayat & Catat Maintenance */}
            <div>
              <h4 className="font-semibold text-brown-900 mb-2">Catatan Maintenance (BE-51)</h4>
              <form onSubmit={catatMaintenance} className="space-y-2 mb-3 bg-cream-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="px-2.5 py-1.5 text-xs border border-tan-300 rounded-lg bg-white"
                  />
                  <input
                    value={form.technician}
                    onChange={(e) => setForm({ ...form, technician: e.target.value })}
                    placeholder="Nama teknisi"
                    required
                    minLength={2}
                    className="px-2.5 py-1.5 text-xs border border-tan-300 rounded-lg bg-white"
                  />
                </div>
                <input
                  value={form.issue}
                  onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  placeholder="Kendala (contoh: Kamera buram)"
                  required
                  minLength={3}
                  className="w-full px-2.5 py-1.5 text-xs border border-tan-300 rounded-lg bg-white"
                />
                <div className="flex gap-2">
                  <input
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                    placeholder="Tindakan perbaikan (contoh: Lensa dibersihkan)"
                    required
                    minLength={3}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-tan-300 rounded-lg bg-white"
                  />
                  <Button type="submit" className="text-xs py-1.5 px-3" loading={busy}>
                    Catat
                  </Button>
                </div>
                {errMsg && <p className="text-xs text-red-700">{errMsg}</p>}
              </form>

              {data[1].length === 0 ? (
                <p className="text-brown-500 text-xs">Belum ada catatan maintenance.</p>
              ) : (
                <ul className="space-y-2">
                  {data[1].map((m) => (
                    <li key={m.id} className="bg-cream-50 rounded-lg px-3 py-2">
                      <p className="font-medium text-brown-900">
                        {Format.shortDate(m.date)} · {m.issue}
                      </p>
                      <p className="text-xs text-brown-700">
                        Tindakan: {m.action} · Teknisi: {m.technician}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </PageState>
    </div>
  );
}
