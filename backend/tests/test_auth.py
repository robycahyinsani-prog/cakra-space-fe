import re
from datetime import timedelta

from app.core.clock import clock
from app.models.enums import Role
from tests.conftest import PASSWORD

def token_dari(email_body: str) -> str:
    return re.search(r"token=([\w-]+)", email_body).group(1)

def daftar(client, email="baru@example.com", **extra):
    body = {"name": "Member Baru", "email": email, "password": "Rahasia123", "password_confirmation": "Rahasia123",
            **extra}
    return client.post("/api/v1/auth/register", json=body)

def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})

def test_register_selalu_member_dan_mengirim_link_verifikasi(client, world):
    r = daftar(client, role="central_manager")
    assert r.status_code == 201
    data = r.json()
    assert data["role"] == "member" and data["is_verified"] is False
    assert "verify-email?token=" in world.mailbox("baru@example.com")[-1].body

def test_register_validasi_email_ganda_password_dan_konfirmasi(client):
    assert daftar(client).status_code == 201
    assert daftar(client).status_code == 409
    assert daftar(client, email="a@example.com", password="pendek", password_confirmation="pendek").status_code == 422
    r = daftar(client, email="b@example.com", password_confirmation="beda12345")
    assert r.status_code == 422

def test_verifikasi_email_sekali_pakai_dan_kedaluwarsa_24_jam(client, world):
    daftar(client)
    token = token_dari(world.mailbox("baru@example.com")[-1].body)
    r = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert r.status_code == 200 and r.json()["is_verified"] is True
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 422

    daftar(client, email="lain@example.com")
    token = token_dari(world.mailbox("lain@example.com")[-1].body)
    clock.shift(timedelta(hours=25))
    r = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert r.status_code == 422 and "kedaluwarsa" in r.json()["detail"]

def test_login_berhasil_dan_pesan_sama_untuk_email_atau_password_salah(client, member):
    r = login(client, member.email)
    assert r.status_code == 200
    data = r.json()
    assert data["token_type"] == "bearer" and data["landing"] == "/dashboard"
    salah_pw = login(client, member.email, "SalahSekali1")
    salah_email = login(client, "tidakada@example.com", "SalahSekali1")
    assert salah_pw.status_code == salah_email.status_code == 401
    assert salah_pw.json()["detail"] == salah_email.json()["detail"]

def test_akun_terkunci_setelah_5_kali_gagal_lalu_terbuka_15_menit(client, member):
    for _ in range(5):
        assert login(client, member.email, "SalahSekali1").status_code == 401
    r = login(client, member.email)
    assert r.status_code == 423 and "terkunci" in r.json()["detail"]
    clock.shift(timedelta(minutes=16))
    assert login(client, member.email).status_code == 200

def test_logout_mencabut_token(client, member):
    token = login(client, member.email).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/me", headers=h).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=h).status_code == 200
    assert client.get("/api/v1/me", headers=h).status_code == 401

def test_lupa_password_pesan_sama_link_sekali_pakai_dan_sesi_lama_berakhir(client, world, member):
    lama = login(client, member.email).json()["access_token"]
    a = client.post("/api/v1/auth/forgot-password", json={"email": member.email}).json()
    b = client.post("/api/v1/auth/forgot-password", json={"email": "tidakada@example.com"}).json()
    assert a == b
    token = token_dari(world.mailbox(member.email)[-1].body)
    body = {"token": token, "new_password": "PasswordBaru1", "password_confirmation": "PasswordBaru1"}
    assert client.post("/api/v1/auth/reset-password", json=body).status_code == 200
    assert client.post("/api/v1/auth/reset-password", json=body).status_code == 422
    assert client.get("/api/v1/me", headers={"Authorization": f"Bearer {lama}"}).status_code == 401
    assert login(client, member.email, "PasswordBaru1").status_code == 200

def test_link_reset_password_berlaku_30_menit(client, world, member):
    client.post("/api/v1/auth/forgot-password", json={"email": member.email})
    token = token_dari(world.mailbox(member.email)[-1].body)
    clock.shift(timedelta(minutes=31))
    body = {"token": token, "new_password": "PasswordBaru1", "password_confirmation": "PasswordBaru1"}
    assert client.post("/api/v1/auth/reset-password", json=body).status_code == 422

def test_staf_dibuat_pengelola_pusat_dan_wajib_ganti_password_pertama(client, world, admin, dago):
    r = client.post("/api/v1/staff", json={"name": "Pengelola Dago", "email": "lokasi@cakraspace.id",
                                           "role": "location_manager", "building_ids": [dago.id]},
                    headers=world.headers(admin))
    assert r.status_code == 201
    sementara = r.json()["temporary_password"]
    masuk = login(client, "lokasi@cakraspace.id", sementara).json()
    assert masuk["must_change_password"] is True and masuk["landing"] == "/admin-dashboard"
    h = {"Authorization": f"Bearer {masuk['access_token']}"}
    r = client.get("/api/v1/manage/devices", headers=h)
    assert r.status_code == 403 and r.json()["code"] == "password_change_required"
    ganti = client.post("/api/v1/auth/change-password", headers=h, json={
        "current_password": sementara, "new_password": "PasswordTetap1", "password_confirmation": "PasswordTetap1"})
    assert ganti.status_code == 200
    h = {"Authorization": f"Bearer {ganti.json()['access_token']}"}
    assert client.get("/api/v1/manage/devices", headers=h).status_code == 200

def test_member_tidak_bisa_membuat_staf_dan_pengelola_lokasi_wajib_punya_gedung(client, world, admin, member):
    body = {"name": "X", "email": "x@cakraspace.id", "role": "central_manager"}
    assert client.post("/api/v1/staff", json=body, headers=world.headers(member)).status_code == 403
    body = {"name": "Lokasi", "email": "y@cakraspace.id", "role": "location_manager", "building_ids": []}
    assert client.post("/api/v1/staff", json=body, headers=world.headers(admin)).status_code == 422

def test_ganti_email_perlu_verifikasi_ulang(client, world, member):
    h = world.headers(member)
    r = client.post("/api/v1/me/email", json={"new_email": "budi.baru@example.com", "password": PASSWORD}, headers=h)
    assert r.status_code == 200
    assert client.get("/api/v1/me", headers=h).json()["email"] == member.email
    token = token_dari(world.mailbox("budi.baru@example.com")[-1].body)
    assert client.post("/api/v1/auth/confirm-email-change", json={"token": token}).json()["email"] == "budi.baru@example.com"

def test_profil_bisa_diubah(client, world, member):
    r = client.patch("/api/v1/me", json={"name": "Budi S", "phone": "0812", "company": "PT Maju"},
                     headers=world.headers(member))
    assert r.status_code == 200 and r.json()["company"] == "PT Maju" and r.json()["role"] == Role.MEMBER
