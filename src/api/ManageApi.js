// panel pengelola: ringkasan operasional, kalender booking, refund
export default class ManageApi {
  constructor(client) {
    this.client = client;
  }

  summary() {
    return this.client.get("/manage/reports/summary");
  }

  bookings(buildingId, dateFrom, dateTo) {
    return this.client.get("/manage/bookings", {
      building_id: buildingId,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  refunds() {
    return this.client.get("/manage/refunds");
  }

  approveRefund(id) {
    return this.client.post(`/manage/refunds/${id}/approve`);
  }

  rejectRefund(id, note) {
    return this.client.post(`/manage/refunds/${id}/reject`, { note });
  }
}
