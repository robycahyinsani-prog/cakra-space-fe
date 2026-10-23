import { useState } from "react";
import { Building2, CalendarDays, Check, Clock, Snowflake, Sparkles, RefreshCw, ArrowUpRight } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Alert from "../components/Alert";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import PaymentPanel from "../components/booking/PaymentPanel";
import useResource from "../hooks/useResource";
import Format from "../utils/Format";
import { api } from "../api";

// halaman membership member: beli paket, perpanjang, upgrade/downgrade, dan freeze (BE-35..38)
export default function Membership() {
  const { data, error, loading, reload } = useResource(
    () => Promise.all([api.member.subscription(), api.member.plans(), api.buildings.list()]),
    []
  );

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brown-900">Membership Cakra Space</h1>
          <p className="text-brown-600 mt-1">
            Hemat biaya kerja harian dengan akses hot desk dan kuota ruang rapat bulanan
          </p>
        </div>

        <PageState loading={loading && !data} error={error} onRetry={reload}>
          {data && (
            <MembershipBody
              current={data[0]}
              plans={data[1]}
              buildings={data[2]}
              onReload={reload}
            />
          )}
        </PageState>
      </div>
    </div>
  );
}

function MembershipBody({ current, plans, buildings, onReload }) {
  const [checkout, setCheckout] = useState(null);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [alert, setAlert] = useState(null);

  const sub = current.subscription;
  const activePlan = current.plan;
  const isActive = current.status === "active" || current.status === "frozen";
  const isPending = current.status === "pending_payment";

  const namaGedung = (ids) => {
    if (!ids || ids.length === 0) return "Semua gedung Cakra Space";
    return ids.map((id) => buildings.find((b) => b.id === id)?.name || `Gedung #${id}`).join(", ");
  };

  const selesaiBayar = () => {
    setCheckout(null);
    setAlert({ type: "success", message: "Status pembayaran dan membership berhasil diperbarui." });
    onReload();
  };

  const pilihPaket = async (plan) => {
    setBusyPlanId(plan.id);
    setAlert(null);
    try {
      const baru = await api.member.subscribe(plan.id);
      setCheckout({
        title: `Bayar Paket ${plan.name}`,
        amount: plan.price,
        onPay: (method) => api.payments.paySubscription(baru.id, method),
      });
      onReload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusyPlanId(null);
    }
  };

  const gantiPaket = async (plan) => {
    if (!activePlan) return;
    setAlert(null);
    if (plan.price > activePlan.price) {
      const sisaHari = (current.days_left ?? 0) + 1;
      const prorata = Math.max(0, Math.floor(((plan.price - activePlan.price) * sisaHari) / activePlan.duration_days));
      setCheckout({
        title: `Upgrade ke ${plan.name} (Prorata ${sisaHari} hari)`,
        amount: prorata,
        onPay: (method) => api.payments.changePlan(plan.id, method),
      });
      return;
    }
    setBusyPlanId(plan.id);
    try {
      const res = await api.payments.changePlan(plan.id, "virtual_account");
      const mulai = res.change?.effective_date ? Format.longDate(res.change.effective_date) : "periode berikutnya";
      setAlert({
        type: "success",
        message: `Perubahan ke paket ${plan.name} dijadwalkan mulai ${mulai}.`,
      });
      onReload();
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusyPlanId(null);
    }
  };

  const perpanjang = () => {
    const target = current.scheduled_plan || activePlan;
    setAlert(null);
    setCheckout({
      title: `Perpanjang ${target.name} (${target.duration_days} hari)`,
      amount: target.price,
      onPay: (method) => api.payments.renewSubscription(method),
    });
  };

  // kalau ada langganan yang masih menunggu pembayaran dan belum membuka pilihan lain, tampilkan panel bayarnya
  const activeCheckout =
    checkout ||
    (isPending && sub && activePlan
      ? {
          title: `Selesaikan Pembayaran ${activePlan.name}`,
          amount: activePlan.price,
          onPay: (method) => api.payments.paySubscription(sub.id, method),
        }
      : null);

  return (
    <div className="space-y-8">
      {alert && <Alert type={alert.type} message={alert.message} />}

      {(isActive || isPending || current.status === "inactive") && sub && activePlan && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
          <ActiveSubscriptionCard
            current={current}
            buildingLabel={namaGedung(activePlan.building_ids)}
            onRenew={perpanjang}
            onReload={onReload}
            onAlert={setAlert}
          />
          {activeCheckout && (
            <PaymentPanel
              title={activeCheckout.title}
              amount={activeCheckout.amount}
              onPay={activeCheckout.onPay}
              onCancel={checkout ? () => setCheckout(null) : undefined}
              onChanged={selesaiBayar}
            />
          )}
        </div>
      )}

      {!sub && activeCheckout && (
        <div className="max-w-md">
          <PaymentPanel
            title={activeCheckout.title}
            amount={activeCheckout.amount}
            onPay={activeCheckout.onPay}
            onCancel={() => setCheckout(null)}
            onChanged={selesaiBayar}
          />
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-brown-900 mb-4">Pilihan Paket Membership</h2>
        {plans.length === 0 ? (
          <p className="text-brown-600 bg-white rounded-xl border border-cream-200 p-6 text-center">
            Belum ada paket membership yang dijual saat ini.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const kuota = plan.benefits?.find((b) => b.benefit_type === "meeting_room_hours");
              const sama = isActive && activePlan?.id === plan.id;
              const terjadwal = isActive && current.scheduled_plan?.id === plan.id;
              const naik = isActive && activePlan && plan.price > activePlan.price;

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col ${
                    sama ? "border-brown-500 ring-2 ring-tan-300/60" : "border-cream-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-brown-900">{plan.name}</h3>
                    {sama && (
                      <span className="text-xs font-medium bg-cream-100 text-brown-800 px-2.5 py-1 rounded-full">
                        Paket Anda
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-brown-600 mb-4">{plan.description || "Paket keanggotaan Cakra Space"}</p>

                  <div className="mb-5">
                    <span className="text-2xl font-bold text-brown-900">{Format.rupiah(plan.price)}</span>
                    <span className="text-sm text-brown-600"> / {plan.duration_days} hari</span>
                  </div>

                  <ul className="space-y-2.5 text-sm text-brown-700 mb-6 flex-1">
                    <li className="flex items-start gap-2">
                      <Building2 size={16} className="text-brown-500 mt-0.5 flex-none" />
                      <span>Akses hot desk di: {namaGedung(plan.building_ids)}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CalendarDays size={16} className="text-brown-500 mt-0.5 flex-none" />
                      <span>Masa aktif {plan.duration_days} hari dengan QR akses gedung</span>
                    </li>
                    {kuota && (
                      <li className="flex items-start gap-2">
                        <Clock size={16} className="text-brown-500 mt-0.5 flex-none" />
                        <span>Gratis {kuota.quantity} jam ruang rapat per 30 hari</span>
                      </li>
                    )}
                  </ul>

                  {!isActive ? (
                    <Button
                      onClick={() => pilihPaket(plan)}
                      loading={busyPlanId === plan.id}
                      className="w-full"
                    >
                      <Sparkles size={16} className="inline mr-1.5 -mt-0.5" />
                      {isPending && activePlan?.id === plan.id ? "Bayar Paket Ini" : "Pilih Paket"}
                    </Button>
                  ) : sama ? (
                    <Button variant="secondary" disabled className="w-full">
                      <Check size={16} className="inline mr-1.5 -mt-0.5" />
                      Paket Aktif Saat Ini
                    </Button>
                  ) : naik ? (
                    <Button
                      onClick={() => gantiPaket(plan)}
                      loading={busyPlanId === plan.id}
                      className="w-full"
                    >
                      <ArrowUpRight size={16} className="inline mr-1 -mt-0.5" />
                      Upgrade Paket
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={terjadwal}
                      loading={busyPlanId === plan.id}
                      onClick={() => gantiPaket(plan)}
                      className="w-full"
                    >
                      {terjadwal ? "Terjadwal Periode Depan" : "Turunkan Periode Depan"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ActiveSubscriptionCard({ current, buildingLabel, onRenew, onReload, onAlert }) {
  const { subscription: sub, plan, scheduled_plan: scheduledPlan, status, benefits = [] } = current;
  const kuota = benefits.find((b) => b.benefit_type === "meeting_room_hours");
  const todayIso = Format.isoDate(new Date());
  const adaFreeze = Boolean(sub.freeze_until && sub.freeze_until >= todayIso);

  const [showFreeze, setShowFreeze] = useState(false);
  const [startDate, setStartDate] = useState(todayIso);
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);

  const ajukanFreeze = async (e) => {
    e.preventDefault();
    setBusy(true);
    onAlert(null);
    try {
      await api.member.freeze(startDate, Number(days));
      setShowFreeze(false);
      onAlert({ type: "success", message: `Membership dibekukan selama ${days} hari mulai ${Format.longDate(startDate)}.` });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const akhiriFreeze = async () => {
    setBusy(true);
    onAlert(null);
    try {
      await api.member.unfreeze();
      onAlert({ type: "success", message: "Freeze diakhiri dan membership kembali aktif." });
      onReload();
    } catch (err) {
      onAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-brown-600">Langganan Saya</p>
          <h2 className="text-xl font-bold text-brown-900">{plan.name}</h2>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="grid sm:grid-cols-2 gap-3 text-sm mb-5">
        <div className="bg-cream-50 rounded-lg p-3">
          <dt className="text-brown-600">Cakupan Gedung</dt>
          <dd className="font-medium text-brown-900 mt-0.5">{buildingLabel}</dd>
        </div>
        <div className="bg-cream-50 rounded-lg p-3">
          <dt className="text-brown-600">Masa Berlaku</dt>
          <dd className="font-medium text-brown-900 mt-0.5">
            {sub.start_date && sub.end_date
              ? `${Format.shortDate(sub.start_date)} – ${Format.longDate(sub.end_date)} (${current.days_left} hari lagi)`
              : "Menunggu pembayaran"}
          </dd>
        </div>
      </dl>

      {scheduledPlan && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-4 py-3 text-sm mb-4">
          Dijadwalkan beralih ke paket <strong>{scheduledPlan.name}</strong> ({Format.rupiah(scheduledPlan.price)}) pada
          periode berikutnya.
        </div>
      )}

      {kuota && (
        <div className="border-t border-cream-200 pt-4 mb-5">
          <div className="flex justify-between text-sm text-brown-700 mb-1.5">
            <span>Kuota Ruang Rapat Bulan Ini</span>
            <span className="font-semibold text-brown-900">
              Sisa {Format.hours(kuota.remaining_minutes)} dari {Format.hours(kuota.quota_minutes)}
            </span>
          </div>
          <div className="h-2.5 bg-cream-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brown-600 transition-all"
              style={{ width: `${Math.round((kuota.remaining_minutes / kuota.quota_minutes) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-brown-500 mt-1.5">
            Periode kuota: {Format.shortDate(kuota.period_start)} s/d {Format.shortDate(kuota.period_end)} · Terpakai{" "}
            {Format.hours(kuota.used_minutes)}
          </p>
        </div>
      )}

      {(status === "active" || status === "frozen") && (
        <div className="border-t border-cream-200 pt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-brown-700">
              {adaFreeze ? (
                <p>
                  <Snowflake size={15} className="inline mr-1 text-blue-600 -mt-0.5" />
                  Freeze aktif/terjadwal: <strong>{Format.shortDate(sub.freeze_from)}</strong> s/d{" "}
                  <strong>{Format.shortDate(sub.freeze_until)}</strong>
                </p>
              ) : (
                <p>
                  Sisa kuota freeze periode ini: <strong>{current.freeze_days_left} hari</strong>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {adaFreeze ? (
                <Button variant="secondary" className="text-sm" loading={busy} onClick={akhiriFreeze}>
                  Akhiri Freeze Sekarang
                </Button>
              ) : (
                current.freeze_days_left > 0 && (
                  <Button
                    variant="secondary"
                    className="text-sm"
                    onClick={() => setShowFreeze(!showFreeze)}
                  >
                    <Snowflake size={15} className="inline mr-1 -mt-0.5" />
                    {showFreeze ? "Tutup Freeze" : "Bekukan (Freeze)"}
                  </Button>
                )
              )}

              {current.can_renew ? (
                <Button className="text-sm" onClick={onRenew}>
                  <RefreshCw size={15} className="inline mr-1.5 -mt-0.5" />
                  Perpanjang Membership
                </Button>
              ) : (
                <span className="text-xs text-brown-500 self-center">
                  Perpanjangan dibuka 7 hari sebelum masa berlaku habis
                </span>
              )}
            </div>
          </div>

          {showFreeze && !adaFreeze && (
            <form onSubmit={ajukanFreeze} className="bg-cream-50 border border-cream-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-brown-900">
                Bekukan Membership (menggeser tanggal berakhir sesuai jumlah hari freeze)
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-brown-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    min={todayIso}
                    max={sub.end_date}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-tan-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brown-700 mb-1">
                    Durasi Hari (maks {current.freeze_days_left} hari)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={current.freeze_days_left}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-tan-300 rounded-lg bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" className="text-sm" onClick={() => setShowFreeze(false)}>
                  Batal
                </Button>
                <Button type="submit" className="text-sm" loading={busy}>
                  Simpan Freeze
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
