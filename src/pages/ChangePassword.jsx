import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

// nama field dari API dipetakan ke nama input di form ini
const FIELD_API = { current_password: "current", new_password: "password", password_confirmation: "confirm" };

// wajib untuk staf baru yang login dengan password sementara (BE-07), juga bisa dipakai semua akun
export default function ChangePassword() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const wajib = Boolean(user?.must_change_password);
  const [form, setForm] = useState({ current: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const hasil = {};
    if (!form.current) hasil.current = "Password lama wajib diisi";
    if (form.password.length < 8) hasil.password = "Password minimal 8 karakter";
    else if (form.password === form.current) hasil.password = "Password baru harus berbeda dari password lama";
    if (form.password !== form.confirm) hasil.confirm = "Konfirmasi password tidak cocok";
    return hasil;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ type: "", message: "" });
    const hasil = validate();
    if (Object.keys(hasil).length > 0) return setErrors(hasil);

    setLoading(true);
    try {
      // token lama dicabut server, jadi sesi diganti dengan token baru dari respons
      const result = await api.auth.changePassword(form.current, form.password, form.confirm);
      login(result);
      navigate(result.landing, { replace: true });
    } catch (err) {
      const fieldErrors = {};
      for (const [field, pesan] of Object.entries(err.fieldErrors || {})) {
        fieldErrors[FIELD_API[field] || field] = pesan;
      }
      setErrors(fieldErrors);
      setAlert({ type: "error", message: err.message });
      setLoading(false);
    }
  };

  const keluar = async () => {
    navigate("/");
    await logout();
  };

  return (
    <AuthCard
      title="Ganti Password"
      subtitle={wajib ? "Akun Anda masih memakai password sementara. Ganti dulu sebelum melanjutkan." : user?.email}
    >
      <Alert type={alert.type} message={alert.message} />
      <form onSubmit={handleSubmit} noValidate>
        <Input
          label={wajib ? "Password Sementara" : "Password Lama"}
          name="current"
          type="password"
          value={form.current}
          onChange={handleChange}
          error={errors.current}
          required
        />
        <Input
          label="Password Baru"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Minimal 8 karakter"
          error={errors.password}
          required
        />
        <Input
          label="Konfirmasi Password Baru"
          name="confirm"
          type="password"
          value={form.confirm}
          onChange={handleChange}
          error={errors.confirm}
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          Simpan Password
        </Button>
      </form>
      <p className="text-center text-sm text-brown-700 mt-6">
        {wajib ? (
          <button type="button" onClick={keluar} className="text-brown-500 hover:underline font-medium">
            Logout
          </button>
        ) : (
          <button type="button" onClick={() => navigate(-1)} className="text-brown-500 hover:underline font-medium">
            Kembali
          </button>
        )}
      </p>
    </AuthCard>
  );
}
