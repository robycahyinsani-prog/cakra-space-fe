import { Link } from "react-router-dom";
import { Building2, CalendarCheck, Shield, ArrowRight, MapPin } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-4">
            Coworking Space <span className="text-blue-600">Tanpa Ribet</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Pesan meja kerja dan ruang rapat secara online. Cek ketersediaan real-time,
            dapatkan QR code untuk check-in, kelola semua booking dari satu dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={isAuthenticated ? "/buildings" : "/register"}>
              <Button variant="primary" className="w-full sm:w-auto px-8 py-3">
                {isAuthenticated ? "Cari Ruang" : "Mulai Sekarang"}
                <ArrowRight size={18} className="inline ml-2" />
              </Button>
            </Link>
            {!isAuthenticated && (
              <Link to="/login">
                <Button variant="secondary" className="w-full sm:w-auto px-8 py-3">
                  Sudah Punya Akun
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Fitur */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-10">
          Kenapa Cakra Space?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Building2 className="text-blue-600" size={24} />
            </div>
            <h3 className="font-semibold text-lg text-gray-800 mb-2">
              Multi-Cabang
            </h3>
            <p className="text-gray-500 text-sm">
              Akses semua cabang Cakra Space di berbagai kota. Pilih lokasi
              yang paling dekat dengan Anda.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <CalendarCheck className="text-green-600" size={24} />
            </div>
            <h3 className="font-semibold text-lg text-gray-800 mb-2">
              Booking Instan
            </h3>
            <p className="text-gray-500 text-sm">
              Cek ketersediaan real-time, booking dalam hitungan detik,
              dapatkan konfirmasi QR code langsung.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="text-purple-600" size={24} />
            </div>
            <h3 className="font-semibold text-lg text-gray-800 mb-2">
              Aman & Terpercaya
            </h3>
            <p className="text-gray-500 text-sm">
              Data Anda terlindungi. Akses gedung dengan QR code pribadi
              yang unik untuk setiap member.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      {!isAuthenticated && (
        <section className="max-w-7xl mx-auto px-6 pb-16">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-10 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">
              Siap mulai bekerja lebih produktif?
            </h2>
            <p className="mb-6 text-blue-100">
              Daftar gratis dan pesan meja kerja pertama Anda hari ini.
            </p>
            <Link to="/register">
              <button className="bg-white text-blue-600 font-medium px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors">
                Daftar Sekarang
              </button>
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        © 2026 Cakra Space — Sistem Manajemen Coworking Space
      </footer>
    </div>
  );
}