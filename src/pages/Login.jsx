import { useState } from "react";
import { Link } from "react-router-dom";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });

  // Update state saat user mengetik
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Hapus error di field itu saat user mulai mengetik ulang
    setErrors({ ...errors, [e.target.name]: "" });
  };

  // Validasi sebelum submit
  const validate = () => {
    const newErrors = {};
    if (!form.email) newErrors.email = "Email wajib diisi";
    if (!form.password) newErrors.password = "Password wajib diisi";
    return newErrors;
  };

  // Handle submit form
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
      // SEMENTARA: simulasi login (nanti diganti API asli)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Simulasi: kalau email = test@mail.com dan password = 12345678, sukses
      if (form.email === "test@mail.com" && form.password === "12345678") {
        setAlert({ 
          type: "success", 
          message: "Login berhasil! (nanti redirect ke dashboard)" 
        });
      } else {
        throw new Error("Email atau password salah");
      }
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Cakra Space
        </h1>
        <p className="text-center text-gray-500 mb-6">
          Masuk ke akun Anda
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

          <Button 
            type="submit" 
            variant="primary" 
            loading={loading}
            className="w-full"
          >
            Login
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Belum punya akun?{" "}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}