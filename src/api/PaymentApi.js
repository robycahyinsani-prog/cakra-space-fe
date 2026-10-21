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

  paySubscription(subscriptionId, method) {
    return this.client.post("/payments", {
      purpose: "subscription",
      reference_id: subscriptionId,
      method,
    });
  }

  renewSubscription(method) {
    return this.client.post("/payments", {
      purpose: "subscription_renewal",
      method,
    });
  }

  changePlan(planId, method) {
    return this.client.post("/payments", {
      purpose: "subscription_change",
      plan_id: planId,
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
