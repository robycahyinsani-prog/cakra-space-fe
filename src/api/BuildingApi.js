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
}
