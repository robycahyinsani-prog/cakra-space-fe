import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import AuthCard from "../components/auth/AuthCard";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

// dibuka dari link email /verify-email?token=...
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { isAuthenticated, refreshUser } = useAuth();
  const [hasil, setHasil] = useState(token ? { status: "loading" } : { status: "error", message: "Token verifikasi tidak ada di link." });

  // token sekali pakai, jadi permintaan kedua dari StrictMode tidak boleh menimpa hasil pertama
  const sudahDikirim = useRef(null);

  useEffect(() => {
    if (!token || sudahDikirim.current === token) return;
    sudahDikirim.current = token;
    api.auth.verifyEmail(token).then(
      () => {
        setHasil({ status: "ok" });
        if (isAuthenticated) refreshUser().catch(() => {});
      },
      (err) => setHasil({ status: "error", message: err.message })
    );
    // verifikasi cukup sekali per token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthCard title="Verifikasi Email">
      {hasil.status === "loading" && (
        <p className="flex items-center justify-center gap-2 text-brown-600">
          <LoaderCircle className="animate-spin" size={18} /> Memverifikasi...
        </p>
      )}
      {hasil.status === "ok" && (
        <div className="text-center">
          <CircleCheck className="mx-auto text-green-600 mb-3" size={40} />
          <p className="text-brown-700 mb-6">Email Anda sudah terverifikasi. Sekarang Anda bisa membuat booking.</p>
          <Link to={isAuthenticated ? "/buildings" : "/login"}>
            <Button className="w-full">{isAuthenticated ? "Cari Ruang" : "Login"}</Button>
          </Link>
        </div>
      )}
      {hasil.status === "error" && (
        <div className="text-center">
          <CircleX className="mx-auto text-red-600 mb-3" size={40} />
          <p className="text-brown-700 mb-6">{hasil.message}</p>
          <p className="text-sm text-brown-600">
            Link yang kedaluwarsa bisa diminta ulang dari dashboard setelah login.
          </p>
        </div>
      )}
    </AuthCard>
  );
}
