from datetime import timedelta

import pytest

from app.core.clock import clock
from app.db.json_store import JsonStore
from app.models.enums import Role
from app.models.location import Facility
from app.seed import PASSWORD, Seeder

def bulan_ini():
    hari = clock.local_today("Asia/Jakarta")
    return hari.replace(day=1).isoformat(), hari.isoformat()

def test_ringkasan_member(client, world, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    r = client.get("/api/v1/me/summary", headers=world.headers(member)).json()
    assert r["membership_status"] == "not_subscribed"
    assert r["upcoming_bookings"] == 1 and r["pending_payment_bookings"] == 1
    assert r["next_booking"]["code"] == b["code"] and r["unpaid_invoices"] == 0
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    assert client.get("/api/v1/me/summary", headers=world.headers(pengelola)).status_code == 403

def test_pengumuman_hanya_untuk_member_yang_punya_booking_di_gedung(client, world, dago, member):
    world.building("SDR")
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    r = client.post("/api/v1/manage/announcements", json={"building_id": dago.id, "title": "Perawatan AC",
                                                         "body": "Sabtu pagi AC lantai 2 diperbaiki"},
                    headers=world.headers(pengelola))
    assert r.status_code == 201
    lain = world.user("sinta@example.com")
    world.book(client, member, world.area(dago), world.open_day())
    assert [a["title"] for a in client.get("/api/v1/me/announcements", headers=world.headers(member)).json()] == [
        "Perawatan AC"]
    assert client.get("/api/v1/me/announcements", headers=world.headers(lain)).json() == []

def test_ringkasan_operasional_okupansi_dan_check_in(client, world, dago, member, admin):
    lain = world.building("SDR")
    area = world.area(dago)
    world.area(dago, "A2")
    hari = world.open_day()
    b = world.book(client, member, area, hari, 9, 12)
    world.pay(client, member, "booking", b["id"])
    r = client.get("/api/v1/manage/reports/summary", params={"date": hari.isoformat(), "building_id": dago.id},
                   headers=world.headers(admin)).json()
    baris = r["buildings"][0]
    # 2 area x 13 jam buka hari kerja = 26 jam, terisi 3 jam
    assert baris["bookings"] == 1 and baris["booked_hours"] == 3 and baris["available_hours"] == 26
    assert baris["occupancy_percent"] == pytest.approx(11.5, 0.1)
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[lain])
    assert client.get("/api/v1/manage/reports/summary", params={"building_id": dago.id},
                      headers=world.headers(pengelola)).status_code == 403
    semua = client.get("/api/v1/manage/reports/summary", headers=world.headers(pengelola)).json()
    assert [x["building_id"] for x in semua["buildings"]] == [lain.id]

def test_pendapatan_lunas_dikurangi_refund(client, world, dago, member, admin):
    area = world.area(dago)
    a = world.book(client, member, area, world.open_day(3), 9, 10)
    b = world.book(client, member, area, world.open_day(3), 13, 15)
    world.pay(client, member, "booking", a["id"])
    world.pay(client, member, "booking", b["id"])
    client.post(f"/api/v1/bookings/{b['id']}/cancel", json={}, headers=world.headers(member))
    refund = client.get("/api/v1/manage/refunds", headers=world.headers(admin)).json()[0]
    client.post(f"/api/v1/manage/refunds/{refund['id']}/approve", headers=world.headers(admin))
    awal, akhir = bulan_ini()
    r = client.get("/api/v1/manage/reports/revenue", params={"date_from": awal, "date_to": akhir},
                   headers=world.headers(admin)).json()
    baris = r["rows"][0]
    assert baris["gross"] == a["total"] + b["total"] and baris["refunds"] == b["total"]
    assert r["total_net"] == a["total"]

def test_laporan_member_baru_aktif_dan_berhenti(client, world, c, member, admin):
    plan = world.plan()
    sub = client.post("/api/v1/subscriptions", json={"plan_id": plan.id}, headers=world.headers(member)).json()
    world.pay(client, member, "subscription", sub["id"])
    awal, akhir = bulan_ini()
    r = client.get("/api/v1/manage/reports/members", params={"date_from": awal, "date_to": akhir},
                   headers=world.headers(admin)).json()
    assert r["rows"][0]["new"] == 1 and r["rows"][0]["active"] == 1 and r["rows"][0]["churned"] == 0
    clock.shift(timedelta(days=40))
    c.jobs.run_all()
    hari = clock.local_today("Asia/Jakarta")
    r = client.get("/api/v1/manage/reports/members",
                   params={"date_from": awal, "date_to": hari.isoformat()}, headers=world.headers(admin)).json()
    assert sum(x["churned"] for x in r["rows"]) == 1

def test_ekspor_laporan_di_latar_belakang(client, world, dago, member, admin):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    world.pay(client, member, "booking", b["id"])
    awal, akhir = bulan_ini()
    for fmt, awalan in (("xlsx", b"PK"), ("pdf", b"%PDF")):
        r = client.post("/api/v1/manage/reports/exports", json={"report": "revenue", "format": fmt,
                                                                "date_from": awal, "date_to": akhir},
                        headers=world.headers(admin))
        assert r.status_code == 202
        job = client.get(f"/api/v1/manage/reports/exports/{r.json()['id']}", headers=world.headers(admin)).json()
        assert job["status"] == "done"
        unduh = client.get(f"/api/v1/manage/reports/exports/{job['id']}/download", headers=world.headers(admin))
        assert unduh.content.startswith(awalan)
    lain = world.building("SDR")
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[lain])
    r = client.post("/api/v1/manage/reports/exports", json={"report": "bookings", "format": "xlsx", "date_from": awal,
                                                            "date_to": akhir, "building_id": dago.id},
                    headers=world.headers(pengelola))
    assert r.status_code == 403

def test_perangkat_heartbeat_offline_dan_notifikasi_pengelola(client, world, c, dago, admin):
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    dev = client.post("/api/v1/manage/devices", json={"building_id": dago.id, "name": "Kunci Pintu", "type": "door_lock",
                                                      "door": "Lantai 2"}, headers=world.headers(pengelola)).json()
    assert dev["api_key"].startswith("dev_") and "key_hash" not in dev
    client.post("/api/v1/device/heartbeat", headers={"X-Device-Key": dev["api_key"]})
    status = client.get("/api/v1/manage/devices", headers=world.headers(pengelola)).json()[0]
    assert status["status"] == "online" and "api_key" not in status
    clock.shift(timedelta(minutes=6))
    assert c.jobs.run_all()["offline_devices"] == 1
    assert c.jobs.run_all()["offline_devices"] == 0
    assert client.get("/api/v1/manage/devices", headers=world.headers(pengelola)).json()[0]["status"] == "offline"
    assert [n.kind for n in world.mailbox(pengelola.email)] == ["device_offline"]

def test_perintah_jarak_jauh_hanya_pengelola_lokasi_gedung_itu(client, world, dago, admin):
    lain = world.building("SDR")
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    pengelola_lain = world.user("lain@cakraspace.id", Role.LOCATION_MANAGER, buildings=[lain])
    dev = client.post("/api/v1/manage/devices", json={"building_id": dago.id, "name": "Kunci", "type": "door_lock",
                                                      "door": "Lantai 2"}, headers=world.headers(admin)).json()
    url = f"/api/v1/manage/devices/{dev['id']}/commands"
    assert client.post(url, json={"command": "unlock"}, headers=world.headers(pengelola_lain)).status_code == 403
    assert client.post(url, json={"command": "unlock"}, headers=world.headers(admin)).status_code == 403
    cmd = client.post(url, json={"command": "unlock"}, headers=world.headers(pengelola))
    assert cmd.status_code == 201
    antre = client.get("/api/v1/device/commands", headers={"X-Device-Key": dev["api_key"]}).json()
    assert [x["command"] for x in antre] == ["unlock"] and antre[0]["status"] == "delivered"
    client.post(f"/api/v1/device/commands/{cmd.json()['id']}/result", json={"success": True, "result": "terbuka"},
                headers={"X-Device-Key": dev["api_key"]})
    riwayat = client.get(url, headers=world.headers(pengelola)).json()
    assert riwayat[0]["status"] == "done" and riwayat[0]["requested_by_name"] == pengelola.name
    audit = client.get("/api/v1/manage/audit-logs", params={"entity": "device"}, headers=world.headers(admin)).json()
    assert audit[0]["detail"]["sender"] == pengelola.name

def test_riwayat_maintenance_perangkat(client, world, dago, admin):
    dev = client.post("/api/v1/manage/devices", json={"building_id": dago.id, "name": "QR", "type": "qr_reader",
                                                      "door": "Lobi"}, headers=world.headers(admin)).json()
    url = f"/api/v1/manage/devices/{dev['id']}/maintenances"
    hari = clock.local_today("Asia/Jakarta").isoformat()
    r = client.post(url, json={"date": hari, "issue": "Kamera buram", "action": "Lensa dibersihkan",
                               "technician": "Teknisi Vendor"}, headers=world.headers(admin))
    assert r.status_code == 201
    assert client.get(url, headers=world.headers(admin)).json()[0]["issue"] == "Kamera buram"

def test_json_store_crud_dan_rollback(tmp_path):
    store = JsonStore(tmp_path / "db.json")
    with store.write() as tx:
        f = tx.facilities.add(Facility(name="WiFi", scope="building"))
    with store.write() as tx:
        tx.facilities.update(f.id, name="WiFi 5G")
    with pytest.raises(RuntimeError), store.write() as tx:
        tx.facilities.update(f.id, name="Gagal")
        raise RuntimeError("batal")
    # instance lain membaca berkas yang sama dan melihat perubahan yang sudah tersimpan saja
    with JsonStore(tmp_path / "db.json").read() as tx:
        assert tx.facilities.require(f.id).name == "WiFi 5G"
    with store.write() as tx:
        tx.facilities.delete(f.id)
    with store.read() as tx:
        assert tx.facilities.all() == []

def test_seed_bisa_login_dan_berisi_ruangan_sewa(client, c):
    Seeder(c.store).run()
    for email in ("admin@cakraspace.id", "lokasi.dago@cakraspace.id", "budi@example.com"):
        assert client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
    gedung = client.get("/api/v1/buildings").json()
    assert {g["code"] for g in gedung} == {"SDR", "DGO", "MLB"}
    sudirman = next(g for g in gedung if g["code"] == "SDR")
    nama = {a["name"] for a in client.get(f"/api/v1/buildings/{sudirman['id']}/areas").json()}
    assert {"Hot Desk A1", "Meeting Room Merdeka", "Meeting Room Nusantara"} <= nama
