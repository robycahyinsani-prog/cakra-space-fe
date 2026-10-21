import { useState } from "react";
import { Download } from "lucide-react";
import Button from "../Button";
import PageState from "../common/PageState";
import StatusBadge from "../common/StatusBadge";
import useResource from "../../hooks/useResource";
import Format from "../../utils/Format";
import FileDownload from "../../utils/FileDownload";
import { CREDENTIALS } from "../../utils/labels";
import { api } from "../../api";

// log keluar masuk gedung beserta filter dan ekspor Excel (BE-32)
export default function AccessLogSection({ buildingId }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters = {
    building_id: buildingId,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    result: result || undefined,
  };

  const { data: logs, error, loading, reload } = useResource(
    () => api.manage.accessLogs(filters),
    [buildingId, dateFrom, dateTo, result]
  );

  const unduhExcel = async () => {
    setExporting(true);
    try {
      const blob = await api.manage.exportAccessLogs(filters);
      FileDownload.save(blob, `log-akses-${Format.isoDate(new Date())}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-brown-900">Log Akses Gedung</h2>
        <Button variant="secondary" className="text-sm" loading={exporting} onClick={unduhExcel}>
          <Download size={15} className="inline mr-1.5 -mt-0.5" />
          Ekspor Excel
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-4 mb-4 flex flex-wrap items-end gap-3 text-sm">
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
          <label className="block text-xs font-medium text-brown-700 mb-1">Hasil</label>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="px-3 py-1.5 border border-tan-300 rounded-lg bg-white"
          >
            <option value="">Semua Hasil</option>
            <option value="granted">Diizinkan</option>
            <option value="denied">Ditolak</option>
          </select>
        </div>
        {(dateFrom || dateTo || result) && (
          <Button
            variant="secondary"
            className="text-sm py-1.5"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setResult("");
            }}
          >
            Reset Filter
          </Button>
        )}
      </div>

      <PageState loading={loading} error={error} onRetry={reload}>
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-cream-50 text-brown-800">
                <th className="p-3 font-semibold">Waktu</th>
                <th className="p-3 font-semibold">Gedung & Pintu</th>
                <th className="p-3 font-semibold">Pengunjung</th>
                <th className="p-3 font-semibold">Kredensial</th>
                <th className="p-3 font-semibold">Hasil</th>
                <th className="p-3 font-semibold">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(logs || []).length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-brown-500">
                    Tidak ada catatan log akses pada filter ini.
                  </td>
                </tr>
              ) : (
                (logs || []).map((log) => (
                  <tr key={log.id} className="hover:bg-cream-50 transition-colors">
                    <td className="p-3 text-brown-700 whitespace-nowrap">{Format.dateTime(log.scanned_at)}</td>
                    <td className="p-3 text-brown-800">
                      {log.building_name}
                      {log.door && <span className="text-xs text-brown-500 block">{log.door}</span>}
                    </td>
                    <td className="p-3 font-medium text-brown-900">{log.member_name || log.guest_name || "-"}</td>
                    <td className="p-3 text-brown-700 whitespace-nowrap">
                      {CREDENTIALS[log.credential] || log.credential}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={log.result} />
                    </td>
                    <td className="p-3 text-brown-700">{log.reason}</td>
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
