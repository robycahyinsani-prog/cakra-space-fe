// Helper untuk menyimpan & membaca data dari localStorage

const BOOKINGS_KEY = "cakra_bookings";

// Ambil semua booking dari localStorage
export function getBookings() {
  try {
    const data = localStorage.getItem(BOOKINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Gagal baca bookings:", err);
    return [];
  }
}

// Simpan semua booking ke localStorage
export function saveBookings(bookings) {
  try {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  } catch (err) {
    console.error("Gagal simpan bookings:", err);
  }
}

// Tambah booking baru
export function addBooking(booking) {
  const bookings = getBookings();
  bookings.push(booking);
  saveBookings(bookings);
  return booking;
}

// Hapus semua booking (untuk debug)
export function clearBookings() {
  localStorage.removeItem(BOOKINGS_KEY);
}