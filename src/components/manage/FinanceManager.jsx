import { useState } from "react";
import { Wallet, AlertTriangle, Percent, Plus } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import { api } from "../../api";

// manajemen deposit barang member, tunggakan pembayaran, dan tarif pajak PPN (BE-28, BE-50)
export default function FinanceManager({ buildingId, canManageFinance, canManageSettings }) {
  const members = useResource(() => api.manage.members(), []);
  const memberMap = Object.fromEntries((members.data || []).map((m) => [m.id, m]));

  return (
    <div className="space-y-8">
      {canManageSettings && <TaxRateSection />}
      {canManageFinance && buildingId && (
        <>
          <DepositsSection buildingId={buildingId} members={members.data || []} memberMap={memberMap} />
          <ArrearsSection buildingId={buildingId} members={members.data || []} />
        </>
      )}
    </div>
  );
}

function TaxRateSection() {
  const { data, loading, error, reload } = useResource(() => api.manage.settings(), []);
  const [rate, setRate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");

  const currentRate = rate !== null ? rate : (data?.tax_rate_percent ?? 11);

  const simpan = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSavedMsg("");
    try {
      await api.manage.setTaxRate(Number(currentRate));
      setSavedMsg("Tarif PPN berhasil diperbarui untuk transaksi berikutnya.");
      reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
      <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2 mb-1">
        <Percent size={19} className="text-brown-600" />
        Pengaturan Tarif Pajak (PPN)
      </h2>
      <p className="text-sm text-brown-600 mb-4">
        Tarif pajak ini otomatis diterapkan pada perhitungan invoice booking ruang dan pembelian paket membership.
      </p>

      <PageState loading={loading} error={error} onRetry={reload}>
        <Alert message={err?.message} />
        <Alert variant="success" message={savedMsg} />

        <form onSubmit={simpan} className="flex flex-wrap items-end gap-3 text-sm mt-2">
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Tarif PPN (%)</label>
            <input
              type="number"
              min="0"
              max="50"
              required
              value={currentRate}
              onChange={(e) => setRate(e.target.value)}
              className="w-28 px-3 py-2 border border-tan-300 rounded-lg bg-white"
            />
          </div>
          <Button type="submit" loading={busy}>
            Simpan Tarif PPN
          </Button>
        </form>
      </PageState>
    </section>
  );
}

function DepositsSection({ buildingId, members, memberMap }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const { data: deposits, loading, error, reload } = useResource(
    () =>
      api.manage.deposits({
        building_id: buildingId,
        status: statusFilter || undefined,
      }),
    [buildingId, statusFilter]
  );

  const tambahDeposit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.manage.addDeposit({
        user_id: Number(userId),
        building_id: buildingId,
        item: item.trim(),
        amount: Number(amount),
      });
      setItem("");
      setAmount("");
      setShowForm(false);
      reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  const kembalikan = async (depositId) => {
    setBusy(true);
    setErr(null);
    try {
      await api.manage.returnDeposit(depositId);
      reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2">
          <Wallet size={20} className="text-brown-600" />
          Deposit Member (Kunci Loker & Kartu Akses)
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status deposit"
            className="px-3 py-1.5 text-sm border border-tan-300 rounded-lg bg-white"
          >
            <option value="">Semua Status</option>
            <option value="held">Ditahan</option>
            <option value="returned">Dikembalikan</option>
          </select>
          <Button className="text-sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} className="inline mr-1 -mt-0.5" />
            {showForm ? "Tutup Form" : "Catat Deposit"}
          </Button>
        </div>
      </div>

      <Alert message={err?.message} />

      {showForm && (
        <form
          onSubmit={tambahDeposit}
          className="bg-white rounded-xl shadow-sm border border-cream-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm"
        >
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Member</label>
            <select
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
            >
              <option value="">Pilih member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Barang / Fasilitas</label>
            <input
              required
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Contoh: Kunci Loker #08"
              className="w-full px-3 py-2 border border-tan-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Nominal Deposit (Rp)</label>
            <input
              type="number"
              min="1000"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="150000"
              className="w-full px-3 py-2 border border-tan-300 rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={busy} className="w-full">
              Simpan Deposit
            </Button>
          </div>
        </form>
      )}

      <PageState loading={loading} error={error} onRetry={reload}>
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-cream-50 text-brown-800">
                <th className="p-3 font-semibold">Member</th>
                <th className="p-3 font-semibold">Barang / Keterangan</th>
                <th className="p-3 font-semibold text-right">Nominal</th>
                <th className="p-3 font-semibold">Tanggal Catat</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(deposits || []).length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-brown-500">
                    Belum ada catatan deposit di gedung ini.
                  </td>
                </tr>
              ) : (
                (deposits || []).map((d) => {
                  const member = memberMap[d.user_id];
                  return (
                    <tr key={d.id} className="hover:bg-cream-50">
                      <td className="p-3 text-brown-900 font-medium">
                        {member ? member.name : `Member #${d.user_id}`}
                        {member?.email && <span className="block text-xs text-brown-500 font-normal">{member.email}</span>}
                      </td>
                      <td className="p-3 text-brown-800">{d.item}</td>
                      <td className="p-3 text-right font-medium text-brown-900 tabular-nums">{Format.rupiah(d.amount)}</td>
                      <td className="p-3 text-brown-700 whitespace-nowrap">{Format.dateTime(d.created_at)}</td>
                      <td className="p-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="p-3 text-right">
                        {d.status === "held" ? (
                          <Button
                            variant="secondary"
                            className="text-xs py-1 px-2.5"
                            disabled={busy}
                            onClick={() => kembalikan(d.id)}
                          >
                            Kembalikan Deposit
                          </Button>
                        ) : (
                          <span className="text-xs text-brown-500">
                            Dikembalikan {d.returned_at ? Format.shortDate(d.returned_at) : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}

function ArrearsSection({ buildingId, members }) {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(Format.isoDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const { data: arrears, loading, error, reload } = useResource(
    () =>
      api.manage.arrears({
        building_id: buildingId,
        overdue_only: overdueOnly || undefined,
      }),
    [buildingId, overdueOnly]
  );

  const tambahTunggakan = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.manage.addArrear({
        user_id: Number(userId),
        building_id: buildingId,
        description: description.trim(),
        amount: Number(amount),
        due_date: dueDate,
      });
      setDescription("");
      setAmount("");
      setShowForm(false);
      reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  const lunasi = async (arrearId) => {
    setBusy(true);
    setErr(null);
    try {
      await api.manage.settleArrear(arrearId);
      reload();
    } catch (errorObj) {
      setErr(errorObj);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2">
          <AlertTriangle size={20} className="text-brown-600" />
          Tunggakan Pembayaran Member
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-brown-700 cursor-pointer">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded border-tan-300"
            />
            Hanya jatuh tempo
          </label>
          <Button className="text-sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} className="inline mr-1 -mt-0.5" />
            {showForm ? "Tutup Form" : "Catat Tunggakan"}
          </Button>
        </div>
      </div>

      <Alert message={err?.message} />

      {showForm && (
        <form
          onSubmit={tambahTunggakan}
          className="bg-white rounded-xl shadow-sm border border-cream-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm"
        >
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Member</label>
            <select
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
            >
              <option value="">Pilih member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Keterangan Tagihan</label>
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Kelebihan jam ruang rapat"
              className="w-full px-3 py-2 border border-tan-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              min="1000"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="175000"
              className="w-full px-3 py-2 border border-tan-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Jatuh Tempo</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-tan-300 rounded-lg bg-white"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={busy} className="w-full">
              Simpan Tunggakan
            </Button>
          </div>
        </form>
      )}

      <PageState loading={loading} error={error} onRetry={reload}>
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-cream-50 text-brown-800">
                <th className="p-3 font-semibold">Member</th>
                <th className="p-3 font-semibold">Keterangan</th>
                <th className="p-3 font-semibold text-right">Nominal</th>
                <th className="p-3 font-semibold">Jatuh Tempo</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(arrears || []).length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-brown-500">
                    Tidak ada catatan tunggakan pada filter ini.
                  </td>
                </tr>
              ) : (
                (arrears || []).map((a) => (
                  <tr key={a.id} className="hover:bg-cream-50">
                    <td className="p-3 text-brown-900 font-medium">{a.member_name}</td>
                    <td className="p-3 text-brown-800">{a.description}</td>
                    <td className="p-3 text-right font-medium text-brown-900 tabular-nums">{Format.rupiah(a.amount)}</td>
                    <td className="p-3 text-brown-700 whitespace-nowrap">{Format.shortDate(a.due_date)}</td>
                    <td className="p-3 space-x-1">
                      <StatusBadge status={a.status} />
                      {a.is_overdue && <StatusBadge status="overdue" />}
                    </td>
                    <td className="p-3 text-right">
                      {a.status === "unpaid" ? (
                        <Button
                          variant="secondary"
                          className="text-xs py-1 px-2.5"
                          disabled={busy}
                          onClick={() => lunasi(a.id)}
                        >
                          Tandai Lunas
                        </Button>
                      ) : (
                        <span className="text-xs text-brown-500">
                          Lunas {a.paid_at ? Format.shortDate(a.paid_at) : ""}
                        </span>
                      )}
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
