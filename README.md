# Cakra Space

Aplikasi Coworking Space Management untuk proyek SDLC Kelompok 5. Frontend React + Vite ada di folder ini
dan backend FastAPI ada di folder [`backend/`](backend/README.md).

## Menjalankan

Jalankan backend lebih dulu sesuai [backend/README.md](backend/README.md), lalu frontend.

```bash
npm install
npm run dev
```

Buka <http://localhost:5173>. Frontend memanggil API di `http://localhost:8000/api/v1`. Kalau backend berjalan di
alamat lain, salin `.env.example` menjadi `.env.local` lalu ubah `VITE_API_URL`.

Akun demo tercantum di README backend dan semuanya memakai password `CakraSpace2026`. Setelah login, member
diarahkan ke `/dashboard` dan staf ke `/admin-dashboard`.

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
| `pages/` | satu file per halaman |

## Alur booking

1. Halaman `/booking/:roomId` (dari kartu ruang) atau `/buildings/:id/booking` menampilkan strip 14 hari ke depan.
   Hari tutup dan libur tidak bisa dipilih.
2. Grid jam diambil dari `GET /buildings/{id}/slots`. Klik satu jam kosong lalu klik jam lain di ruang yang sama
   untuk memperpanjang durasi.
3. Ringkasan harga dihitung `POST /bookings/quote`, termasuk voucher dan kuota jam ruang rapat membership.
   Tamu bisa memilih jam lebih dulu. Pilihannya dibawa ke halaman login lalu dipulihkan setelah login.
4. `POST /bookings` menahan slot 15 menit, lalu halaman `/booking/confirm/:id` menampilkan pilihan metode bayar.
   Status pembayaran dipantau otomatis. Saat `npm run dev` ada tombol untuk mensimulasikan notifikasi gateway sandbox.
5. Setelah terkonfirmasi, halaman yang sama menampilkan QR akses, invoice PDF dan tombol pembatalan.
6. Tombol **Ubah Jadwal** membuka grid yang sama dengan `?reschedule=<id>`. Hanya ruang yang sama yang tampil dan
   durasinya tetap, jadi cukup klik jam mulai baru.

## Akun staf

Staf baru dibuat pengelola pusat lewat `POST /staff` dengan password sementara. Login pertama langsung diarahkan
ke `/change-password` dan halaman lain tertutup sampai password diganti. Isi dashboard pengelola mengikuti
`user.permissions`. Resepsionis hanya melihat validasi QR dan booking hari ini. Pengelola pusat juga melihat
ringkasan operasional, booking 7 hari dan antrean refund.

## Pemeriksaan

```bash
npm run lint
npm run build
```
