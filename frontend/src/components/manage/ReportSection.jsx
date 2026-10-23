import { useState } from "react";
import { Download, BarChart3, Users, FileSpreadsheet } from "lucide-react";
import Button from "../Button";
import Alert from "../Alert";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import MailboxHint from "../auth/MailboxHint";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import FileDownload from "../../utils/FileDownload";
import { api } from "../../api";

const REPORT_TYPES = [
  { value: "revenue", label: "Laporan Pendapatan" },
  { value: "members", label: "Laporan Member & Churn" },
  { value: "bookings", label: "Laporan Booking" },
  { value: "access_logs", label: "Log Akses Gedung" },
];

// laporan pendapatan, member & churn, serta ekspor laporan ke Excel/PDF (BE-45, BE-46, BE-47)
export default function ReportSection({ buildings }) {
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [dateFrom, setDateFrom] = useState(Format.isoDate(sixMonthsAgo));
  const [dateTo, setDateTo] = useState(Format.isoDate(today));
  const [filterBuildingId, setFilterBuildingId] = useState("");
  const [filterPlanId, setFilterPlanId] = useState("");

  // state ekspor laporan (BE-47)
  const [exportReport, setExportReport] = useState("revenue");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportJobs, setExportJobs] = useState([]);

  const plans = useResource(() => api.manage.plans(), []);

  const revenueParams = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    building_id: filterBuildingId || undefined,
  };
  const memberParams = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    building_id: filterBuildingId || undefined,
    plan_id: filterPlanId || undefined,
  };

  const revenue = useResource(
    () => api.manage.revenueReport(revenueParams),
    [dateFrom, dateTo, filterBuildingId]
  );
  const members = useResource(
    () => api.manage.membersReport(memberParams),
    [dateFrom, dateTo, filterBuildingId, filterPlanId]
  );

  const unduhHasilEkspor = async (job) => {
    try {
      const blob = await api.manage.downloadExport(job.id);
      FileDownload.save(blob, job.filename || `laporan-${job.report}.${job.format}`);
    } catch (err) {
      setExportError(err);
    }
  };

  const buatEkspor = async (e) => {
    e.preventDefault();
    setExportBusy(true);
    setExportError(null);
    try {
      let job = await api.manage.createExport({
        report: exportReport,
        format: exportFormat,
        date_from: dateFrom,
        date_to: dateTo,
        building_id: filterBuildingId ? Number(filterBuildingId) : null,
        plan_id: filterPlanId ? Number(filterPlanId) : null,
      });
      // jika status masih pending, cek status beberapa kali sampai selesai
      let attempts = 0;
      while (job.status === "pending" && attempts < 5) {
        await new Promise((r) => setTimeout(r, 600));
        job = await api.manage.exportStatus(job.id);
        attempts += 1;
      }
      setExportJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      if (job.status === "done") {
        await unduhHasilEkspor(job);
      }
    } catch (err) {
      setExportError(err);
    } finally {
      setExportBusy(false);
    }
  };

  const segarkanJob = async (jobId) => {
    try {
      const updated = await api.manage.exportStatus(jobId);
      setExportJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      if (updated.status === "done") {
        await unduhHasilEkspor(updated);
      }
    } catch (err) {
      setExportError(err);
    }
  };

  const revenueRows = revenue.data?.rows || [];
  const maxNet = Math.max(1, ...revenueRows.map((r) => Math.max(0, r.net || 0)));

  const memberRows = members.data?.rows || [];
  const maxMemberCount = Math.max(
    1,
    ...memberRows.map((r) => Math.max(r.new || 0, r.active || 0, r.churned || 0))
  );

  return (
    <div className="space-y-8">
      {/* Filter Periode & Gedung */}
      <section className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
        <h2 className="text-base font-semibold text-brown-900 mb-3">Filter Periode & Lokasi Laporan</h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Gedung</label>
            <select
              value={filterBuildingId}
              onChange={(e) => setFilterBuildingId(e.target.value)}
              className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white"
            >
              <option value="">Semua Gedung</option>
              {(buildings || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Paket Membership</label>
            <select
              value={filterPlanId}
              onChange={(e) => setFilterPlanId(e.target.value)}
              className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white"
            >
              <option value="">Semua Paket</option>
              {(plans.data || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Laporan Pendapatan (K5-US-009.2 / FE-81) */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-brown-600" />
            Laporan Pendapatan Bulanan
          </h2>
          {revenue.data && (
            <span className="text-sm font-semibold text-brown-900 bg-cream-100 px-3 py-1 rounded-full">
              Total Pendapatan Bersih: {Format.rupiah(revenue.data.total_net || 0)}
            </span>
          )}
        </div>

        <PageState loading={revenue.loading} error={revenue.error} onRetry={revenue.reload}>
          {revenueRows.length === 0 ? (
            <p className="bg-white rounded-xl border border-cream-200 p-6 text-center text-brown-600 text-sm">
              Belum ada data pendapatan pada rentang tanggal ini.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Grafik Batang Pendapatan Bersih */}
              <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brown-500">
                  Grafik Pendapatan Bersih per Gedung & Bulan
                </p>
                {revenueRows.map((row) => {
                  const pct = Math.max(4, Math.round((Math.max(0, row.net) / maxNet) * 100));
                  return (
                    <div key={`${row.building_id}-${row.month}`} className="space-y-1">
                      <div className="flex justify-between text-xs text-brown-800">
                        <span className="font-medium">
                          {row.month} · {row.building_name}
                        </span>
                        <span className="font-semibold tabular-nums">{Format.rupiah(row.net)}</span>
                      </div>
                      <div className="w-full h-3 bg-cream-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brown-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabel Detail Pendapatan */}
              <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-cream-50 text-brown-800">
                      <th className="p-3 font-semibold">Bulan</th>
                      <th className="p-3 font-semibold">Gedung</th>
                      <th className="p-3 font-semibold text-right">Pendapatan Kotor</th>
                      <th className="p-3 font-semibold text-right">Refund</th>
                      <th className="p-3 font-semibold text-right">Pendapatan Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {revenueRows.map((row) => (
                      <tr key={`${row.building_id}-${row.month}`} className="hover:bg-cream-50">
                        <td className="p-3 font-mono text-brown-800">{row.month}</td>
                        <td className="p-3 text-brown-900 font-medium">{row.building_name}</td>
                        <td className="p-3 text-right tabular-nums text-brown-700">{Format.rupiah(row.gross)}</td>
                        <td className="p-3 text-right tabular-nums text-red-700">
                          {row.refunds > 0 ? `-${Format.rupiah(row.refunds)}` : Format.rupiah(0)}
                        </td>
                        <td className="p-3 text-right tabular-nums font-semibold text-brown-900">
                          {Format.rupiah(row.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PageState>
      </section>

      {/* Laporan Pertumbuhan Member & Churn (K5-US-009.3 / FE-82) */}
      <section>
        <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2 mb-3">
          <Users size={20} className="text-brown-600" />
          Laporan Pertumbuhan Member & Churn
        </h2>

        <PageState loading={members.loading} error={members.error} onRetry={members.reload}>
          {memberRows.length === 0 ? (
            <p className="bg-white rounded-xl border border-cream-200 p-6 text-center text-brown-600 text-sm">
              Belum ada data langganan member pada rentang tanggal ini.
            </p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-cream-50 text-brown-800">
                    <th className="p-3 font-semibold">Bulan</th>
                    <th className="p-3 font-semibold">Paket Membership</th>
                    <th className="p-3 font-semibold text-right">Member Baru</th>
                    <th className="p-3 font-semibold text-right">Member Aktif</th>
                    <th className="p-3 font-semibold text-right">Berhenti (Churn)</th>
                    <th className="p-3 font-semibold">Distribusi Visual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {memberRows.map((row) => (
                    <tr key={`${row.month}-${row.plan_id}`} className="hover:bg-cream-50">
                      <td className="p-3 font-mono text-brown-800">{row.month}</td>
                      <td className="p-3 font-medium text-brown-900">{row.plan_name}</td>
                      <td className="p-3 text-right tabular-nums text-blue-700 font-medium">{row.new}</td>
                      <td className="p-3 text-right tabular-nums text-green-700 font-medium">{row.active}</td>
                      <td className="p-3 text-right tabular-nums text-red-700 font-medium">{row.churned}</td>
                      <td className="p-3 w-48">
                        <div className="flex items-center gap-1 h-2.5">
                          <div
                            title={`Baru: ${row.new}`}
                            className="h-full bg-blue-500 rounded-l"
                            style={{ width: `${Math.max(4, Math.round((row.new / maxMemberCount) * 100))}%` }}
                          />
                          <div
                            title={`Aktif: ${row.active}`}
                            className="h-full bg-green-600"
                            style={{ width: `${Math.max(4, Math.round((row.active / maxMemberCount) * 100))}%` }}
                          />
                          {row.churned > 0 && (
                            <div
                              title={`Churn: ${row.churned}`}
                              className="h-full bg-red-500 rounded-r"
                              style={{ width: `${Math.max(4, Math.round((row.churned / maxMemberCount) * 100))}%` }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageState>
      </section>

      {/* Ekspor Laporan ke Excel / PDF (K5-US-009.4 / FE-83) */}
      <section className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-brown-900 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-brown-600" />
            Ekspor Laporan (.xlsx / .pdf)
          </h2>
          <p className="text-sm text-brown-600 mt-1">
            Unduh laporan sesuai periode dan filter di atas. Laporan berukuran besar diproses di latar belakang dan dikirim ke email staf.
          </p>
        </div>

        <Alert message={exportError?.message} />

        <form onSubmit={buatEkspor} className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Jenis Laporan</label>
            <select
              value={exportReport}
              onChange={(e) => setExportReport(e.target.value)}
              className="px-3 py-2 border border-tan-300 rounded-lg bg-white"
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brown-700 mb-1">Format File</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="px-3 py-2 border border-tan-300 rounded-lg bg-white"
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>
          <Button type="submit" loading={exportBusy}>
            <Download size={15} className="inline mr-1.5 -mt-0.5" />
            Buat & Unduh Laporan
          </Button>
        </form>

        {exportJobs.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-cream-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-brown-500">Riwayat Ekspor Sesi Ini</p>
            {exportJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-cream-50 rounded-lg p-3 text-sm border border-cream-200"
              >
                <div>
                  <span className="font-medium text-brown-900">{job.filename}</span>
                  <span className="text-xs text-brown-600 ml-2">({job.row_count} baris)</span>
                  {job.emailed && (
                    <span className="text-xs text-blue-700 block">
                      Salinan tautan unduhan juga dikirim ke Kotak Masuk Uji staf.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                  {job.status === "pending" && (
                    <Button variant="secondary" className="text-xs py-1 px-2.5" onClick={() => segarkanJob(job.id)}>
                      Cek Status
                    </Button>
                  )}
                  {job.status === "done" && (
                    <Button variant="secondary" className="text-xs py-1 px-2.5" onClick={() => unduhHasilEkspor(job)}>
                      <Download size={13} className="inline mr-1 -mt-0.5" />
                      Unduh Lagi
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {exportJobs.some((j) => j.emailed) && <MailboxHint />}
          </div>
        )}
      </section>
    </div>
  );
}
