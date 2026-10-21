// dashboard member: ringkasan, QR akses dinamis, invoice
export default class MemberApi {
  constructor(client) {
    this.client = client;
  }

  summary() {
    return this.client.get("/me/summary");
  }

  accessQr() {
    return this.client.get("/me/access-qr");
  }

  invoices() {
    return this.client.get("/me/invoices");
  }

  invoicePdf(invoiceId) {
    return this.client.blob(`/me/invoices/${invoiceId}/pdf`);
  }

  plans(buildingId) {
    return this.client.get("/plans", buildingId ? { building_id: buildingId } : undefined);
  }

  subscription() {
    return this.client.get("/me/subscription");
  }

  subscribe(planId) {
    return this.client.post("/subscriptions", { plan_id: planId });
  }

  freeze(startDate, days) {
    return this.client.post("/subscriptions/freeze", { start_date: startDate, days });
  }

  unfreeze() {
    return this.client.post("/subscriptions/unfreeze");
  }

  // profil member & ganti email (K5-US-008.4)
  profile() {
    return this.client.get("/me");
  }

  updateProfile(data) {
    return this.client.patch("/me", data);
  }

  requestEmailChange(newEmail, password) {
    return this.client.post("/me/email", { new_email: newEmail, password });
  }
}
