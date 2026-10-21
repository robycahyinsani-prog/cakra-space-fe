// pembayaran lewat payment gateway (sandbox saat pengembangan)
export default class PaymentApi {
  constructor(client) {
    this.client = client;
  }

  payBooking(bookingId, method) {
    return this.client.post("/payments", {
      purpose: "booking",
      reference_id: bookingId,
      method,
    });
  }

  get(id) {
    return this.client.get(`/payments/${id}`);
  }

  // hanya ada di APP_ENV development, meniru notifikasi dari gateway
  simulate(gatewayRef, outcome = "success") {
    return this.client.post(`/sandbox/payments/${gatewayRef}/${outcome}`);
  }
}
