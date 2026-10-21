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

  cancel(id, reason) {
    return this.client.post(`/bookings/${id}/cancel`, { reason: reason || null });
  }

  mine(tab, page = 1, size = 10) {
    return this.client.get("/me/bookings", { tab, page, size });
  }
}
