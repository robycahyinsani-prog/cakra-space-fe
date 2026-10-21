import json
from datetime import time, timedelta

from app.core.clock import clock
from app.models.enums import Role


def voucher(client, world, admin, **extra):
    hari = clock.local_today("Asia/Jakarta")
    body = {
        "code": "CAKRA10",
        "discount_type": "percent",
        "discount_value": 10,
        "max_discount": 5_000,
        "quota": 1,
        "valid_from": (hari - timedelta(days=1)).isoformat(),
        "valid_until": (hari + timedelta(days=30)).isoformat(),
        **extra,
    }
    r = client.post("/api/v1/manage/vouchers", json=body, headers=world.headers(admin))
    assert r.status_code == 201, r.text
    return r.json()


def test_bayar_lewat_sandbox_mengkonfirmasi_booking_dan_menerbitkan_invoice(client, world, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    hasil = world.pay(client, member, "booking", b["id"])
    assert hasil["payment"]["va_number"].startswith("8808")
    assert hasil["webhook"]["result"] == "booking_confirmed"
    detail = client.get(f"/api/v1/bookings/{b['id']}", headers=world.headers(member)).json()
    assert detail["status"] == "confirmed" and detail["invoice"]["status"] == "paid"
    periode = clock.now().strftime("%Y%m")
    assert detail["invoice"]["number"] == f"INV/DGO/{periode}/0001"
    kinds = [n.kind for n in world.mailbox(member.email)]
    assert "booking_confirmed" in kinds and "invoice" in kinds


def test_metode_ewallet_dan_kartu_memakai_halaman_gateway(client, world, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    r = client.post(
        "/api/v1/payments",
        json={"purpose": "booking", "reference_id": b["id"], "method": "credit_card"},
        headers=world.headers(member),
    ).json()
    assert r["payment"]["payment_url"] and r["payment"]["va_number"] is None
    status = client.get(f"/api/v1/payments/{r['payment']['id']}", headers=world.headers(member)).json()
    assert status["status"] == "pending"


def test_pembayaran_gagal_tidak_mengkonfirmasi_booking(client, world, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    hasil = world.pay(client, member, "booking", b["id"], outcome="failed")
    assert hasil["webhook"]["result"] == "failed"
    assert (
        client.get(f"/api/v1/bookings/{b['id']}", headers=world.headers(member)).json()["status"] == "pending_payment"
    )


def test_webhook_signature_palsu_ditolak_dan_webhook_ulang_tidak_diproses_dua_kali(client, world, c, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    bayar = client.post(
        "/api/v1/payments",
        json={"purpose": "booking", "reference_id": b["id"], "method": "virtual_account"},
        headers=world.headers(member),
    ).json()
    raw, sig = c.gateway.build_webhook(bayar["payment"]["gateway_ref"], "success", bayar["payment"]["amount"])
    palsu = client.post("/api/v1/payments/webhook", content=raw, headers={"X-Signature": "0" * 64})
    assert palsu.status_code == 401
    pertama = client.post("/api/v1/payments/webhook", content=raw, headers={"X-Signature": sig}).json()
    kedua = client.post("/api/v1/payments/webhook", content=raw, headers={"X-Signature": sig}).json()
    assert pertama["duplicate"] is False and kedua["duplicate"] is True
    with c.store.read() as tx:
        log = tx.payment_events.all()
    assert [e.result for e in log] == ["invalid_signature", "booking_confirmed"]


def test_webhook_nominal_tidak_cocok_ditolak(client, world, c, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    bayar = client.post(
        "/api/v1/payments",
        json={"purpose": "booking", "reference_id": b["id"], "method": "virtual_account"},
        headers=world.headers(member),
    ).json()
    raw, sig = c.gateway.build_webhook(bayar["payment"]["gateway_ref"], "success", 1)
    r = client.post("/api/v1/payments/webhook", content=raw, headers={"X-Signature": sig}).json()
    assert r["result"] == "amount_mismatch"


def test_pembayaran_terlambat_setelah_hold_habis_dikembalikan_otomatis(client, world, c, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    bayar = client.post(
        "/api/v1/payments",
        json={"purpose": "booking", "reference_id": b["id"], "method": "virtual_account"},
        headers=world.headers(member),
    ).json()
    clock.shift(timedelta(minutes=20))
    c.jobs.run_all()
    payload = json.dumps(
        {
            "event_id": "EVT-telat",
            "gateway_ref": bayar["payment"]["gateway_ref"],
            "status": "success",
            "amount": bayar["payment"]["amount"],
        }
    ).encode()
    with c.store.write() as tx:
        p = tx.payments.first(gateway_ref=bayar["payment"]["gateway_ref"])
        tx.payments.update(p.id, status="pending")
    r = client.post(
        "/api/v1/payments/webhook", content=payload, headers={"X-Signature": c.gateway.signer.sign(payload)}
    )
    assert r.json()["result"] == "late_payment_refunded"


def test_invoice_pdf_hanya_untuk_pemiliknya(client, world, dago, member):
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day())
    world.pay(client, member, "booking", b["id"])
    daftar = client.get("/api/v1/me/invoices", headers=world.headers(member)).json()
    assert daftar[0]["status"] == "paid" and daftar[0]["can_pay"] is False
    pdf = client.get(f"/api/v1/me/invoices/{daftar[0]['id']}/pdf", headers=world.headers(member))
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    lain = world.user("sinta@example.com")
    assert client.get(f"/api/v1/me/invoices/{daftar[0]['id']}/pdf", headers=world.headers(lain)).status_code == 404


def test_voucher_persen_dengan_batas_dan_pajak_setelah_diskon(client, world, dago, member, admin):
    voucher(client, world, admin)
    area = world.area(dago)
    q = client.post(
        "/api/v1/bookings/quote",
        json=world.booking_body(area, world.open_day(), 9, 12, voucher_code="cakra10"),
        headers=world.headers(member),
    ).json()
    # subtotal 60.000, diskon 10% dibatasi 5.000, pajak 11% dari 55.000
    assert q["voucher_discount"] == 5_000 and q["tax"] == 6_050 and q["total"] == 61_050


def test_voucher_kuota_habis_kedaluwarsa_dan_khusus_gedung(client, world, dago, member, admin):
    lain = world.building("SDR")
    voucher(client, world, admin)
    voucher(
        client,
        world,
        admin,
        code="LAMA",
        valid_until=(clock.local_today("Asia/Jakarta") - timedelta(days=1)).isoformat(),
        valid_from=(clock.local_today("Asia/Jakarta") - timedelta(days=5)).isoformat(),
    )
    voucher(client, world, admin, code="KHUSUS", quota=5, building_ids=[lain.id])
    area = world.area(dago)
    h = world.headers(member)
    hari = world.open_day()
    b = world.book(client, member, area, hari, 9, 10, voucher_code="CAKRA10")
    habis = client.post(
        "/api/v1/bookings/quote", json=world.booking_body(area, hari, 11, 12, voucher_code="CAKRA10"), headers=h
    )
    assert habis.status_code == 422 and "Kuota" in habis.json()["detail"]
    lama = client.post(
        "/api/v1/bookings/quote", json=world.booking_body(area, hari, 11, 12, voucher_code="LAMA"), headers=h
    )
    assert lama.status_code == 422
    khusus = client.post(
        "/api/v1/bookings/quote", json=world.booking_body(area, hari, 11, 12, voucher_code="KHUSUS"), headers=h
    )
    assert khusus.status_code == 422 and "gedung" in khusus.json()["detail"]
    # booking belum dibayar yang dibatalkan mengembalikan kuota voucher
    client.post(f"/api/v1/bookings/{b['id']}/cancel", json={}, headers=h)
    assert (
        client.post(
            "/api/v1/bookings/quote", json=world.booking_body(area, hari, 11, 12, voucher_code="CAKRA10"), headers=h
        ).status_code
        == 200
    )


def test_tarif_pajak_dari_pengaturan(client, world, dago, member, admin):
    client.put("/api/v1/manage/settings/tax", json={"tax_rate_percent": 10}, headers=world.headers(admin))
    area = world.area(dago)
    q = client.post(
        "/api/v1/bookings/quote", json=world.booking_body(area, world.open_day(), 9, 12), headers=world.headers(member)
    ).json()
    assert q["tax_rate_percent"] == 10 and q["tax"] == 6_000
    assert (
        client.put(
            "/api/v1/manage/settings/tax", json={"tax_rate_percent": 5}, headers=world.headers(member)
        ).status_code
        == 403
    )


def test_refund_disetujui_pengelola_gedungnya_saja(client, world, dago, member):
    lain = world.building("SDR")
    area = world.area(dago)
    b = world.book(client, member, area, world.open_day(3))
    world.pay(client, member, "booking", b["id"])
    client.post(f"/api/v1/bookings/{b['id']}/cancel", json={}, headers=world.headers(member))
    pengelola_lain = world.user("lain@cakraspace.id", Role.LOCATION_MANAGER, buildings=[lain])
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    assert client.get("/api/v1/manage/refunds", headers=world.headers(pengelola_lain)).json() == []
    refund = client.get("/api/v1/manage/refunds", headers=world.headers(pengelola)).json()[0]
    assert (
        client.post(f"/api/v1/manage/refunds/{refund['id']}/approve", headers=world.headers(pengelola_lain)).status_code
        == 403
    )
    r = client.post(f"/api/v1/manage/refunds/{refund['id']}/approve", headers=world.headers(pengelola))
    assert r.status_code == 200 and r.json()["status"] == "processed"
    inv = client.get("/api/v1/me/invoices", headers=world.headers(member)).json()[0]
    assert inv["status"] == "refunded"
    detail = client.get(f"/api/v1/bookings/{b['id']}", headers=world.headers(member)).json()
    assert detail["refund"]["status"] == "processed"


def test_refund_sebagian_sesuai_aturan_gedung(client, world, c, member):
    gedung = world.building(
        "SDR", cancel_deadline_hours=2, refund_full_hours=48, refund_partial_hours=6, refund_partial_percent=50
    )
    area = world.area(gedung)
    b = world.book(client, member, area, world.open_day(1), 18, 19)
    world.pay(client, member, "booking", b["id"])
    mulai = clock.combine(world.open_day(1), time(18), "Asia/Jakarta")
    clock.shift(mulai - clock.now() - timedelta(hours=10))
    r = client.post(f"/api/v1/bookings/{b['id']}/cancel", json={}, headers=world.headers(member)).json()
    assert r["refund"]["percent"] == 50 and r["refund"]["amount"] == b["total"] // 2


def test_deposit_dan_tunggakan(client, world, dago, member):
    pengelola = world.user("lokasi@cakraspace.id", Role.LOCATION_MANAGER, buildings=[dago])
    h = world.headers(pengelola)
    dep = client.post(
        "/api/v1/manage/deposits",
        json={"user_id": member.id, "building_id": dago.id, "item": "Kunci loker", "amount": 50_000},
        headers=h,
    )
    assert dep.status_code == 201
    assert client.post(f"/api/v1/manage/deposits/{dep.json()['id']}/return", headers=h).json()["status"] == "returned"
    lalu = (clock.local_today("Asia/Jakarta") - timedelta(days=2)).isoformat()
    tg = client.post(
        "/api/v1/manage/arrears",
        json={"user_id": member.id, "building_id": dago.id, "description": "Sewa", "amount": 100_000, "due_date": lalu},
        headers=h,
    ).json()
    daftar = client.get("/api/v1/manage/arrears", params={"overdue_only": True}, headers=h).json()
    assert daftar[0]["is_overdue"] is True and daftar[0]["member_name"] == member.name
    area = world.area(dago)
    r = client.post("/api/v1/bookings", json=world.booking_body(area, world.open_day()), headers=world.headers(member))
    assert r.status_code == 403
    client.post(f"/api/v1/manage/arrears/{tg['id']}/settle", headers=h)
    world.book(client, member, area, world.open_day())
