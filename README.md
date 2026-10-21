# Cakra Space

Aplikasi Coworking Space Management untuk proyek SDLC Kelompok 5. Frontend React + Vite ada di folder ini
dan backend FastAPI ada di folder [`backend/`](backend/README.md).

## Menjalankan

### 1. Backend (FastAPI, Python 3.12)

Buka terminal pertama lalu jalankan server API di port `8000`.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # pastikan SECRET_KEY minimal 32 karakter
python -m app.seed            # isi data contoh (menimpa data lama)
uvicorn app.main:app --reload --port 8000
```

Dokumentasi Swagger tersedia di <http://localhost:8000/docs>. Penjelasan arsitektur backend lebih lengkap ada di
[backend/README.md](backend/README.md).

### 2. Frontend (React + Vite)

Buka terminal kedua di folder root proyek.

```bash
npm install
npm run dev
```

Buka <http://localhost:5173>. Frontend memanggil API di `http://localhost:8000/api/v1`. Kalau backend berjalan di
alamat lain, salin `.env.example` menjadi `.env.local` lalu ubah `VITE_API_URL`.

### Akun demo

Semua akun memakai password `CakraSpace2026`. Setelah login, member diarahkan ke `/dashboard` dan staf ke
`/admin-dashboard`.

| Peran | Email | Keterangan |
|---|---|---|
| Pengelola Pusat | `admin@cakraspace.id` | Akses penuh semua gedung, paket membership, dan voucher |
| Pengelola Lokasi | `lokasi.sudirman@cakraspace.id` | Gedung Sudirman |
| Pengelola Lokasi | `lokasi.dago@cakraspace.id` | Gedung Dago (termasuk perintah perangkat pintu) |
| Pengelola Lokasi | `lokasi.jogja@cakraspace.id` | Gedung Malioboro dan Diponegoro (Draf) |
| Resepsionis | `resepsionis.dago@cakraspace.id` | Validasi QR dan booking hari ini di Gedung Dago |
| Member | `budi@example.com` | Membership aktif, punya booking dan deposit |
| Member | `sinta@example.com` | Punya booking dan refund menunggu persetujuan |
| Member | `dewi@example.com` | Punya tunggakan lewat jatuh tempo |
| Member | `raka@example.com` | Belum verifikasi email |

## Struktur `src`

| Folder | Isi |
|---|---|
| `api/` | `ApiClient` (axios + token + error), `SessionStore` (token di localStorage) dan satu kelas per sumber daya, misalnya `BookingApi` atau `ManageApi` |
| `context/` | `AuthProvider` dan hook `useAuth` |
| `hooks/` | `useResource` untuk memuat data dari API |
| `utils/` | `Format`, `OpeningSchedule` (jam buka dan libur), `SlotSelection` (rentang jam yang dipilih), label enum |
| `components/booking/` | strip tanggal, grid jam, ringkasan harga, panel pembayaran, pembatalan |
| `components/common/` | status badge, tampilan memuat atau gagal, hitung mundur |
| `components/access/` | QR akses dinamis yang berganti tiap 30 detik |
| `components/auth/` | penjaga halaman berdasarkan peran, kartu halaman akun |
| `components/building/` | denah lantai interaktif (`FloorPlanMap`) dengan pin area, status ruang dan mode penempatan titik |
| `components/manage/` | panel pengelola: gedung, area, paket, voucher, keuangan, perangkat, log akses, laporan, pengumuman dan staf |
| `pages/` | satu file per halaman |

## Alur booking

1. Halaman `/booking/:roomId` (dari kartu ruang atau pin di denah lantai) atau `/buildings/:id/booking` menampilkan
   strip 14 hari ke depan. Hari tutup dan libur tidak bisa dipilih.
2. Grid jam diambil dari `GET /buildings/{id}/slots`. Klik satu jam kosong lalu klik jam lain di ruang yang sama
   untuk memperpanjang durasi.
3. Ringkasan harga dihitung `POST /bookings/quote`, termasuk voucher dan kuota jam ruang rapat membership.
   Tamu bisa memilih jam lebih dulu. Pilihannya dibawa ke halaman login lalu dipulihkan setelah login.
4. `POST /bookings` menahan slot 15 menit, lalu halaman `/booking/confirm/:id` menampilkan pilihan metode bayar.
   Status pembayaran dipantau otomatis. Saat `npm run dev` ada tombol untuk mensimulasikan notifikasi gateway sandbox.
5. Setelah terkonfirmasi, halaman yang sama menampilkan QR akses, invoice PDF, tombol pembatalan dan form undangan
   tamu. Untuk ruang rapat, setiap tamu menerima QR sekali pakai lewat email.
6. Tombol **Ubah Jadwal** membuka grid yang sama dengan `?reschedule=<id>`. Hanya ruang yang sama yang tampil dan
   durasinya tetap, jadi cukup klik jam mulai baru.

## Membership dan dashboard member

Halaman `/membership` menampilkan paket dari `GET /plans` dan status langganan dari `GET /me/subscription`. Member
bisa membeli paket (`POST /subscriptions` lalu `POST /payments`), memperpanjang mulai H-7 sebelum masa berlaku habis,
upgrade dengan selisih prorata, menjadwalkan downgrade untuk periode berikutnya, freeze dan mengakhiri freeze lebih
cepat.

Halaman `/dashboard` menampilkan QR akses gedung, status langganan, booking berikutnya, pengumuman, daftar invoice
dengan unduhan PDF, ubah profil dan ganti email dengan verifikasi ulang.

## Akun staf dan panel pengelola

Staf baru dibuat pengelola pusat lewat `POST /staff` dengan password sementara. Login pertama langsung diarahkan
ke `/change-password` dan halaman lain tertutup sampai password diganti. Tab di `/admin-dashboard` mengikuti
`user.permissions`, jadi resepsionis hanya melihat validasi QR dan booking hari ini.

| Tab | Isi |
|---|---|
| Operasional | Ringkasan hari ini, validasi QR, booking harian atau mingguan per lantai dan tipe area, persetujuan refund |
| Gedung & Area | Gedung baru (Draf), profil dan status gedung, jam buka, hari libur, lantai, denah interaktif, fasilitas, aturan refund, area dan status perawatan |
| Membership & Voucher | Paket membership dan benefit ruang rapat (hapus atau arsipkan), voucher diskon |
| Keuangan & Pajak | Tarif pajak (`settings.manage`), deposit dan tunggakan member per gedung (`finance.manage`) |
| Perangkat & Log Akses | Registrasi perangkat pintu (API key tampil sekali), cabut kunci, perintah `unlock` atau `restart`, maintenance, log akses dan ekspor Excel |
| Laporan & Ekspor | Pendapatan bulanan per gedung, member baru, aktif dan churn per paket, ekspor `.xlsx` dan `.pdf` |
| Pengumuman & Staf | Pengumuman gedung (`announcements.manage`), akun staf dan gedung yang dipegang, reset password sementara, matriks peran (`staff.manage`) |

## Pemeriksaan

Frontend:

```bash
npm run lint
npm run build
```

Backend:

```bash
cd backend
source .venv/bin/activate
pytest -q
ruff check .
```
