import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const navigate = useNavigate();

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
      // Simulasi delay seperti request ke API
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Ambil daftar user yang sudah ada di localStorage
      const users = JSON.parse(localStorage.getItem("users") || "[]");

      // Cek apakah email sudah terdaftar
      const existingUser = users.find((u) => u.email === form.email);
      if (existingUser) {
        setAlert({
          type: "error",
          message: "Email sudah terdaftar. Silakan login.",
        });
        setLoading(false);
        return;
      }

      // Simpan user baru ke localStorage
      users.push({
        name: form.name,
        email: form.email,
        password: form.password, // CATATAN: di produksi harus di-hash di server
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("users", JSON.stringify(users));

      // Tampilkan sukses
      setAlert({
        type: "success",
        message: "Registrasi berhasil! Mengarahkan ke halaman login...",
      });

      // Redirect ke login setelah 1.5 detik
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Registrasi gagal" });
    } finally {
      setLoading(false);
    }
  };

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