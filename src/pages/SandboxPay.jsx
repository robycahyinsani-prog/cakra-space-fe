import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { api } from "../api";

// halaman tiruan payment gateway untuk e-wallet dan kartu kredit (payment_url dari backend)
export default function SandboxPay() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });

  const kirim = async (outcome) => {
    setBusy(true);
    try {
      await api.payments.simulate(ref, outcome);
      setAlert({
        type: outcome === "success" ? "success" : "error",
        message: outcome === "success" ? "Pembayaran berhasil." : "Pembayaran digagalkan.",
      });
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Payment Gateway Sandbox" subtitle={`Referensi ${ref}`}>
      <Alert type={alert.type} message={alert.message} />
      <p className="text-sm text-brown-700 mb-6">
        Halaman ini menggantikan halaman pembayaran e-wallet atau kartu kredit selama pengembangan.
      </p>
      {alert.message ? (
        <Button className="w-full" onClick={() => navigate(-1)}>
          Kembali
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => kirim("failed")}>
            Gagalkan
          </Button>
          <Button className="flex-1" loading={busy} onClick={() => kirim("success")}>
            Bayar
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
