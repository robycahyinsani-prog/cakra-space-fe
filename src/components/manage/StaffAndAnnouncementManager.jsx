import { useState } from "react";
import { Megaphone, UserCog, ShieldCheck, KeyRound, Plus, Trash2, Pencil } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import MailboxHint from "../auth/MailboxHint";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import { api } from "../../api";

// manajemen pengumuman gedung serta akun staf & matriks hak akses peran (BE-33, BE-34, BE-51)
export default function StaffAndAnnouncementManager({
  buildingId,
  buildings,
  canManageAnnouncements,
  canManageStaff,
}) {
  return (
    <div className="space-y-8">
      {canManageAnnouncements && buildingId && (
        <AnnouncementSection buildingId={buildingId} buildings={buildings} />
      )}
      {canManageStaff && <StaffSection buildings={buildings} />}
    </div>
  );
}

function AnnouncementSection({ buildingId, buildings }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const { data: list, loading, error, reload } = useResource(
    () => api.manage.announcements(buildingId),
    [buildingId]
  );

  const gedung = (buildings || []).find((b) => b.id === buildingId);

  const kirimPengumuman = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSuccessMsg("");
    try {
      await api.manage.createAnnouncement({
        building_id: buildingId,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle("");
      setBody("");
      setSuccessMsg("Pengumuman berhasil diterbitkan dan dikirimkan ke member gedung ini.");
      reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  const hapus = async (id) => {
    setBusy(true);
    setErr(null);
    try {
      await api.manage.deleteAnnouncement(id);
      reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2">
        <Megaphone size={20} className="text-brown-600" />
        Pengumuman Gedung {gedung ? `· ${gedung.name}` : ""}
      </h2>

      <form
        onSubmit={kirimPengumuman}
        className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-3 text-sm"
      >
        <p className="font-medium text-brown-900">Buat Pengumuman Baru</p>
        <Alert message={err?.message} />
        <Alert variant="success" message={successMsg} />
        {successMsg && <MailboxHint />}

        <div>
          <label className="block text-xs font-medium text-brown-700 mb-1">Judul Pengumuman</label>
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Pemeliharaan Jaringan Internet Lantai 2"
            className="w-full px-3 py-2 border border-tan-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brown-700 mb-1">Isi Pengumuman</label>
          <textarea
            required
            minLength={5}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tulis informasi lengkap untuk member aktif di gedung ini..."
            className="w-full px-3 py-2 border border-tan-300 rounded-lg"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Terbitkan Pengumuman
          </Button>
        </div>
      </form>

      <PageState loading={loading} error={error} onRetry={reload}>
        {(list || []).length === 0 ? (
          <p className="bg-white rounded-xl border border-cream-200 p-6 text-center text-brown-600 text-sm">
            Belum ada pengumuman untuk gedung ini.
          </p>
        ) : (
          <div className="space-y-3">
            {(list || []).map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm border border-cream-200 p-4 flex items-start justify-between gap-4"
              >
                <div className="text-sm">
                  <p className="font-semibold text-brown-900">{item.title}</p>
                  <p className="text-brown-700 mt-1 whitespace-pre-line">{item.body}</p>
                  <p className="text-xs text-brown-500 mt-1.5">Diterbitkan {Format.dateTime(item.created_at)}</p>
                </div>
                <Button
                  variant="danger"
                  className="text-xs py-1.5 px-2.5 flex-none"
                  disabled={busy}
                  onClick={() => hapus(item.id)}
                >
                  <Trash2 size={14} className="inline mr-1 -mt-0.5" />
                  Hapus
                </Button>
              </div>
            ))}
          </div>
        )}
      </PageState>
    </section>
  );
}

function StaffSection({ buildings }) {
  const staff = useResource(() => api.manage.staff(), []);
  const roles = useResource(() => api.manage.roles(), []);

  const [showCreate, setShowCreate] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("receptionist");
  const [buildingIds, setBuildingIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  const buildingMap = Object.fromEntries((buildings || []).map((b) => [b.id, b]));

  const toggleGedung = (id) => {
    setBuildingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const mulaiBuat = () => {
    setEditingStaff(null);
    setName("");
    setEmail("");
    setRole("receptionist");
    setBuildingIds(buildings?.[0] ? [buildings[0].id] : []);
    setErr(null);
    setShowCreate(true);
  };

  const mulaiEdit = (s) => {
    setShowCreate(false);
    setEditingStaff(s);
    setName(s.name);
    setEmail(s.email);
    setRole(s.role);
    setBuildingIds(s.building_ids || []);
    setErr(null);
  };

  const simpanStaf = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const assignedIds = role === "central_manager" ? [] : buildingIds;
      if (editingStaff) {
        await api.manage.updateStaff(editingStaff.id, {
          name: name.trim(),
          role,
          building_ids: assignedIds,
        });
        setEditingStaff(null);
      } else {
        const created = await api.manage.createStaff({
          name: name.trim(),
          email: email.trim(),
          role,
          building_ids: assignedIds,
        });
        setTempPasswordInfo({
          name: created.name,
          email: created.email,
          temporary_password: created.temporary_password,
        });
        setShowCreate(false);
      }
      staff.reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (s) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.manage.resetStaffPassword(s.id);
      setTempPasswordInfo({
        name: res.name,
        email: res.email,
        temporary_password: res.temporary_password,
      });
      staff.reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2">
          <UserCog size={20} className="text-brown-600" />
          Manajemen Akun Staf & Penugasan Gedung
        </h2>
        <Button className="text-sm" onClick={showCreate ? () => setShowCreate(false) : mulaiBuat}>
          <Plus size={15} className="inline mr-1 -mt-0.5" />
          {showCreate ? "Tutup Form" : "Tambah Staf Baru"}
        </Button>
      </div>

      <Alert message={err?.message} />

      {tempPasswordInfo && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <KeyRound size={16} />
            Password Sementara Staf (Hanya Ditampilkan Sekali)
          </p>
          <p>
            Akun <span className="font-medium">{tempPasswordInfo.name}</span> ({tempPasswordInfo.email}) memiliki password sementara:{" "}
            <code className="px-2 py-0.5 bg-white border border-amber-300 rounded font-mono font-bold">
              {tempPasswordInfo.temporary_password}
            </code>
          </p>
          <p className="text-xs text-amber-800">
            Staf wajib mengganti password sementara ini saat pertama kali login.
          </p>
        </div>
      )}

      {(showCreate || editingStaff) && (
        <form
          onSubmit={simpanStaf}
          className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-4 text-sm"
        >
          <p className="font-semibold text-brown-900">
            {editingStaff ? `Ubah Penugasan Staf · ${editingStaff.email}` : "Tambah Akun Staf Baru"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-brown-700 mb-1">Nama Lengkap</label>
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama staf"
                className="w-full px-3 py-2 border border-tan-300 rounded-lg"
              />
            </div>
            {!editingStaff && (
              <div>
                <label className="block text-xs font-medium text-brown-700 mb-1">Email Staf</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staf@cakraspace.id"
                  className="w-full px-3 py-2 border border-tan-300 rounded-lg"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-brown-700 mb-1">Peran (Role)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
              >
                <option value="receptionist">Resepsionis</option>
                <option value="location_manager">Pengelola Lokasi</option>
                <option value="central_manager">Pengelola Pusat</option>
              </select>
            </div>
          </div>

          {role !== "central_manager" && (
            <div>
              <p className="text-xs font-medium text-brown-700 mb-1.5">Penugasan Gedung</p>
              <div className="flex flex-wrap gap-3">
                {(buildings || []).map((b) => (
                  <label
                    key={b.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cream-200 bg-cream-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={buildingIds.includes(b.id)}
                      onChange={() => toggleGedung(b.id)}
                    />
                    <span>
                      {b.name} ({b.code})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                setEditingStaff(null);
              }}
            >
              Batal
            </Button>
            <Button type="submit" loading={busy}>
              {editingStaff ? "Simpan Perubahan" : "Buat Akun Staf"}
            </Button>
          </div>
        </form>
      )}

      <PageState loading={staff.loading} error={staff.error} onRetry={staff.reload}>
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-cream-50 text-brown-800">
                <th className="p-3 font-semibold">Nama & Email</th>
                <th className="p-3 font-semibold">Peran</th>
                <th className="p-3 font-semibold">Gedung Tugas</th>
                <th className="p-3 font-semibold">Status Password</th>
                <th className="p-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(staff.data || []).map((s) => (
                <tr key={s.id} className="hover:bg-cream-50">
                  <td className="p-3">
                    <span className="font-medium text-brown-900">{s.name}</span>
                    <span className="block text-xs text-brown-500">{s.email}</span>
                  </td>
                  <td className="p-3 text-brown-800 font-medium">{s.role_name}</td>
                  <td className="p-3 text-brown-700">
                    {s.role === "central_manager"
                      ? "Semua Gedung"
                      : (s.building_ids || [])
                          .map((id) => buildingMap[id]?.name || `Gedung #${id}`)
                          .join(", ") || "-"}
                  </td>
                  <td className="p-3">
                    {s.must_change_password ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                        Wajib Ganti Password
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap space-x-2">
                    <Button
                      variant="secondary"
                      className="text-xs py-1 px-2.5"
                      disabled={busy}
                      onClick={() => mulaiEdit(s)}
                    >
                      <Pencil size={13} className="inline mr-1 -mt-0.5" />
                      Ubah
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs py-1 px-2.5"
                      disabled={busy}
                      onClick={() => resetPassword(s)}
                    >
                      <KeyRound size={13} className="inline mr-1 -mt-0.5" />
                      Reset Password
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>

      {/* Matriks Hak Akses Peran (BE-33) */}
      <PageState loading={roles.loading} error={roles.error} onRetry={roles.reload}>
        {(roles.data || []).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-3">
            <h3 className="text-base font-semibold text-brown-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-brown-600" />
              Matriks Hak Akses Peran (RBAC)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {(roles.data || []).map((r) => (
                <div key={r.code} className="rounded-lg border border-cream-200 bg-cream-50 p-3.5">
                  <p className="font-semibold text-brown-900">{r.name}</p>
                  <p className="text-xs text-brown-500 font-mono mb-2">{r.code}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(r.permissions || []).map((perm) => (
                      <span
                        key={perm}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-white border border-cream-200 text-brown-700"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageState>
    </section>
  );
}
