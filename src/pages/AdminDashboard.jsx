import { useState } from "react";
import { Building2, Users, CalendarCheck } from "lucide-react";
import Navbar from "../components/Navbar";
import { getBookings } from "../utils/storage";

export default function AdminDashboard() {
  // Baca data langsung saat inisialisasi awal (bukan di useEffect)
  const [bookings] = useState(() => getBookings());
  const [totalUsers] = useState(() => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    return users.length;
  });

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-brown-900">Admin Dashboard</h1>
          <p className="text-brown-600 mt-1">Pantau seluruh aktivitas coworking space</p>
        </div>

        {/* Statistik Admin */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Building2 className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-brown-600">Total Gedung</p>
              <p className="text-xl font-bold text-brown-900">4</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CalendarCheck className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-brown-600">Total Booking Masuk</p>
              <p className="text-xl font-bold text-brown-900">{bookings.length}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-brown-600">Total Pengguna</p>
              <p className="text-xl font-bold text-brown-900">{totalUsers}</p>
            </div>
          </div>
        </div>

        {/* Tabel Semua Booking */}
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-hidden">
          <div className="p-5 border-b border-cream-200">
            <h2 className="font-semibold text-brown-900">Semua Riwayat Booking</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream-50 text-brown-800 text-sm">
                  <th className="p-4 font-semibold">Kode</th>
                  <th className="p-4 font-semibold">User (Email)</th>
                  <th className="p-4 font-semibold">Ruang</th>
                  <th className="p-4 font-semibold">Tanggal & Jam</th>
                  <th className="p-4 font-semibold">Total</th>
                  <th className="p-4 font-semibold">Status</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-cream-100">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-brown-500">
                      Belum ada booking yang masuk.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-cream-50 transition-colors">
                      <td className="p-4 text-sm font-medium text-brown-900">{b.code}</td>
                      <td className="p-4 text-sm text-brown-700">{b.userId}</td>
                      <td className="p-4 text-sm text-brown-700">
                        {b.roomName} <br/>
                        <span className="text-xs text-brown-500">{b.buildingName}</span>
                      </td>
                      <td className="p-4 text-sm text-brown-700">
                        {new Date(b.date).toLocaleDateString("id-ID")} <br/>
                        <span className="text-xs">{b.startTime} ({b.duration} jam)</span>
                      </td>
                      <td className="p-4 text-sm font-medium text-brown-900">
                        Rp {b.total.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 text-sm">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          Confirmed
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}