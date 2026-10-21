// booking member: hitung harga, buat, lihat, batal
export default class BookingApi {
  constructor(client) {
    this.client = client;
  }

  quote(request) {
    return this.client.post("/bookings/quote", request);
  }

  create(request) {
    return this.client.post("/bookings", request);
  }

  get(id) {
    return this.client.get(`/bookings/${id}`);
  }

  // jadwal baru harus di ruang yang sama dengan durasi sama
  reschedule(id, { date, start_time, end_time }) {
    return this.client.post(`/bookings/${id}/reschedule`, { date, start_time, end_time });
  }

  cancel(id, reason) {
    return this.client.post(`/bookings/${id}/cancel`, { reason: reason || null });
  }

  mine(tab, page = 1, size = 10) {
    return this.client.get("/me/bookings", { tab, page, size });
  }

  // undangan tamu rapat dengan QR sekali pakai (K5-US-006.2)
  guests(bookingId) {
    return this.client.get(`/bookings/${bookingId}/guests`);
  }

  inviteGuests(bookingId, guests) {
    return this.client.post(`/bookings/${bookingId}/guests`, { guests });
  }
}
