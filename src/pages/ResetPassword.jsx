import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { api } from "../api";

// dibuka dari link email /reset-password?token=...
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [done, setDone] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return setErrors({ password: "Password minimal 8 karakter" });
    if (form.password !== form.confirm) return setErrors({ confirm: "Konfirmasi password tidak cocok" });
    setLoading(true);
    try {
      const res = await api.auth.resetPassword(token, form.password, form.confirm);
      setAlert({ type: "success", message: res.message });
      setDone(true);
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Atur Password Baru">
      <Alert type={alert.type} message={alert.message} />
      {done ? (
        <Link to="/login">
          <Button className="w-full">Login dengan Password Baru</Button>
        </Link>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
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
            label="Konfirmasi Password"
            name="confirm"
            type="password"
            value={form.confirm}
            onChange={handleChange}
            error={errors.confirm}
            required
          />
          <Button type="submit" loading={loading} className="w-full" disabled={!token}>
            Simpan Password
          </Button>
          {!token && <p className="text-sm text-red-600 mt-3">Token reset tidak ada di link.</p>}
        </form>
      )}
    </AuthCard>
  );
}
