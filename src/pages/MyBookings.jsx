import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { getBookings } from "../utils/storage";
import { useAuth } from "../context/AuthContext";

export default function MyBookings() {
  const [activeTab, setActiveTab] = useState("upcoming");

  // Pisahkan booking berdasarkan tanggal
  const today = new Date();
  today.setHours(0, 0, 0, 0);
const { user } = useAuth();
const allBookings = getBookings();

// Filter hanya booking milik user yang login
const bookings = allBookings.filter((b) => b.userId === user?.email);

const upcomingBookings = bookings.filter(
  (b) => new Date(b.date) >= today && b.status !== "cancelled"
);
const pastBookings = bookings.filter(
  (b) => new Date(b.date) < today || b.status === "cancelled"
);

  const displayedBookings =
    activeTab === "upcoming" ? upcomingBookings : pastBookings;

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brown-900">Booking Saya</h1>
          <p className="text-brown-600 mt-1">
            Lihat dan kelola semua booking Anda
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream-200 mb-6">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === "upcoming"
                ? "border-b-2 border-blue-600 text-brown-500"
                : "text-brown-600 hover:text-brown-800"
            }`}
          >
            Akan Datang ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === "past"
                ? "border-b-2 border-blue-600 text-brown-500"
                : "text-brown-600 hover:text-brown-800"
            }`}
          >
            Riwayat ({pastBookings.length})
          </button>
        </div>

        {/* Daftar Booking */}
        {displayedBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-12 text-center">
            <p className="text-brown-600 mb-4">
              {activeTab === "upcoming"
                ? "Belum ada booking yang akan datang."
                : "Belum ada riwayat booking."}
            </p>
            <Link to="/buildings">
              <Button variant="primary">Cari Ruang & Booking</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-xl shadow-sm border border-cream-200 p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Info Booking */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-brown-900">
                        {booking.roomName}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          booking.status === "confirmed"
                            ? "bg-green-100 text-green-700"
                            : booking.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {booking.status === "confirmed"
                          ? "Confirmed"
                          : booking.status === "cancelled"
                          ? "Dibatalkan"
                          : "Menunggu"}
                      </span>
                    </div>

                    <p className="text-sm text-brown-600 mb-1">
                      {booking.buildingName}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-brown-700 mt-2">
                      <span>
                        📅{" "}
                        {new Date(booking.date).toLocaleDateString("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span>🕐 {booking.startTime}</span>
                      <span>⏱️ {booking.duration} jam</span>
                    </div>

                    <p className="text-sm text-brown-600 mt-2">
                      Kode:{" "}
                      <span className="font-mono font-medium text-brown-800">
                        {booking.code}
                      </span>
                    </p>

                    <p className="text-lg font-bold text-brown-500 mt-2">
                      Rp {booking.total.toLocaleString("id-ID")}
                    </p>
                  </div>

                  {/* Tombol Aksi */}
                 <div className="flex sm:flex-col gap-2 sm:min-w-35">
                    <Link
                      to={`/booking/confirm/${booking.id}`}
                      className="flex-1 sm:flex-none"
                    >
                      <Button variant="primary" className="w-full text-sm">
                        Lihat QR
                      </Button>
                    </Link>

                    <Link
                      to={`/booking/${booking.roomId}`}
                      className="flex-1 sm:flex-none"
                    >
                      <Button variant="secondary" className="w-full text-sm">
                        Pesan Lagi
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}