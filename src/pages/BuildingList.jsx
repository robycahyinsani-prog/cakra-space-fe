import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { mockBuildings } from "../utils/mockData";

export default function BuildingList() {
  const [search, setSearch] = useState("");

  // Filter gedung berdasarkan pencarian nama/kota
  const filteredBuildings = mockBuildings.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brown-900">
            Daftar Gedung Cakra Space
          </h1>
          <p className="text-brown-600 mt-1">
            Pilih lokasi coworking space yang ingin Anda kunjungi
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Cari gedung atau kota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-tan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tan-300"
          />
        </div>

        {/* Grid Gedung */}
        {filteredBuildings.length === 0 ? (
          <p className="text-brown-600">Tidak ada gedung yang cocok.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBuildings.map((building) => (
              <Link
                key={building.id}
                to={`/buildings/${building.id}`}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-cream-200"
              >
                {/* Gambar */}
                <img
                  src={building.image}
                  alt={building.name}
                  className="w-full h-40 object-cover"
                />

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-brown-900">
                      {building.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        building.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {building.status === "active" ? "Aktif" : "Draf"}
                    </span>
                  </div>
                  <p className="text-sm text-brown-600">
                    {building.city}
                  </p>
                  <p className="text-sm text-brown-500 mt-1">
                    {building.address}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}