import { useState } from "react";
import { Link } from "react-router-dom";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import MailboxHint from "../components/auth/MailboxHint";
import { api } from "../api";

// nama field dari API dipetakan ke nama input di form ini
const FIELD_API = { password_confirmation: "confirm" };

export default function Register() {
  // tidak ada pilihan role: registrasi selalu member, akun pengelola dibuat admin pusat
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};

    if (!form.name) newErrors.name = "Nama wajib diisi";

    if (!form.email) {
      newErrors.email = "Email wajib diisi";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Format email tidak valid";
    }

    if (!form.password) {
      newErrors.password = "Password wajib diisi";
    } else if (form.password.length < 8) {
      newErrors.password = "Password minimal 8 karakter";
    }

    if (form.password !== form.confirm) {
      newErrors.confirm = "Konfirmasi password tidak cocok";
    }

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
      await api.auth.register(form);
      setRegisteredEmail(form.email);
      setAlert({
        type: "success",
        message: "Akun berhasil dibuat. Link verifikasi sudah dikirim ke email Anda dan berlaku 24 jam.",
      });
    } catch (err) {
      const fieldErrors = {};
      for (const [field, pesan] of Object.entries(err.fieldErrors || {})) {
        fieldErrors[FIELD_API[field] || field] = pesan;
      }
      setErrors(fieldErrors);
      setAlert({ type: "error", message: err.message || "Registrasi gagal" });
    } finally {
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-center text-brown-900 mb-4">Cek Email Anda</h1>
          <Alert type={alert.type} message={alert.message} />
          <p className="text-sm text-brown-700">
            Buka link verifikasi yang dikirim ke <strong>{registeredEmail}</strong>. Anda tetap bisa login sekarang,
            tetapi booking baru bisa dibuat setelah email terverifikasi.
          </p>
          <MailboxHint email={registeredEmail} />
          <Link to="/login" className="block mt-6">
            <Button variant="primary" className="w-full">
              Ke Halaman Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-brown-900 mb-2">
          Daftar Akun Cakra Space
        </h1>
        <p className="text-center text-brown-600 mb-6">
          Buat akun untuk mulai memesan meja & ruang rapat
        </p>

        <Alert type={alert.type} message={alert.message} />

        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Nama Lengkap"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Nama Anda"
            error={errors.name}
            required
          />

          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="nama@email.com"
            error={errors.email}
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Minimal 8 karakter"
            error={errors.password}
            required
          />

          <Input
            label="Konfirmasi Password"
            name="confirm"
            type="password"
            value={form.confirm}
            onChange={handleChange}
            placeholder="Ulangi password"
            error={errors.confirm}
            required
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
          >
            Daftar
          </Button>
        </form>

        <p className="text-center text-sm text-brown-700 mt-6">
          Sudah punya akun?{" "}
          <Link
            to="/login"
            className="text-brown-500 hover:underline font-medium"
          >
            Login di sini
          </Link>
        </p>
      </div>
    </div>
  );
}