import re
from datetime import time, timedelta

import pytest

from app.core.clock import clock
from app.db.repository import ReadOnlyError
from app.models.enums import AreaType, Role


def device(client, world, building, admin):
    r = client.post(
        "/api/v1/manage/devices",
        json={"building_id": building.id, "name": "Pembaca QR", "type": "qr_reader", "door": "Pintu Utama"},
        headers=world.headers(admin),
    )
    assert r.status_code == 201
    return r.json()


def scan(client, key, token):
    return client.post("/api/v1/access/validate", json={"token": token}, headers={"X-Device-Key": key}).json()


def ke_jam(hari, jam):
    tujuan = clock.combine(hari, time(jam), "Asia/Jakarta")
    clock.shift(tujuan - clock.now())


def test_qr_berganti_tiap_30_detik_dan_hanya_berlaku_saat_booking(client, world, dago, member, admin):
    key = device(client, world, dago, admin)["api_key"]
    area = world.area(dago)
    hari = world.open_day()
    b = world.book(client, member, area, hari, 10, 12)
    world.pay(client, member, "booking", b["id"])
    ke_jam(hari, 9)
    qr = client.get("/api/v1/me/access-qr", headers=world.headers(member)).json()
    assert scan(client, key, qr["token"])["result"] == "denied"
    ke_jam(hari, 10)
    qr = client.get("/api/v1/me/access-qr", headers=world.headers(member)).json()
    assert 0 < qr["expires_in"] <= 30
    assert scan(client, key, qr["token"])["result"] == "granted"
    clock.shift(timedelta(seconds=90))
    hasil = scan(client, key, qr["token"])
    assert hasil["result"] == "denied" and "kedaluwarsa" in hasil["reason"]


def test_qr_ditolak_di_gedung_lain_dan_semua_pemindaian_tercatat(client, world, dago, member, admin):
    lain = world.building("SDR")
    key_lain = device(client, world, lain, admin)["api_key"]
    area = world.area(dago)
    hari = world.open_day()
    b = world.book(client, member, area, hari, 10, 12)
    world.pay(client, member, "booking", b["id"])
    ke_jam(hari, 10)
    qr = client.get("/api/v1/me/access-qr", headers=world.headers(member)).json()
    assert scan(client, key_lain, qr["token"])["result"] == "denied"
    logs = client.get("/api/v1/manage/access-logs", headers=world.headers(admin)).json()
    assert len(logs) == 1 and logs[0]["user_id"] == member.id and logs[0]["result"] == "denied"
    xlsx = client.get("/api/v1/manage/access-logs/export", headers=world.headers(admin))
    assert xlsx.status_code == 200 and xlsx.content[:2] == b"PK"


def test_log_akses_hanya_bisa_ditambah(c):
    with c.store.write() as tx, pytest.raises(ReadOnlyError):
        tx.access_logs.update(1, reason="ubah")
    with c.store.write() as tx, pytest.raises(ReadOnlyError):
        tx.access_logs.delete(1)


def test_perangkat_dicabut_tidak_bisa_memvalidasi(client, world, dago, admin):
    dev = device(client, world, dago, admin)
    assert client.post("/api/v1/device/heartbeat", headers={"X-Device-Key": dev["api_key"]}).status_code == 200
    client.post(f"/api/v1/manage/devices/{dev['id']}/revoke", headers=world.headers(admin))
    r = client.post("/api/v1/access/validate", json={"token": "M.1.2.3"}, headers={"X-Device-Key": dev["api_key"]})
    assert r.status_code == 401 and "dicabut" in r.json()["detail"]


def test_tamu_rapat_qr_sekali_pakai_kapasitas_dan_jam_rapat(client, world, dago, member, admin):
    key = device(client, world, dago, admin)["api_key"]
    rapat = world.area(dago, "M1", AreaType.MEETING_ROOM, capacity=3, price_per_hour=100_000, price_per_day=600_000)
    hari = world.open_day()
    b = world.book(client, member, rapat, hari, 13, 15)
    world.pay(client, member, "booking", b["id"])
    h = world.headers(member)
    terlalu = [{"name": f"Tamu {i}", "email": f"t{i}@tamu.id"} for i in range(3)]
    assert client.post(f"/api/v1/bookings/{b['id']}/guests", json={"guests": terlalu}, headers=h).status_code == 422
    r = client.post(f"/api/v1/bookings/{b['id']}/guests", json={"guests": terlalu[:2]}, headers=h)
    assert r.status_code == 201
    token = re.search(r"(G\.\d+\.[\w-]+)", world.mailbox("t0@tamu.id")[-1].body).group(1)
    ke_jam(hari, 11)
    assert scan(client, key, token)["reason"] == "QR tamu hanya berlaku pada jam rapat"
    ke_jam(hari, 13)
    hasil = scan(client, key, token)
    assert hasil["result"] == "granted" and hasil["name"] == "Tamu 0"
    assert scan(client, key, token)["reason"] == "QR tamu sudah dipakai"
    log = client.get("/api/v1/manage/access-logs", params={"result": "granted"}, headers=world.headers(admin)).json()
    assert log[0]["inviter_id"] == member.id and log[0]["guest_name"] == "Tamu 0"


def test_resepsionis_memindai_hanya_di_gedungnya(client, world, dago, member):
    lain = world.building("SDR")
    resepsionis = world.user("resepsionis@cakraspace.id", Role.RECEPTIONIST, buildings=[dago])
    h = world.headers(resepsionis)
    qr = client.get("/api/v1/me/access-qr", headers=world.headers(member)).json()
    ok = client.post("/api/v1/access/validate", json={"token": qr["token"], "building_id": dago.id}, headers=h)
    assert ok.status_code == 200
    salah = client.post("/api/v1/access/validate", json={"token": qr["token"], "building_id": lain.id}, headers=h)
    assert salah.status_code == 403
    member_scan = client.post(
        "/api/v1/access/validate", json={"token": qr["token"], "building_id": dago.id}, headers=world.headers(member)
    )
    assert member_scan.status_code == 403
    # resepsionis tidak bisa melihat log akses (AC K5-US-006.4)
    assert client.get("/api/v1/manage/access-logs", headers=h).status_code == 403


def langganan(client, world, member, plan):
    sub = client.post("/api/v1/subscriptions", json={"plan_id": plan.id}, headers=world.headers(member))
    assert sub.status_code == 201
    hasil = world.pay(client, member, "subscription", sub.json()["id"])
    assert hasil["webhook"]["result"] == "subscription_activated"
    return client.get("/api/v1/me/subscription", headers=world.headers(member)).json()


def test_paket_crud_dan_paket_berpelanggan_hanya_diarsipkan(client, world, admin, member):
    h = world.headers(admin)
    r = client.post(
        "/api/v1/manage/plans",
        json={
            "name": "Paket Uji",
            "duration_days": 30,
            "price": 1_000_000,
            "benefits": [{"benefit_type": "meeting_room_hours", "quantity": 5}],
        },
        headers=h,
    )
    assert r.status_code == 201 and r.json()["benefits"][0]["quantity"] == 5
    kosong = r.json()["id"]
    assert client.delete(f"/api/v1/manage/plans/{kosong}", headers=h).json()["deleted"] is True
    plan = world.plan()
    langganan(client, world, member, plan)
    assert client.delete(f"/api/v1/manage/plans/{plan.id}", headers=h).json()["archived"] is True
    assert client.get("/api/v1/plans").json() == []
    assert (
        client.post(
            "/api/v1/manage/plans", json={"name": "X", "duration_days": 1, "price": 1}, headers=world.headers(member)
        ).status_code
        == 403
    )


def test_berlangganan_aktif_setelah_bayar_dan_qr_berlaku_di_semua_gedung(client, world, dago, member, admin):
    key = device(client, world, dago, admin)["api_key"]
    data = langganan(client, world, member, world.plan())
    assert data["status"] == "active" and data["days_left"] == 29
    assert data["benefits"][0]["remaining_minutes"] == 600
    qr = client.get("/api/v1/me/access-qr", headers=world.headers(member)).json()
    assert scan(client, key, qr["token"]) == {
        "result": "granted",
        "reason": "Membership aktif",
        "name": member.name,
        "credential": "member_qr",
    }


def test_benefit_ruang_rapat_memotong_kuota_dan_batal_mengembalikan(client, world, dago, member):
    langganan(client, world, member, world.plan(hours=10))
    rapat = world.area(dago, "M1", AreaType.MEETING_ROOM, capacity=6, price_per_hour=100_000, price_per_day=600_000)
    b = world.book(client, member, rapat, world.open_day(3), 9, 11, use_benefit=True)
    assert b["status"] == "confirmed" and b["total"] == 0 and b["benefit_minutes"] == 120
    sisa = client.get("/api/v1/me/subscription", headers=world.headers(member)).json()["benefits"][0]
    assert sisa["used_minutes"] == 120
    client.post(f"/api/v1/bookings/{b['id']}/cancel", json={}, headers=world.headers(member))
    sisa = client.get("/api/v1/me/subscription", headers=world.headers(member)).json()["benefits"][0]
    assert sisa["used_minutes"] == 0


def test_upgrade_prorata_dan_downgrade_periode_berikutnya(client, world, member):
    dasar = world.plan("Dasar", price=900_000)
    plus = world.plan("Plus", price=1_800_000)
    hemat = world.plan("Hemat", price=600_000)
    langganan(client, world, member, dasar)
    clock.shift(timedelta(days=10))
    hasil = world.pay(client, member, "subscription_change", None, plan_id=plus.id)
    # sisa 20 hari dari 30, selisih 900.000 -> 600.000
    assert hasil["payment"]["amount"] == 600_000 and hasil["webhook"]["result"] == "subscription_upgraded"
    assert client.get("/api/v1/me/subscription", headers=world.headers(member)).json()["plan"]["name"] == "Plus"
    turun = client.post(
        "/api/v1/payments",
        json={"purpose": "subscription_change", "method": "virtual_account", "plan_id": hemat.id},
        headers=world.headers(member),
    ).json()
    assert turun["payment"] is None and turun["change"]["kind"] == "downgrade"
    data = client.get("/api/v1/me/subscription", headers=world.headers(member)).json()
    assert data["plan"]["name"] == "Plus" and data["scheduled_plan"]["name"] == "Hemat"


def test_perpanjang_paling_cepat_7_hari_sebelum_habis(client, world, member):
    langganan(client, world, member, world.plan())
    r = client.post(
        "/api/v1/payments",
        json={"purpose": "subscription_renewal", "method": "virtual_account"},
        headers=world.headers(member),
    )
    assert r.status_code == 409
    clock.shift(timedelta(days=24))
    akhir_lama = client.get("/api/v1/me/subscription", headers=world.headers(member)).json()["subscription"]["end_date"]
    hasil = world.pay(client, member, "subscription_renewal", None)
    assert hasil["webhook"]["result"] == "subscription_renewed"
    akhir_baru = client.get("/api/v1/me/subscription", headers=world.headers(member)).json()["subscription"]["end_date"]
    assert (
        clock.local_today("Asia/Jakarta").fromisoformat(akhir_baru)
        - clock.local_today("Asia/Jakarta").fromisoformat(akhir_lama)
    ).days == 30


def test_freeze_maksimal_30_hari_menggeser_masa_berlaku_dan_menolak_qr(client, world, dago, member, admin):
    key = device(client, world, dago, admin)["api_key"]
    data = langganan(client, world, member, world.plan())
    akhir = data["subscription"]["end_date"]
    h = world.headers(member)
    besok = (clock.local_today("Asia/Jakarta") + timedelta(days=1)).isoformat()
    assert (
        client.post("/api/v1/subscriptions/freeze", json={"start_date": besok, "days": 31}, headers=h).status_code
        == 422
    )
    r = client.post("/api/v1/subscriptions/freeze", json={"start_date": besok, "days": 10}, headers=h)
    assert r.status_code == 200 and r.json()["end_date"] > akhir
    clock.shift(timedelta(days=2))
    qr = client.get("/api/v1/me/access-qr", headers=world.headers(member)).json()
    assert scan(client, key, qr["token"])["reason"] == "Membership sedang freeze"
    assert client.get("/api/v1/me/summary", headers=world.headers(member)).json()["membership_status"] == "frozen"
    r = client.post("/api/v1/subscriptions/unfreeze", headers=world.headers(member))
    assert r.status_code == 200 and r.json()["freeze_days_used"] == 1


def test_job_harian_menonaktifkan_membership_dan_mengirim_pengingat(client, world, c, member, dago):
    langganan(client, world, member, world.plan())
    clock.shift(timedelta(days=23))
    assert c.jobs.run_all()["membership"]["reminders"] == 1
    clock.shift(timedelta(days=6))
    assert c.jobs.run_all()["membership"]["reminders"] == 1
    clock.shift(timedelta(days=2))
    assert c.jobs.run_all()["membership"]["deactivated"] == 1
    kinds = [n.kind for n in world.mailbox(member.email)]
    assert kinds.count("membership_reminder") == 2 and "membership_inactive" in kinds
    assert client.get("/api/v1/me/summary", headers=world.headers(member)).json()["membership_status"] == "inactive"
