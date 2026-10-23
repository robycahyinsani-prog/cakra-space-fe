import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// role "member" untuk halaman penyewa, "staff" untuk panel pengelola, tanpa role cukup sudah login
export default function RequireAuth({ role, children }) {
  const { isAuthenticated, isStaff, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  // password sementara harus diganti dulu sebelum halaman lain bisa dibuka
  if (user?.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (role === "staff" && !isStaff) return <Navigate to="/dashboard" replace />;
  if (role === "member" && isStaff) return <Navigate to="/admin-dashboard" replace />;
  return children;
}
