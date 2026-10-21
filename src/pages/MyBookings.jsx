import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import PageState from "../components/common/PageState";
import StatusBadge from "../components/common/StatusBadge";
import useResource from "../hooks/useResource";
import Format from "../utils/Format";
import { api } from "../api";

const TABS = [
  { key: "upcoming", label: "Akan Datang" },
  { key: "history", label: "Riwayat" },
];
const PAGE_SIZE = 10;

export default function MyBookings() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useResource(
    () => api.bookings.mine(activeTab, page, PAGE_SIZE),
    [activeTab, page]
  );
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const gantiTab = (key) => {
    setActiveTab(key);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brown-900">Booking Saya</h1>
          <p className="text-brown-600 mt-1">Lihat dan kelola semua booking Anda</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream-200 mb-6" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => gantiTab(tab.key)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-brown-500 text-brown-500"
                  : "text-brown-600 hover:text-brown-800"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && data ? ` (${data.total})` : ""}
            </button>
          ))}
        </div>

        <PageState loading={loading} error={error} onRetry={reload}>
          {data && data.items.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-12 text-center">
              <p className="text-brown-600 mb-4">
                {activeTab === "upcoming" ? "Belum ada booking yang akan datang." : "Belum ada riwayat booking."}
              </p>
              <Link to="/buildings">
                <Button variant="primary">Cari Ruang & Booking</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.items.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </PageState>

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 text-sm text-brown-700">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </Button>
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <Button variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
              Berikutnya
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-semibold text-brown-900">{booking.area.name}</h3>
            <StatusBadge status={booking.status} />
          </div>

          <p className="text-sm text-brown-600 flex items-center gap-1">
            <MapPin size={14} /> {booking.building.name}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-brown-700 mt-2">
            <span className="flex items-center gap-1">
              <CalendarDays size={14} /> {Format.longDate(booking.local_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} /> {Format.clock(booking.local_start)}-{Format.clock(booking.local_end)}
            </span>
          </div>

          <p className="text-sm text-brown-600 mt-2">
            Kode: <span className="font-mono font-medium text-brown-800">{booking.code}</span>
          </p>

          <p className="text-lg font-bold text-brown-500 mt-2">{Format.rupiah(booking.total)}</p>
        </div>

        <div className="flex sm:flex-col gap-2 sm:min-w-36">
          <Link to={`/booking/confirm/${booking.id}`} className="flex-1 sm:flex-none">
            <Button variant="primary" className="w-full text-sm">
              {booking.can_pay ? "Bayar" : "Detail"}
            </Button>
          </Link>
          <Link to={`/booking/${booking.rebook.area_id}`} className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full text-sm">
              Pesan Lagi
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
