# CLAUDE.md — Memory & Panduan Proyek Cakra Space

Dokumen ini adalah memori proyek persisten untuk Claude Code dan Claude AI Assistant terkait proyek **Cakra Space (Coworking Space Management System)** untuk mata kuliah SDLC Kelompok 5.

Terakhir diperbarui: **23 Oktober 2026**.

---

## 1. Ringkasan Proyek & Arsitektur
- **Nama Proyek**: Cakra Space
- **Deskripsi**: Sistem manajemen coworking space multi-gedung mencakup pemesanan ruang/meja, validasi akses QR dinamis, membership langganan, manajemen keuangan (deposit & tunggakan), pelaporan pendapatan, dan administrasi peran staf (RBAC).
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Axios. Berlokasi di direktori root `cakra-space-fe/`.
- **Backend**: FastAPI (Python 3.12), Pydantic v2, Pytest, Uvicorn. Berlokasi di `backend/`.
- **Data Store**: Berkas JSON lokal `backend/data/cakraspace.json` yang di-generate melalui `python -m app.seed`.

---

## 2. Jira Board (`SCRUM`) & Pembagian Tugas
- **Jira Board URL**: `https://azharkhairaa.atlassian.net/jira/software/projects/SCRUM/boards/1`
- **Total Komponen Terdaftar di Jira**:
  - **5 Sprints**: Sprint 1 s.d. Sprint 5
  - **10 Epics**: `SCRUM-5` s.d. `SCRUM-14` (Epic 1 s.d. Epic 10)
  - **46 User Stories**: `SCRUM-15` s.d. `SCRUM-60`
  - **191 Subtasks**: `SCRUM-61` s.d. `SCRUM-251` (Technical Tasks BE, FE, QA, PO)
- **Assignee Muhammad Azhar Khaira**:
  - Jira Account ID: `5dde213aba60e10cfd674e64`
  - Total: **64 item** (5 Epics, 26 User Stories, 33 Subtasks) telah ter-assign ke Azhar Khaira.
  - Status saat ini: Default `To Do`, siap dipindahkan ke `In Progress` / `Done`.

---

## 3. Status Terkini Implementasi (Status: Selesai 100%)

### Frontend (`src/`)
- **Fitur Member**:
  - `BookingConfirm.jsx`: Undangan tamu rapat dengan QR satu kali pakai yang dikirim via email (`K5-US-006.2`).
  - `Dashboard.jsx`: Daftar invoice dengan status & download PDF (`K5-US-008.3`), edit profil & reminder H-24/H-1 (`K5-US-004.5`), serta ubah email dengan password (`K5-US-008.4`).
  - `BuildingDetail.jsx` & `FloorPlanMap.jsx`: Denah lantai interaktif dengan pin area, status ketersediaan, serta filter tipe ruang & kapasitas (`K5-US-003.4`, `K5-US-004.1`).
  - `Membership.jsx`: Pembelian paket baru, perpanjangan H-7, upgrade prorata, jadwal downgrade, freeze/unfreeze membership (`K5-US-007.1` s.d. `007.4`).
- **Fitur Pengelola (`AdminDashboard.jsx`)**:
  - Kalender booking harian/mingguan dengan filter lantai & tipe area (`K5-US-004.6`).
  - Antrean & riwayat persetujuan refund (`K5-US-005.4`, `FE-39`, `FE-40`).
  - `FinanceManager.jsx`: Manajemen deposit barang member (held/returned), tunggakan pembayaran (unpaid/paid/overdue), dan pengaturan tarif pajak PPN (`K5-US-005.5`, `K5-US-005.6`).
  - `ReportSection.jsx`: Laporan pendapatan kotor/bersih per bulan & per gedung, laporan pertumbuhan member baru/aktif/churn, serta ekspor laporan `.xlsx` dan `.pdf` (`K5-US-009.2`, `K5-US-009.3`, `K5-US-009.4`).
  - `StaffAndAnnouncementManager.jsx`: Pengumuman gedung per lokasi, CRUD akun staf dengan password sementara sekali tampil, dan matriks hak akses RBAC (`K5-US-008.4`, `K5-US-006.4`).
  - `AreaManager.jsx`: Denah interaktif mode edit untuk menentukan koordinat pin `(pos_x, pos_y)` pada kanvas denah lantai (`FE-61`).
- **Verifikasi**: `npm run lint` (0 error, 0 warning) & `npm run build` (sukses).

### Backend (`backend/`)
- 52 Endpoint REST API (`BE-01` s.d. `BE-52`) lengkap.
- Pengujian otomatis: `pytest` -> **72 passed** in ~24s.
- Linter: `ruff check .` -> **Clean (All checks passed)**.

---

## 4. Perintah Penting (Cheat Sheet)

### Menjalankan Frontend
```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # ESLint
npm run build    # Production build
```

### Menjalankan Backend
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000   # Swagger: http://localhost:8000/docs
pytest                                     # 72 tests
ruff check .                               # Lint
python -m app.seed                         # Reset/seed sample database
```

### Git Command untuk Commit & Push Terakhir
```bash
git add .
git commit -m "feat(fe): complete all member and manager UI features for Epic 1-10"
git push origin main
```

---

## 5. Akun Uji Demo (Password: `CakraSpace2026`)
- **Pengelola Pusat**: `admin@cakraspace.id` (Akses semua gedung, paket, staf, laporan)
- **Pengelola Lokasi Sudirman**: `lokasi.sudirman@cakraspace.id`
- **Pengelola Lokasi Dago**: `lokasi.dago@cakraspace.id`
- **Resepsionis Dago**: `resepsionis.dago@cakraspace.id` (Scan QR & booking hari ini)
- **Member (Aktif)**: `budi@example.com`
- **Member (Refund)**: `sinta@example.com`
- **Member (Tunggakan)**: `dewi@example.com`
- **Kotak Masuk Email Uji**: Menu "Kotak Masuk Uji" di pojok kanan bawah aplikasi untuk melihat tautan verifikasi email, token reset password, dan QR undangan tamu.

---

## 6. Pekerjaan Selanjutnya (Next Steps)
1. Commit dan push perubahan frontend ke repository GitHub remote.
2. Update transisi status task di Jira (`SCRUM`) ke `In Progress` / `Done`.
3. Buat `Dockerfile` (FE & BE) dan `docker-compose.yml` untuk kemudahan pengujian kelompok/dosen.
4. Buat workflow CI otomatis `.github/workflows/ci.yml`.
5. Finalisasi laporan dokumen Word `K5 - Dokumentasi Pengembangan Produk (bahan salin v3).docx`.
