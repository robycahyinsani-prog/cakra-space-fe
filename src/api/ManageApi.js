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

  bookingsToday(buildingId) {
    return this.client.get("/manage/bookings/today", { building_id: buildingId });
  }

  // resepsionis memindai atau mengetik token QR member/tamu (BE-30, BE-31)
  validateAccess(token, buildingId) {
    return this.client.post("/access/validate", { token, building_id: buildingId });
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

  // paket membership (BE-34)
  plans() {
    return this.client.get("/manage/plans");
  }

  createPlan(data) {
    return this.client.post("/manage/plans", data);
  }

  updatePlan(id, data) {
    return this.client.patch(`/manage/plans/${id}`, data);
  }

  removePlan(id) {
    return this.client.delete(`/manage/plans/${id}`);
  }

  // voucher (BE-29)
  vouchers() {
    return this.client.get("/manage/vouchers");
  }

  createVoucher(data) {
    return this.client.post("/manage/vouchers", data);
  }

  updateVoucher(id, data) {
    return this.client.patch(`/manage/vouchers/${id}`, data);
  }

  deleteVoucher(id) {
    return this.client.delete(`/manage/vouchers/${id}`);
  }

  // log akses (BE-32)
  accessLogs(filters = {}) {
    return this.client.get("/manage/access-logs", cleanParams(filters));
  }

  exportAccessLogs(filters = {}) {
    return this.client.blob("/manage/access-logs/export", cleanParams(filters));
  }

  // perangkat pintu (BE-48..51)
  devices(buildingId) {
    return this.client.get("/manage/devices", buildingId ? { building_id: buildingId } : undefined);
  }

  registerDevice(data) {
    return this.client.post("/manage/devices", data);
  }

  revokeDevice(id) {
    return this.client.post(`/manage/devices/${id}/revoke`);
  }

  sendCommand(id, command) {
    return this.client.post(`/manage/devices/${id}/commands`, { command });
  }

  deviceCommands(id) {
    return this.client.get(`/manage/devices/${id}/commands`);
  }

  deviceMaintenances(id) {
    return this.client.get(`/manage/devices/${id}/maintenances`);
  }

  addMaintenance(id, data) {
    return this.client.post(`/manage/devices/${id}/maintenances`, data);
  }

  // laporan pendapatan, member/churn, dan ekspor (K5-US-009.2..009.4)
  revenueReport(filters = {}) {
    return this.client.get("/manage/reports/revenue", cleanParams(filters));
  }

  membersReport(filters = {}) {
    return this.client.get("/manage/reports/members", cleanParams(filters));
  }

  createExport(data) {
    return this.client.post("/manage/reports/exports", cleanParams(data));
  }

  exportStatus(exportId) {
    return this.client.get(`/manage/reports/exports/${exportId}`);
  }

  downloadExport(exportId) {
    return this.client.blob(`/manage/reports/exports/${exportId}/download`);
  }

  // pengaturan pajak, deposit, dan tunggakan (K5-US-005.5, K5-US-005.6)
  settings() {
    return this.client.get("/manage/settings");
  }

  setTaxRate(percent) {
    return this.client.put("/manage/settings/tax", { tax_rate_percent: Number(percent) });
  }

  deposits(filters = {}) {
    return this.client.get("/manage/deposits", cleanParams(filters));
  }

  addDeposit(data) {
    return this.client.post("/manage/deposits", data);
  }

  returnDeposit(id) {
    return this.client.post(`/manage/deposits/${id}/return`);
  }

  arrears(filters = {}) {
    return this.client.get("/manage/arrears", cleanParams(filters));
  }

  addArrear(data) {
    return this.client.post("/manage/arrears", data);
  }

  settleArrear(id) {
    return this.client.post(`/manage/arrears/${id}/settle`);
  }

  // pengumuman gedung (K5-US-008.4)
  announcements(buildingId) {
    return this.client.get("/manage/announcements", buildingId ? { building_id: buildingId } : undefined);
  }

  createAnnouncement(buildingId, title, body) {
    return this.client.post("/manage/announcements", { building_id: buildingId, title, body });
  }

  deleteAnnouncement(id) {
    return this.client.delete(`/manage/announcements/${id}`);
  }

  // pengelolaan staf & peran (K5-US-006.4)
  staff(role) {
    return this.client.get("/staff", role ? { role } : undefined);
  }

  createStaff(data) {
    return this.client.post("/staff", data);
  }

  updateStaff(id, data) {
    return this.client.patch(`/staff/${id}`, data);
  }

  resetStaffPassword(id) {
    return this.client.post(`/staff/${id}/reset-password`);
  }

  roles() {
    return this.client.get("/roles");
  }

  members(q) {
    return this.client.get("/members", q ? { q } : undefined);
  }
}

function cleanParams(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v !== null && v !== undefined));
}
