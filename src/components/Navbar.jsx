import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Building2, CalendarCheck, Menu, X, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";

export default function Navbar() {
  const { isAuthenticated, isStaff, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // pindah ke beranda dulu supaya penjaga halaman tidak mengarahkan ke login
  const handleLogout = async () => {
    navigate("/");
    await logout();
  };

  const isActive = (path) => location.pathname === path;

  // staf (pengelola pusat, pengelola lokasi, resepsionis) memakai panel pengelola
  const navLinks = isStaff
    ? [
        { to: "/admin-dashboard", label: "Dashboard Pengelola", icon: LayoutDashboard },
        { to: "/buildings", label: "Gedung", icon: Building2 },
      ]
    : [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/buildings", label: "Gedung", icon: Building2 },
        { to: "/my-bookings", label: "Booking Saya", icon: CalendarCheck },
      ];

  return (
    <nav className="bg-white shadow-sm border-b border-cream-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-brown-500">
          Cakra Space
        </Link>

        {/* Desktop Menu */}
        {isAuthenticated && (
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? "text-brown-500"
                      : "text-brown-700 hover:text-brown-500"
                  }`}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Right Side */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-brown-700">
                Halo, <strong className="text-brown-900">{user?.name}</strong>
              </span>
              <Link
                to="/change-password"
                title="Ganti password"
                aria-label="Ganti password"
                className="text-brown-700 hover:text-brown-500 transition-colors"
              >
                <KeyRound size={16} />
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-brown-700 hover:text-red-600 transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="secondary">Login</Button>
              </Link>
              <Link to="/register">
                <Button variant="primary">Daftar</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-brown-700"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-cream-200 bg-white px-4 py-3 space-y-2">
          {isAuthenticated ? (
            <>
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 py-2 text-sm font-medium ${
                      isActive(link.to) ? "text-brown-500" : "text-brown-700"
                    }`}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
              <div className="border-t border-cream-200 pt-2 flex items-center justify-between">
                <span className="text-sm text-brown-700">
                  Halo, <strong>{user?.name}</strong>
                </span>
                <Link
                  to="/change-password"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-1.5 text-sm text-brown-700"
                >
                  <KeyRound size={16} />
                  Password
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm text-red-600"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Login
                </Button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button variant="primary" className="w-full">
                  Daftar
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}