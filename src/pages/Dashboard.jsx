import { Link } from "react-router-dom";
import { CalendarCheck, Clock, Wallet, MapPin, TrendingUp, ArrowRight } from "lucide-react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { getBookings } from "../utils/storage";
import { mockBuildings } from "../utils/mockData";

export default function Dashboard() {
  const { user } = useAuth();

  // Filter booking user (di prototype ini, anggap semua booking milik user)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

const bookings = getBookings();

const upcomingBookings = bookings
  .filter((b) => new Date(b.date) >= today && b.status !== "cancelled")
  .sort((a, b) => new Date(a.date) - new Date(b.date));

  const nextBooking = upcomingBookings[0];

  // Statistik
  const totalBookings = bookings.length;
const totalHours = bookings.reduce((sum, b) => sum + b.duration, 0);
const totalSpent = bookings.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Sapaan */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Halo, {user?.name} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Selamat datang di dashboard Cakra Space
          </p>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CalendarCheck className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Booking</p>
                <p className="text-xl font-bold text-gray-800">{totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Jam</p>
                <p className="text-xl font-bold text-gray-800">{totalHours} jam</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Wallet className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Biaya</p>
                <p className="text-xl font-bold text-gray-800">
                  Rp {totalSpent.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Berikutnya */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Booking Berikutnya
          </h2>

          {nextBooking ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                      Confirmed
                    </span>
                    <span className="text-xs text-gray-500">
                      Kode: {nextBooking.code}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-lg">
                    {nextBooking.roomName}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <MapPin size={14} />
                    {nextBooking.buildingName}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    <span>
                      📅{" "}
                      {new Date(nextBooking.date).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    <span>🕐 {nextBooking.startTime}</span>
                    <span>⏱️ {nextBooking.duration} jam</span>
                  </div>
                </div>
                <Link
                  to={`/booking/confirm/${nextBooking.id}`}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                >
                  Lihat QR
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-gray-500 mb-4">
                Belum ada booking yang akan datang
              </p>
              <Link
                to="/buildings"
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                Cari Ruang & Booking →
              </Link>
            </div>
          )}
        </div>

        {/* Aksi Cepat */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Aksi Cepat
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/buildings"
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <MapPin className="text-blue-600" size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Cari Ruang</h3>
                  <p className="text-sm text-gray-500">
                    Lihat gedung & ruang tersedia
                  </p>
                </div>
              </div>
            </Link>

            <Link
              to="/my-bookings"
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <TrendingUp className="text-green-600" size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Booking Saya</h3>
                  <p className="text-sm text-gray-500">
                    Lihat riwayat & status booking
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}