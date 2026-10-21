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
}
