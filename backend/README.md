# Cakra Space API (Backend Kelompok 5)

Backend Coworking Space Management untuk proyek SDLC Kelompok 5. Isinya mengikuti dokumen
**SDLC - Dokumentasi Pengembangan Produk** tab Kelompok 5: 10 epic, 46 user story dan task BE-01 sampai
BE-52. Tabel ketertelusuran task ke kode ada di bagian akhir.

| Bagian | Isi |
|---|---|
| Framework | FastAPI, Pydantic, JWT (PyJWT), bcrypt |
| Penyimpanan | Satu berkas JSON (`data/cakraspace.json`) dengan repository CRUD, tanpa server database |
| Integrasi luar | Payment gateway, email dan perangkat pintu disimulasikan, bisa diganti layanan asli lewat kelas di `app/integrations/` |
| Dokumentasi API | Swagger di `/docs` setelah server jalan |

## Menjalankan

Prasyarat: Python 3.12.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # isi SECRET_KEY minimal 32 karakter
python -m app.seed            # data contoh, menimpa data lama
uvicorn app.main:app --reload --port 8000
```

Buka <http://localhost:8000/docs>. Tombol **Authorize** di Swagger menerima token dari
`POST /api/v1/auth/login`.

### Akun demo

Semua akun memakai password `CakraSpace2026`. Akun staf tidak bisa dibuat dari form registrasi.
Registrasi selalu menghasilkan akun member. Staf baru dibuat pengelola pusat lewat `POST /api/v1/staff`
dengan password sementara yang wajib diganti saat login pertama.

| Peran | Email | Gedung |
|---|---|---|
| Pengelola Pusat | `admin@cakraspace.id` | semua |
| Pengelola Lokasi | `lokasi.sudirman@cakraspace.id` | Sudirman |
| Pengelola Lokasi | `lokasi.dago@cakraspace.id` | Dago |
| Pengelola Lokasi | `lokasi.jogja@cakraspace.id` | Malioboro dan Diponegoro |
| Resepsionis | `resepsionis.dago@cakraspace.id` | Dago |
| Member | `budi@example.com` | membership Member Bulanan aktif, punya booking dan deposit |
| Member | `sinta@example.com` | punya booking dan satu refund yang menunggu persetujuan |
| Member | `dewi@example.com` | punya tunggakan lewat jatuh tempo, jadi tidak bisa booking |
| Member | `raka@example.com` | belum verifikasi email |

Ruangan yang bisa disewa mengikuti mock data FE. Ada 4 gedung (Sudirman, Dago, Malioboro aktif, Diponegoro
masih Draf) dan 23 area berupa hot desk, dedicated desk serta ruang rapat seperti Meeting Room Merdeka, Nusantara,
Tangkuban dan Braga. Seed juga membuat riwayat booking 45 hari, invoice, log akses, paket membership, voucher
`CAKRA10` dan `DAGOHEMAT`, pengumuman serta tiga perangkat pintu. API key perangkat dicetak sekali saat seed.

## Untuk tim FE

- Base URL `http://localhost:8000/api/v1`. CORS sudah mengizinkan Vite di port 5173.
- Login mengembalikan `access_token`, `user` dan `landing` (`/dashboard` untuk member, `/admin-dashboard` untuk staf).
  Token dikirim di header `Authorization: Bearer <token>` dan boleh disimpan di localStorage sesuai task FE-02.
- Error selalu berbentuk `{"detail": "pesan"}`. Beberapa error membawa `code`, misalnya `slot_taken` (disertai
  `suggestions` area lain), `email_not_verified`, `has_arrears` dan `password_change_required`.
- Halaman booking bergaya Lapangin (strip tanggal lalu grid jam) cukup memanggil
  `GET /buildings/{id}/slots?date=YYYY-MM-DD&type=meeting_room`. Setiap slot berisi status `available`, `booked`,
  `past` atau `closed` beserta harga per jam.
- Urutan booking: `POST /bookings/quote` untuk ringkasan harga (subtotal, diskon, pajak, total), lalu
  `POST /bookings`, lalu `POST /payments`. Booking ditahan 15 menit sampai dibayar.
- Halaman "menunggu pembayaran" melakukan polling ke `GET /payments/{id}`. Untuk demo, pembayaran diselesaikan
  dengan `POST /sandbox/payments/{gateway_ref}/success`.
- Email simulasi (verifikasi, reset password, undangan tamu) bisa dibaca di `GET /dev/mailbox?email=...`. Endpoint
  ini tidak tersedia kalau `APP_ENV=production`.

| Halaman FE sekarang | Endpoint |
|---|---|
| Login, Register | `POST /auth/login`, `POST /auth/register`, `POST /auth/verify-email` |
| BuildingList, BuildingDetail | `GET /buildings`, `GET /buildings/{id}`, `GET /buildings/{id}/areas` |
| BookingForm, BookingConfirm | `GET /buildings/{id}/slots`, `POST /bookings/quote`, `POST /bookings`, `POST /payments` |
| MyBookings | `GET /me/bookings?tab=upcoming` dan `tab=history`, `POST /bookings/{id}/cancel`, `/reschedule` |
| Dashboard member | `GET /me/summary`, `GET /me/access-qr`, `GET /me/invoices` |
| AdminDashboard | `GET /manage/reports/summary`, `GET /manage/bookings`, `GET /manage/refunds` |

## Tugas terjadwal

Hold booking 15 menit, pengingat booking, penonaktifan membership, pengingat H-7 dan H-1 serta deteksi perangkat
offline dijalankan oleh `JobRunner`. Panggil salah satu cara berikut setiap beberapa menit.

```bash
python -m app.jobs
curl -X POST http://localhost:8000/api/v1/internal/jobs/run -H "X-Cron-Secret: <CRON_SECRET di .env>"
```

Tanpa cron pun data tetap benar karena status hold kedaluwarsa juga dihitung saat dibaca.

## Pengujian

```bash
pytest -q        # 72 test
ruff check .
ruff format --check .
```

Test memakai berkas JSON sementara per test, jadi data `data/cakraspace.json` tidak tersentuh. Cakupannya mengikuti
acceptance criteria, yaitu penguncian login 5 kali, link verifikasi 24 jam dan reset 30 menit, double booking dua thread
bersamaan, hold 15 menit, batas batal per gedung, refund penuh dan sebagian, webhook palsu dan webhook ulang,
voucher, pajak setelah diskon, QR 30 detik, QR tamu sekali pakai, log akses append-only, RBAC per gedung,
prorata upgrade, freeze, churn, ekspor, heartbeat dan perintah perangkat.

## Struktur folder

```
backend/
├── app/
│   ├── main.py            # aplikasi FastAPI, CORS, header keamanan, handler error
│   ├── container.py       # merangkai semua layanan
│   ├── seed.py            # data contoh
│   ├── jobs.py            # CLI tugas terjadwal
│   ├── core/              # config, security (bcrypt, JWT, HMAC), clock, errors, deps
│   ├── db/                # JsonStore (kunci + tulis atomik), Repository CRUD, daftar koleksi
│   ├── models/            # entitas per domain (account, location, booking, billing, membership, operations)
│   ├── schemas/           # skema request dan response
│   ├── services/          # logika domain dalam kelas per epic
│   ├── integrations/      # mailer, payment gateway sandbox, PDF dan xlsx
│   └── routers/           # endpoint tipis per bagian
├── data/                  # berkas JSON, unggahan denah dan hasil ekspor (tidak masuk git)
└── tests/                 # pytest
```

## Catatan penyimpanan JSON

- Setiap operasi tulis memuat ulang data, menyalinnya, mengubah salinan lalu menulis atomik (berkas sementara
  lalu rename). Kalau terjadi error, salinan dibuang sehingga tidak ada perubahan setengah jadi.
- Semua tulis berjalan di bawah satu kunci (thread lock dan file lock di macOS/Linux). Kunci ini menggantikan
  row lock database untuk mencegah double booking (BE-18).
- Cocok untuk satu proses server. Berkas JSON tidak cocok untuk hosting serverless seperti Vercel karena disk-nya
  tidak permanen.

## Ketertelusuran task BE

| Task | Isi task di dokumen | Implementasi |
|---|---|---|
| BE-01 | Tabel users dan hashing bcrypt | `models/account.py` User, `core/security.py` PasswordHasher |
| BE-02 | POST /auth/login mengembalikan JWT | `POST /auth/login` |
| BE-03 | POST /auth/register, email unik dan panjang password | `POST /auth/register` |
| BE-04 | Email verifikasi berlaku 24 jam | `POST /auth/verify-email`, `/auth/resend-verification` |
| BE-05 | Lupa dan reset password token sekali pakai | `POST /auth/forgot-password`, `/auth/reset-password` |
| BE-06 | Logout memasukkan token ke daftar blokir | `POST /auth/logout`, koleksi `revoked_tokens` |
| BE-07 | Akun pengelola dengan password sementara | `POST /staff`, `POST /auth/change-password` |
| BE-08 | Tabel buildings, CRUD, status Draf/Aktif/Nonaktif | `/buildings`, `PUT /buildings/{id}/status` |
| BE-09 | operating_hours dan holidays per gedung | `PUT /buildings/{id}/operating-hours`, `/holidays` |
| BE-10 | floors, facilities, building_facilities | `/buildings/{id}/floors`, `/facilities`, `PUT /buildings/{id}/facilities` |
| BE-11 | Tabel areas dan CRUD area | `/areas` |
| BE-12 | Harga, kapasitas, area_facilities | `POST/PATCH /areas`, `PUT /areas/{id}/facilities` |
| BE-13 | Ubah status area dan audit log | `PUT /areas/{id}/status`, `GET /manage/audit-logs` |
| BE-14 | Unggah denah dan koordinat area | `PUT /floors/{id}/plan`, `PUT /areas/{id}/position`, `GET /floors/{id}/map` |
| BE-15 | GET availability untuk pencarian slot | `GET /buildings/{id}/availability`, `GET /buildings/{id}/slots` |
| BE-16 | Tabel bookings dan POST /bookings | `POST /bookings`, `POST /bookings/quote` |
| BE-17 | Job pembatalan booking tak dibayar 15 menit | `BookingService.expire_holds` lewat `JobRunner` |
| BE-18 | Row lock saat menyimpan booking | kunci tulis `JsonStore`, diuji dengan dua thread |
| BE-19 | Batal dan reschedule dengan batas waktu per gedung | `POST /bookings/{id}/cancel`, `/reschedule` |
| BE-20 | Scheduler pengingat dan template email | `BookingService.send_reminders` |
| BE-21 | Daftar booking pengelola dengan filter | `GET /manage/bookings`, `/manage/bookings/today` |
| BE-22 | Integrasi payment gateway | `POST /payments`, `integrations/payment_gateway.py` |
| BE-23 | Webhook dengan verifikasi signature dan idempotency key | `POST /payments/webhook`, koleksi `payment_events` |
| BE-24 | Invoice PDF bernomor per gedung | `GET /me/invoices/{id}/pdf`, format `INV/<kode gedung>/<YYYYMM>/<urut>` |
| BE-25 | Kirim invoice lewat email setelah webhook sukses | `InvoiceService.mark_paid` |
| BE-26 | Aturan refund bawaan lokasi pilot | kolom refund di gedung, `PUT /buildings/{id}/refund-policy` |
| BE-27 | Persetujuan refund dan API refund gateway | `/manage/refunds`, `/approve`, `/reject` |
| BE-28 | deposits, arrears dan blokir booking | `/manage/deposits`, `/manage/arrears` |
| BE-29 | vouchers dan hitung harga (diskon dulu, lalu pajak) | `/manage/vouchers`, `PUT /manage/settings/tax`, `PricingService` |
| BE-30 | Token QR dinamis dan validasi akses | `GET /me/access-qr`, `POST /access/validate` |
| BE-31 | Undangan tamu dan QR sekali pakai | `/bookings/{id}/guests` |
| BE-32 | access_logs append-only dan filter | `AppendOnlyRepository`, `/manage/access-logs`, `/export` |
| BE-33 | roles, permissions, user_buildings dan middleware otorisasi | `services/access_control.py`, `/roles`, `/staff` |
| BE-34 | plans, plan_benefits dan CRUD paket | `/manage/plans` |
| BE-35 | subscriptions dan aktivasi dari webhook | `POST /subscriptions` lalu `POST /payments` |
| BE-36 | Prorata dan penjadwalan perubahan paket | `POST /payments` purpose `subscription_change` dan `subscription_renewal` |
| BE-37 | benefit_usages dan pemotongan kuota | `MembershipService.consume/reverse`, `GET /me/subscription` |
| BE-38 | Freeze dan unfreeze | `/subscriptions/freeze`, `/subscriptions/unfreeze` |
| BE-39 | Scheduler penonaktifan dan email pengingat | `MembershipService.daily` |
| BE-40 | GET /me/summary | `GET /me/summary` |
| BE-41 | Daftar booking member dengan paginasi | `GET /me/bookings` |
| BE-42 | Daftar invoice member | `GET /me/invoices` |
| BE-43 | Profil member dan pengumuman | `PATCH /me`, `POST /me/email`, `/manage/announcements`, `GET /me/announcements` |
| BE-44 | Agregasi ringkasan operasional | `GET /manage/reports/summary` |
| BE-45 | Pendapatan per gedung per bulan | `GET /manage/reports/revenue` |
| BE-46 | Laporan member baru, aktif dan churn | `GET /manage/reports/members` |
| BE-47 | Ekspor laporan xlsx dan PDF | `/manage/reports/exports` |
| BE-48 | devices, API key per perangkat dan pencabutan | `/manage/devices`, `/revoke` |
| BE-49 | Heartbeat dan deteksi perangkat offline | `POST /device/heartbeat`, `DeviceService.detect_offline` |
| BE-50 | Antrean perintah ke perangkat (polling) | `/manage/devices/{id}/commands`, `GET /device/commands` |
| BE-51 | device_maintenances | `/manage/devices/{id}/maintenances` |
| BE-52 | Kunci akun setelah 5 kali gagal login | `AuthService.login` |
