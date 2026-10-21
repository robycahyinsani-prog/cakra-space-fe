import { Link } from "react-router-dom";

// kartu di tengah layar untuk halaman verifikasi dan reset password
export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-cream-200">
        <Link to="/" className="block text-center text-sm font-bold text-brown-500 mb-4">
          Cakra Space
        </Link>
        <h1 className="text-2xl font-bold text-center text-brown-900 mb-2">{title}</h1>
        {subtitle && <p className="text-center text-brown-600 mb-6">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
