import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { mockBuildings, mockRooms } from "../utils/mockData";
import { addBooking } from "../utils/storage";

export default function BookingForm() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const room = mockRooms.find((r) => r.id === Number(roomId));
  const building = room ? mockBuildings.find((b) => b.id === room.buildingId) : null;

  const [form, setForm] = useState({
    date: "",
    startTime: "",
    duration: 1,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });

  // Kalau ruang tidak ditemukan
  if (!room) {
    return (
      <div className="min-h-screen bg-cream-50">
        <Navbar />
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="text-2xl font-bold text-brown-900 mb-4">
            Ruang tidak ditemukan
          </h1>
          <Button onClick={() => navigate("/buildings")}>
            Kembali ke Daftar Gedung
          </Button>
        </div>
      </div>
    );
  }

  // Hitung total harga
  const subtotal = room.price_per_hour * form.duration;
  const tax = subtotal * 0.1; // pajak 10%
  const total = subtotal + tax;

  const handleChange = (e) => {
    const value = e.target.name === "duration" 
      ? Number(e.target.value) 
      : e.target.value;
    setForm({ ...form, [e.target.name]: value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.date) newErrors.date = "Tanggal wajib diisi";
    if (!form.startTime) newErrors.startTime = "Jam mulai wajib diisi";
    if (form.duration < 1) newErrors.duration = "Durasi minimal 1 jam";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ type: "", message: "" });

    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setLoading(true);

    try {
      // SEMENTARA: simulasi booking
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate kode booking dummy
    const bookingCode = `BK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      // Simpan booking ke mock (nanti diganti API)
    const newBooking = {
  id: crypto.randomUUID(),  // UUID unik
  code: bookingCode,
  roomId: room.id,
  roomName: room.name,
  buildingName: building.name,
  date: form.date,
  startTime: form.startTime,
  duration: form.duration,
  total: total,
  status: "confirmed",
  createdAt: new Date().toISOString(),
};

// Simpan ke localStorage
addBooking(newBooking);
      addBooking(newBooking);

      // Redirect ke halaman konfirmasi
      navigate(`/booking/confirm/${newBooking.id}`);
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Booking gagal" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />

      <div className="max-w-3xl mx-auto p-6">
        {/* Tombol kembali */}
        <Link
          to={`/buildings/${building?.id}`}
          className="text-brown-500 hover:underline text-sm mb-4 inline-block"
        >
          ← Kembali ke {building?.name}
        </Link>

        {/* Header */}
        <h1 className="text-2xl font-bold text-brown-900 mb-6">
          Form Booking
        </h1>

        {/* Info Ruang */}
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 mb-6">
          <h2 className="text-lg font-semibold text-brown-900 mb-2">
            {room.name}
          </h2>
          <p className="text-sm text-brown-600">
            {building?.name} — {building?.city}
          </p>
          <p className="text-sm text-brown-600 mt-1">
            Kapasitas: {room.capacity} orang • {room.facilities.join(" • ")}
          </p>
          <p className="text-lg font-bold text-brown-500 mt-3">
            Rp {room.price_per_hour.toLocaleString("id-ID")}
            <span className="text-sm font-normal text-brown-600">/jam</span>
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
          <Alert type={alert.type} message={alert.message} />

          <form onSubmit={handleSubmit} noValidate>
            <Input
              label="Tanggal"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              error={errors.date}
              required
            />

            <Input
              label="Jam Mulai"
              name="startTime"
              type="time"
              value={form.startTime}
              onChange={handleChange}
              error={errors.startTime}
              required
            />

            <Input
              label="Durasi (jam)"
              name="duration"
              type="number"
              value={form.duration}
              onChange={handleChange}
              error={errors.duration}
              required
            />

            {/* Ringkasan Harga */}
            <div className="border-t border-cream-200 pt-4 mt-4 mb-6">
              <div className="flex justify-between text-sm text-brown-700 mb-2">
                <span>Subtotal ({form.duration} jam)</span>
                <span>Rp {subtotal.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-sm text-brown-700 mb-2">
                <span>Pajak (10%)</span>
                <span>Rp {tax.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-brown-900 pt-2 border-t border-cream-200">
                <span>Total</span>
                <span>Rp {total.toLocaleString("id-ID")}</span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full"
            >
              Konfirmasi Booking
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}