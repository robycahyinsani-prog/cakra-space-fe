import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { mockBuildings, mockRooms } from "../utils/mockData";

export default function BuildingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Cari gedung berdasarkan id dari URL
  const building = mockBuildings.find((b) => b.id === Number(id));

  // Kalau gedung tidak ditemukan
  if (!building) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Gedung tidak ditemukan
          </h1>
          <Button onClick={() => navigate("/buildings")}>
            Kembali ke Daftar Gedung
          </Button>
        </div>
      </div>
    );
  }

  // Filter ruang yang ada di gedung ini
  const rooms = mockRooms.filter((r) => r.buildingId === building.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Tombol Kembali */}
        <Link
          to="/buildings"
          className="text-blue-600 hover:underline text-sm mb-4 inline-block"
        >
          ← Kembali ke Daftar Gedung
        </Link>

        {/* Header Gedung */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <img
            src={building.image}
            alt={building.name}
            className="w-full h-48 object-cover"
          />
          <div className="p-6">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-800">
                {building.name}
              </h1>
              <span
                className={`text-xs px-3 py-1 rounded-full ${
                  building.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {building.status === "active" ? "Aktif" : "Draf"}
              </span>
            </div>
            <p className="text-gray-500">{building.city}</p>
            <p className="text-gray-400 text-sm mt-1">{building.address}</p>
          </div>
        </div>

        {/* Daftar Ruang */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Ruang Tersedia ({rooms.length})
        </h2>

        {rooms.length === 0 ? (
          <p className="text-gray-500">Belum ada ruang di gedung ini.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col"
              >
                {/* Tipe ruang badge */}
                <span
                  className={`text-xs px-2 py-1 rounded-full self-start mb-3 ${
                    room.type === "hot_desk"
                      ? "bg-blue-100 text-blue-700"
                      : room.type === "dedicated_desk"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {room.type === "hot_desk"
                    ? "Hot Desk"
                    : room.type === "dedicated_desk"
                    ? "Dedicated Desk"
                    : "Ruang Rapat"}
                </span>

                <h3 className="font-semibold text-gray-800 mb-2">
                  {room.name}
                </h3>

                <p className="text-sm text-gray-500 mb-1">
                  Kapasitas: {room.capacity} orang
                </p>

                <p className="text-sm text-gray-500 mb-3">
                  {room.facilities.join(" • ")}
                </p>

                <div className="mt-auto">
                  <p className="text-lg font-bold text-blue-600 mb-3">
                    Rp {room.price_per_hour.toLocaleString("id-ID")}
                    <span className="text-sm font-normal text-gray-500">
                      /jam
                    </span>
                  </p>

                  <Link to={`/booking/${room.id}`}>
                    <Button variant="primary" className="w-full">
                      Booking Sekarang
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}