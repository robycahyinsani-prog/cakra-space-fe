import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import Navbar from "../components/Navbar";
import Button from "../components/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />
      <div className="max-w-xl mx-auto p-8 text-center">
        <SearchX className="mx-auto text-brown-500 mb-4" size={40} />
        <h1 className="text-2xl font-bold text-brown-900 mb-2">Halaman tidak ditemukan</h1>
        <p className="text-brown-600 mb-6">Alamat yang Anda buka tidak ada atau sudah dipindahkan.</p>
        <Link to="/">
          <Button>Ke Beranda</Button>
        </Link>
      </div>
    </div>
  );
}
