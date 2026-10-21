// lencana status booking, pembayaran, invoice, refund dan gedung
const STATUS = {
  pending_payment: ["Menunggu Bayar", "bg-yellow-100 text-yellow-800"],
  confirmed: ["Terkonfirmasi", "bg-green-100 text-green-800"],
  cancelled: ["Dibatalkan", "bg-red-100 text-red-700"],
  expired: ["Kedaluwarsa", "bg-gray-200 text-gray-700"],
  pending: ["Menunggu", "bg-yellow-100 text-yellow-800"],
  success: ["Berhasil", "bg-green-100 text-green-800"],
  failed: ["Gagal", "bg-red-100 text-red-700"],
  refunded: ["Dikembalikan", "bg-blue-100 text-blue-800"],
  unpaid: ["Belum Dibayar", "bg-yellow-100 text-yellow-800"],
  paid: ["Lunas", "bg-green-100 text-green-800"],
  void: ["Batal", "bg-gray-200 text-gray-700"],
  requested: ["Diajukan", "bg-yellow-100 text-yellow-800"],
  processed: ["Diproses", "bg-green-100 text-green-800"],
  rejected: ["Ditolak", "bg-red-100 text-red-700"],
  active: ["Aktif", "bg-green-100 text-green-800"],
  draft: ["Draf", "bg-yellow-100 text-yellow-800"],
  inactive: ["Nonaktif", "bg-gray-200 text-gray-700"],
  frozen: ["Dibekukan", "bg-blue-100 text-blue-800"],
};

export default function StatusBadge({ status, className = "" }) {
  const [label, warna] = STATUS[status] || [status, "bg-gray-200 text-gray-700"];
  return (
    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${warna} ${className}`}>
      {label}
    </span>
  );
}
