import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";
import MailboxHint from "../components/auth/MailboxHint";
import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert({ type: "", message: "" });
    try {
      const res = await api.auth.forgotPassword(email);
      setAlert({ type: "success", message: res.message });
      setSent(true);
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Lupa Password" subtitle="Link reset berlaku 30 menit dan hanya bisa dipakai sekali">
      <Alert type={alert.type} message={alert.message} />
      {sent ? (
        <MailboxHint email={email} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            required
          />
          <Button type="submit" loading={loading} className="w-full" disabled={!email}>
            Kirim Link Reset
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-brown-700 mt-6">
        <Link to="/login" className="text-brown-500 hover:underline font-medium">
          Kembali ke login
        </Link>
      </p>
    </AuthCard>
  );
}
