from app.models.enums import AreaType, BuildingStatus, Role

def test_gedung_baru_draf_tidak_tampil_ke_member_sampai_diaktifkan(client, world, admin, member):
    body = {"code": "sdr", "name": "Cakra Space Sudirman", "address": "Jl. Jend. Sudirman No. 1", "city": "Jakarta"}
    r = client.post("/api/v1/buildings", json=body, headers=world.headers(admin))
    assert r.status_code == 201
    gedung = r.json()
    assert gedung["status"] == "draft" and gedung["code"] == "SDR"
    assert client.get("/api/v1/buildings", headers=world.headers(member)).json() == []
    assert client.get(f"/api/v1/buildings/{gedung['id']}", headers=world.headers(member)).status_code == 404
    client.put(f"/api/v1/buildings/{gedung['id']}/status", json={"status": "active"}, headers=world.headers(admin))
    daftar = client.get("/api/v1/buildings").json()
    assert [b["code"] for b in daftar] == ["SDR"]
    detail = client.get(f"/api/v1/buildings/{gedung['id']}").json()
    assert len(detail["operating_hours"]) == 7

def test_kode_gedung_unik(client, world, admin, dago):
    body = {"code": "DGO", "name": "Gedung Lain", "address": "Jl. Lain No. 9", "city": "Bandung"}
    assert client.post("/api/v1/buildings", json=body, headers=world.headers(admin)).status_code == 409

def test_pengelola_lokasi_hanya_mengubah_gedung_yang_dipegang(client, world, dago):
    lain = world.building("SDR")
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    h = world.headers(pengelola)
    body = {"code": "MLB", "name": "Gedung Baru", "address": "Jl. Baru No. 1", "city": "Yogyakarta"}
    assert client.post("/api/v1/buildings", json=body, headers=h).status_code == 403
    assert client.patch(f"/api/v1/buildings/{dago.id}", json={"contact_phone": "022-111"}, headers=h).status_code == 200
    assert client.patch(f"/api/v1/buildings/{lain.id}", json={"contact_phone": "022-111"}, headers=h).status_code == 403

def test_jam_operasional_dan_hari_libur_per_gedung(client, world, admin, dago):
    lain = world.building("SDR")
    h = world.headers(admin)
    jam = [{"weekday": d, "open_time": "07:00", "close_time": "22:00", "is_closed": False} for d in range(7)]
    r = client.put(f"/api/v1/buildings/{dago.id}/operating-hours", json={"hours": jam}, headers=h)
    assert r.status_code == 200 and r.json()[6]["is_closed"] is False
    hari = world.open_day(3)
    client.post(f"/api/v1/buildings/{dago.id}/holidays", json={"date": hari.isoformat(), "description": "Libur"},
                headers=h)
    tutup = client.get(f"/api/v1/buildings/{dago.id}/availability", params={"date": hari.isoformat()}).json()
    buka = client.get(f"/api/v1/buildings/{lain.id}/availability", params={"date": hari.isoformat()}).json()
    # hari libur satu lokasi tidak memengaruhi gedung lain
    assert tutup["is_open"] is False and buka["is_open"] is True

def test_jam_tutup_harus_setelah_jam_buka(client, world, admin, dago):
    jam = [{"weekday": d, "open_time": "10:00", "close_time": "09:00", "is_closed": False} for d in range(7)]
    r = client.put(f"/api/v1/buildings/{dago.id}/operating-hours", json={"hours": jam}, headers=world.headers(admin))
    assert r.status_code == 422

def test_lantai_fasilitas_dan_denah(client, world, admin, dago):
    h = world.headers(admin)
    lantai = client.post(f"/api/v1/buildings/{dago.id}/floors", json={"name": "Lantai 2", "level": 2}, headers=h).json()
    wifi = client.post("/api/v1/facilities", json={"name": "WiFi", "scope": "building"}, headers=h).json()
    loker = client.post("/api/v1/facilities", json={"name": "Loker Khusus", "scope": "building",
                                                    "building_id": dago.id}, headers=h).json()
    r = client.put(f"/api/v1/buildings/{dago.id}/facilities", json={"facility_ids": [wifi["id"], loker["id"]]},
                   headers=h)
    assert r.status_code == 200
    assert {f["name"] for f in client.get(f"/api/v1/buildings/{dago.id}").json()["facilities"]} == {"WiFi", "Loker Khusus"}
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 20
    r = client.put(f"/api/v1/floors/{lantai['id']}/plan", files={"file": ("denah.png", png, "image/png")}, headers=h)
    assert r.status_code == 200 and r.json()["plan_file"]
    assert client.get(f"/api/v1/floors/{lantai['id']}/plan").content == png
    salah = client.put(f"/api/v1/floors/{lantai['id']}/plan", files={"file": ("a.txt", b"x", "text/plain")}, headers=h)
    assert salah.status_code == 422

def test_hapus_gedung_ditolak_kalau_masih_ada_booking(client, world, admin, dago, member):
    area = world.area(dago)
    world.book(client, member, area, world.open_day())
    r = client.delete(f"/api/v1/buildings/{dago.id}", headers=world.headers(admin))
    assert r.status_code == 409
    kosong = world.building("KSG", status=BuildingStatus.DRAFT)
    assert client.delete(f"/api/v1/buildings/{kosong.id}", headers=world.headers(admin)).status_code == 204

def test_area_kode_unik_kapasitas_rapat_wajib_dan_meja_selalu_satu(client, world, admin, dago):
    h = world.headers(admin)
    lantai = world.floor(dago)
    dasar = {"building_id": dago.id, "floor_id": lantai.id, "price_per_hour": 20000, "price_per_day": 120000}
    meja = client.post("/api/v1/areas", json={**dasar, "code": "a1", "name": "Hot Desk A1", "type": "hot_desk",
                                              "capacity": 5}, headers=h)
    assert meja.status_code == 201 and meja.json()["capacity"] == 1 and meja.json()["code"] == "A1"
    ganda = client.post("/api/v1/areas", json={**dasar, "code": "A1", "name": "Ganda", "type": "hot_desk"}, headers=h)
    assert ganda.status_code == 409
    rapat = client.post("/api/v1/areas", json={**dasar, "code": "M1", "name": "Rapat", "type": "meeting_room"},
                        headers=h)
    assert rapat.status_code == 422

def test_status_perawatan_menyembunyikan_area_menandai_booking_dan_tercatat_audit(client, world, admin, dago, member):
    area = world.area(dago)
    booking = world.book(client, member, area, world.open_day())
    r = client.put(f"/api/v1/areas/{area.id}/status", json={"status": "maintenance", "reason": "AC rusak"},
                   headers=world.headers(admin))
    assert r.status_code == 200 and r.json()["affected_bookings"] == [booking["code"]]
    assert client.get(f"/api/v1/buildings/{dago.id}/areas").json() == []
    assert len(client.get(f"/api/v1/buildings/{dago.id}/areas", headers=world.headers(admin)).json()) == 1
    detail = client.get(f"/api/v1/bookings/{booking['id']}", headers=world.headers(member)).json()
    assert detail["needs_relocation"] is True
    log = client.get("/api/v1/manage/audit-logs", params={"entity": "area"}, headers=world.headers(admin)).json()
    assert log[0]["action"] == "area.status" and log[0]["detail"]["reason"] == "AC rusak"

def test_denah_menampilkan_status_titik_area(client, world, dago, member):
    tersedia = world.area(dago, "A1")
    world.area(dago, "M1", AreaType.MEETING_ROOM, capacity=6)
    lantai = world.floor(dago)
    r = client.get(f"/api/v1/floors/{lantai.id}/map").json()
    assert {a["code"]: a["status"] for a in r["areas"]} == {"A1": "available", "M1": "available"}
    hari = world.open_day()
    world.book(client, member, tersedia, hari, 9, 11)
    saat = f"{hari.isoformat()}T10:00:00+07:00"
    r = client.get(f"/api/v1/floors/{lantai.id}/map", params={"at": saat}).json()
    assert {a["code"]: a["status"] for a in r["areas"]}["A1"] == "occupied"
