import { useParams, Link, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { mockBookings } from "../utils/mockData";

export default function BookingConfirm() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Cari booking berdasarkan id
  const booking = mockBookings.find((b) => b.id === Number(id));

  // Kalau booking tidak ditemukan
  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Booking tidak ditemukan
          </h1>
          <Button onClick={() => navigate("/buildings")}>
            Kembali ke Daftar Gedung
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-2xl mx-auto p-6">
        {/* Alert Sukses */}
        <Alert type="success" message="Booking berhasil dibuat!" />

        {/* Card Konfirmasi */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Konfirmasi Booking
            </h1>
            <p className="text-gray-500 text-sm">
              Tunjukkan QR code ini di resepsionis saat check-in
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 border-2 border-gray-200 rounded-xl">
              <QRCode
                value={booking.code}
                size={180}
                bgColor="#ffffff"
                fgColor="#1e40af"
              />
            </div>
          </div>

          {/* Kode Booking */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 mb-1">Kode Booking</p>
            <p className="text-xl font-bold text-gray-800 tracking-wider">
              {booking.code}
            </p>
          </div>

          {/* Detail Booking */}
          <div className="border-t border-gray-200 pt-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Nama Ruang</span>
              <span className="text-sm font-medium text-gray-800 text-right">
                {booking.roomName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Gedung</span>
              <span className="text-sm font-medium text-gray-800 text-right">
                {booking.buildingName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tanggal</span>
              <span className="text-sm font-medium text-gray-800 text-right">
                {new Date(booking.date).toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Jam Mulai</span>
              <span className="text-sm font-medium text-gray-800 text-right">
                {booking.startTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Durasi</span>
              <span className="text-sm font-medium text-gray-800 text-right">
                {booking.duration} jam
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3">
              <span className="text-sm font-semibold text-gray-700">
                Total Bayar
              </span>
              <span className="text-lg font-bold text-blue-600">
                Rp {booking.total.toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 text-center">
              Status: <strong>Confirmed</strong> — Simpan kode booking ini untuk check-in
            </p>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="flex gap-3 mt-6">
          <Link to="/" className="flex-1">
            <Button variant="secondary" className="w-full">
              Ke Beranda
            </Button>
          </Link>
          <Link to="/my-bookings" className="flex-1">
            <Button variant="primary" className="w-full">
              Lihat Booking Saya
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}