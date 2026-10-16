import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};

    if (!form.email) {
      newErrors.email = "Email wajib diisi";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Format email tidak valid";
    }

    if (!form.password) newErrors.password = "Password wajib diisi";

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

      // Ambil daftar user dari localStorage
      const users = JSON.parse(localStorage.getItem("users") || "[]");

      // Cari user yang cocok email & password
      const foundUser = users.find(
        (u) => u.email === form.email && u.password === form.password
      );

      if (!foundUser) {
        throw new Error("Email atau password salah");
      }

      // Login berhasil → simpan ke AuthContext
      login("dummy-token-" + Date.now(), {
        id: foundUser.email,
        name: foundUser.name,
        email: foundUser.email,
      });

      setAlert({
        type: "success",
        message: "Login berhasil! Mengarahkan...",
      });

      // Redirect ke halaman gedung setelah 1 detik
      setTimeout(() => {
  navigate("/dashboard");
}, 1000);
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-brown-900 mb-2">
          Cakra Space
        </h1>
        <p className="text-center text-brown-600 mb-6">Masuk ke akun Anda</p>

        <Alert type={alert.type} message={alert.message} />

        <form onSubmit={handleSubmit} noValidate>
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
            placeholder="Masukkan password"
            error={errors.password}
            required
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
          >
            Login
          </Button>
        </form>

        <p className="text-center text-sm text-brown-700 mt-6">
          Belum punya akun?{" "}
          <Link
            to="/register"
            className="text-brown-500 hover:underline font-medium"
          >
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}