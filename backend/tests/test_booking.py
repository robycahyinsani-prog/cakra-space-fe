import threading
from datetime import time, timedelta

from fastapi.testclient import TestClient

from app.core.clock import clock
from app.models.billing import Arrear
from app.models.enums import AreaType, Role


def test_cari_area_kosong_dan_grid_slot_per_jam(client, world, dago, member):
    a1 = world.area(dago, "A1")
    world.area(dago, "A2")
    world.area(dago, "M1", AreaType.MEETING_ROOM, capacity=6, price_per_hour=120_000, price_per_day=700_000)
    hari = world.open_day()
    world.book(client, member, a1, hari, 9, 11)
    r = client.get(
        f"/api/v1/buildings/{dago.id}/availability",
        params={"date": hari.isoformat(), "start_time": "10:00", "end_time": "12:00"},
    ).json()
    assert {a["code"] for a in r["areas"]} == {"A2", "M1"}
    rapat = client.get(
        f"/api/v1/buildings/{dago.id}/availability",
        params={"date": hari.isoformat(), "type": "meeting_room", "min_capacity": 5},
    ).json()
    assert [a["code"] for a in rapat["areas"]] == ["M1"]
    grid = client.get(f"/api/v1/buildings/{dago.id}/slots", params={"date": hari.isoformat(), "area_id": a1.id}).json()
    slot = {s["start_time"]: s["status"] for s in grid["areas"][0]["slots"]}
    assert slot["09:00"] == slot["10:00"] == "booked" and slot["11:00"] == "available"
    assert grid["areas"][0]["slots"][0]["price"] == 20_000


def test_booking_ditahan_15_menit_dengan_ringkasan_harga_dan_pajak(client, world, dago, member):
    area = world.area(dago)
    hari = world.open_day()
    quote = client.post(
        "/api/v1/bookings/quote", json=world.booking_body(area, hari, 9, 12), headers=world.headers(member)
    ).json()
    assert quote["subtotal"] == 60_000 and quote["tax"] == 6_600 and quote["total"] == 66_600
    b = world.book(client, member, area, hari, 9, 12)
    assert b["status"] == "pending_payment" and b["can_pay"] is True
    clock.shift(timedelta(minutes=16))
    detail = client.get(f"/api/v1/bookings/{b['id']}", headers=world.headers(member)).json()
    assert detail["status"] == "expired"
    # slot kembali bisa dipesan setelah hold lewat
    lain = world.user("sinta@example.com")
    world.book(client, lain, area, hari, 9, 12)


def test_tarif_harian_menjadi_batas_atas(client, world, dago, member):
    area = world.area(dago, price_per_hour=20_000, price_per_day=120_000)
    q = client.post(
        "/api/v1/bookings/quote", json=world.booking_body(area, world.open_day(), 9, 19), headers=world.headers(member)
    ).json()
    assert q["subtotal"] == 120_000


def test_member_belum_verifikasi_dan_member_menunggak_tidak_bisa_booking(client, world, c, dago):
    area = world.area(dago)
    belum = world.user("raka@example.com", verified=False)
    r = client.post("/api/v1/bookings", json=world.booking_body(area, world.open_day()), headers=world.headers(belum))
    assert r.status_code == 403 and r.json()["code"] == "email_not_verified"
    nunggak = world.user("dewi@example.com")
    with c.store.write() as tx:
        tx.arrears.add(
            Arrear(
                user_id=nunggak.id,
                building_id=dago.id,
                description="Sewa",
                amount=1000,
                due_date=clock.local_today("Asia/Jakarta") - timedelta(days=1),
            )
        )
    r = client.post("/api/v1/bookings", json=world.booking_body(area, world.open_day()), headers=world.headers(nunggak))
    assert r.status_code == 403 and r.json()["code"] == "has_arrears"


def test_booking_bentrok_ditolak_dengan_saran_area_lain(client, world, dago, member):
    a1 = world.area(dago, "A1")
    world.area(dago, "A2")
    hari = world.open_day()
    world.book(client, member, a1, hari, 9, 11)
    lain = world.user("sinta@example.com")
    r = client.post("/api/v1/bookings", json=world.booking_body(a1, hari, 10, 12), headers=world.headers(lain))
    assert r.status_code == 409
    assert r.json()["code"] == "slot_taken" and [s["code"] for s in r.json()["suggestions"]] == ["A2"]


def test_dua_pesanan_bersamaan_hanya_satu_yang_berhasil(app, world, dago):
    area = world.area(dago)
    hari = world.open_day()
    users = [world.user(f"m{i}@example.com") for i in range(6)]
    hasil = []

    def pesan(u):
        with TestClient(app) as cl:
            hasil.append(
                cl.post(
                    "/api/v1/bookings", json=world.booking_body(area, hari, 13, 15), headers=world.headers(u)
                ).status_code
            )

    threads = [threading.Thread(target=pesan, args=(u,)) for u in users]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(hasil) == [201] + [409] * 5


def test_validasi_jam_operasional_masa_lalu_dan_kelipatan_30_menit(client, world, dago, member):
    area = world.area(dago)
    hari = world.open_day()
    h = world.headers(member)
    assert client.post("/api/v1/bookings", json=world.booking_body(area, hari, 6, 9), headers=h).status_code == 422
    kemarin = clock.local_today("Asia/Jakarta") - timedelta(days=1)
    assert client.post("/api/v1/bookings", json=world.booking_body(area, kemarin, 9, 10), headers=h).status_code == 422
    body = {**world.booking_body(area, hari), "start_time": "09:15:00"}
    assert client.post("/api/v1/bookings", json=body, headers=h).status_code == 422
    minggu = hari + timedelta(days=(6 - hari.weekday()) % 7)
    assert client.post("/api/v1/bookings", json=world.booking_body(area, minggu), headers=h).status_code == 422


def test_batal_sebelum_batas_waktu_membuat_refund_dan_setelahnya_ditolak(client, world, dago, member):
    area = world.area(dago)
    hari = world.open_day(3)
    b = world.book(client, member, area, hari)
    world.pay(client, member, "booking", b["id"])
    r = client.post(
        f"/api/v1/bookings/{b['id']}/cancel", json={"reason": "Rencana berubah"}, headers=world.headers(member)
    )
    assert r.status_code == 200
    data = r.json()
    assert (
        data["status"] == "cancelled" and data["refund"]["percent"] == 100 and data["refund"]["status"] == "requested"
    )

    besok = world.book(client, member, area, world.open_day(1), 9, 10)
    world.pay(client, member, "booking", besok["id"])
    r = client.post(f"/api/v1/bookings/{besok['id']}/cancel", json={}, headers=world.headers(member))
    assert r.status_code == 409 and "24 jam" in r.json()["detail"]


def test_reschedule_memeriksa_ulang_slot_dan_durasi_sama(client, world, dago, member):
    area = world.area(dago)
    hari = world.open_day(3)
    b = world.book(client, member, area, hari, 9, 11)
    lain = world.user("sinta@example.com")
    world.book(client, lain, area, hari, 14, 16)
    h = world.headers(member)
    url = f"/api/v1/bookings/{b['id']}/reschedule"
    assert (
        client.post(
            url, json={"date": hari.isoformat(), "start_time": "14:00", "end_time": "16:00"}, headers=h
        ).status_code
        == 409
    )
    assert (
        client.post(
            url, json={"date": hari.isoformat(), "start_time": "16:00", "end_time": "19:00"}, headers=h
        ).status_code
        == 422
    )
    r = client.post(url, json={"date": hari.isoformat(), "start_time": "16:00", "end_time": "18:00"}, headers=h)
    assert r.status_code == 200 and r.json()["local_start"] == "16:00"


def test_pengingat_24_jam_dan_1_jam_tidak_untuk_booking_batal(client, world, c, dago, member):
    area = world.area(dago)
    hari = world.open_day(3)
    b = world.book(client, member, area, hari, 10, 12)
    world.pay(client, member, "booking", b["id"])
    batal = world.book(client, member, area, hari, 14, 15)
    client.post(f"/api/v1/bookings/{batal['id']}/cancel", json={}, headers=world.headers(member))
    mulai = clock.combine(hari, time(10), "Asia/Jakarta")
    clock.shift(mulai - clock.now() - timedelta(hours=23))
    assert c.jobs.run_all()["booking_reminders"] == 1
    clock.shift(timedelta(hours=22, minutes=30))
    assert c.jobs.run_all()["booking_reminders"] == 1
    assert c.jobs.run_all()["booking_reminders"] == 0
    pengingat = [n for n in world.mailbox(member.email) if n.kind == "booking_reminder"]
    assert len(pengingat) == 2


def test_kalender_pengelola_dibatasi_gedungnya_dan_resepsionis_hanya_hari_ini(client, world, dago, member):
    lain = world.building("SDR")
    area = world.area(dago)
    hari = world.open_day()
    world.book(client, member, area, hari)
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    resepsionis = world.user("resepsionis@cakraspace.id", Role.RECEPTIONIST, buildings=[dago])
    params = {"building_id": dago.id, "date_from": hari.isoformat(), "date_to": (hari + timedelta(days=6)).isoformat()}
    r = client.get("/api/v1/manage/bookings", params=params, headers=world.headers(pengelola))
    assert r.status_code == 200 and len(r.json()["items"]) == 1 and r.json()["items"][0]["member"]["name"]
    params["building_id"] = lain.id
    assert client.get("/api/v1/manage/bookings", params=params, headers=world.headers(pengelola)).status_code == 403
    params["building_id"] = dago.id
    assert client.get("/api/v1/manage/bookings", params=params, headers=world.headers(resepsionis)).status_code == 403
    r = client.get("/api/v1/manage/bookings/today", params={"building_id": dago.id}, headers=world.headers(resepsionis))
    assert r.status_code == 200


def test_daftar_booking_member_tab_dan_paginasi(client, world, dago, member):
    area = world.area(dago)
    for i in range(3):
        world.book(client, member, area, world.open_day(2 + i), 9, 10)
    h = world.headers(member)
    r = client.get("/api/v1/me/bookings", params={"tab": "upcoming", "size": 2}, headers=h).json()
    assert r["total"] == 3 and len(r["items"]) == 2 and r["items"][0]["can_cancel"] is True
    assert r["items"][0]["rebook"] == {"building_id": dago.id, "area_id": area.id}
    assert client.get("/api/v1/me/bookings", params={"tab": "history"}, headers=h).json()["total"] == 0


def test_booking_lebih_dari_60_hari_ditolak(client, world, dago, member):
    area = world.area(dago)
    jauh = clock.local_today("Asia/Jakarta") + timedelta(days=70)
    while jauh.weekday() == 6:
        jauh += timedelta(days=1)
    r = client.post("/api/v1/bookings", json=world.booking_body(area, jauh), headers=world.headers(member))
    assert r.status_code == 422 and "60 hari" in r.json()["detail"]
