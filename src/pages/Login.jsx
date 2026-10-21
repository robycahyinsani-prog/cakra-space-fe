import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

// hanya path internal yang boleh jadi tujuan redirect
function safeRedirect(value) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get("redirect"));

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
      const result = await api.auth.login(form.email, form.password);
      login(result);
      // staf baru dengan password sementara wajib menggantinya dulu
      if (result.must_change_password) return navigate("/change-password", { replace: true });
      // landing dari API: /dashboard untuk member, /admin-dashboard untuk staf
      navigate(redirect || result.landing, { replace: true });
    } catch (err) {
      setAlert({ type: "error", message: err.message });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-cream-200">
        <h1 className="text-2xl font-bold text-center text-brown-900 mb-2">
          Cakra Space
        </h1>
        <p className="text-center text-brown-600 mb-6">
          {redirect ? "Login dulu untuk melanjutkan" : "Masuk ke akun Anda"}
        </p>

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

          <div className="text-right -mt-2 mb-4">
            <Link to="/forgot-password" className="text-sm text-brown-500 hover:underline">
              Lupa password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full mt-2"
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