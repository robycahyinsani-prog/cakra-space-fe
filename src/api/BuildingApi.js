// gedung, area dan grid slot per jam
export default class BuildingApi {
  constructor(client) {
    this.client = client;
  }

  list() {
    return this.client.get("/buildings");
  }

  detail(id) {
    return this.client.get(`/buildings/${id}`);
  }

  areas(buildingId) {
    return this.client.get(`/buildings/${buildingId}/areas`);
  }

  area(id) {
    return this.client.get(`/areas/${id}`);
  }

  slots(buildingId, date, type) {
    return this.client.get(`/buildings/${buildingId}/slots`, { date, type });
  }

  create(data) {
    return this.client.post("/buildings", data);
  }

  update(id, data) {
    return this.client.patch(`/buildings/${id}`, data);
  }

  setStatus(id, status) {
    return this.client.put(`/buildings/${id}/status`, { status });
  }

  remove(id) {
    return this.client.delete(`/buildings/${id}`);
  }

  setHours(id, hours) {
    return this.client.put(`/buildings/${id}/operating-hours`, { hours });
  }

  addHoliday(id, date, description) {
    return this.client.post(`/buildings/${id}/holidays`, { date, description });
  }

  deleteHoliday(holidayId) {
    return this.client.delete(`/holidays/${holidayId}`);
  }

  setRefundPolicy(id, policy) {
    return this.client.put(`/buildings/${id}/refund-policy`, policy);
  }

  addFloor(buildingId, name, level) {
    return this.client.post(`/buildings/${buildingId}/floors`, { name, level });
  }

  deleteFloor(floorId) {
    return this.client.delete(`/floors/${floorId}`);
  }

  uploadFloorPlan(floorId, file) {
    return this.client.upload(`/floors/${floorId}/plan`, file);
  }

  facilities(scope, buildingId) {
    return this.client.get("/facilities", { scope, building_id: buildingId });
  }

  createFacility(name, scope, buildingId = null) {
    return this.client.post("/facilities", { name, scope, building_id: buildingId });
  }

  setBuildingFacilities(buildingId, facilityIds) {
    return this.client.put(`/buildings/${buildingId}/facilities`, { facility_ids: facilityIds });
  }

  createArea(data) {
    return this.client.post("/areas", data);
  }

  updateArea(id, data) {
    return this.client.patch(`/areas/${id}`, data);
  }

  deleteArea(id) {
    return this.client.delete(`/areas/${id}`);
  }

  setAreaStatus(id, status, reason = null) {
    return this.client.put(`/areas/${id}/status`, { status, reason });
  }

  setAreaFacilities(id, facilityIds) {
    return this.client.put(`/areas/${id}/facilities`, { facility_ids: facilityIds });
  }

  // denah lantai dan titik koordinat area (K5-US-003.4)
  floorMap(floorId) {
    return this.client.get(`/floors/${floorId}/map`);
  }

  floorPlanUrl(floorId) {
    return `${this.client.baseUrl}/floors/${floorId}/plan`;
  }

  setAreaPosition(areaId, posX, posY) {
    return this.client.put(`/areas/${areaId}/position`, { pos_x: posX, pos_y: posY });
  }
}
