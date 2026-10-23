# Claude Memory — Cakra Space (SDLC Kelompok 5)

## Informasi Proyek & Arsitektur
- **Aplikasi**: Cakra Space (Coworking Space Management System)
- **Frontend**: React 18, Vite, Tailwind CSS (`cakra-space-fe/`)
- **Backend**: FastAPI Python 3.12 (`cakra-space-fe/backend/`)
- **Jira Project**: `SCRUM` (`https://azharkhairaa.atlassian.net/jira/software/projects/SCRUM/boards/1`)
- **Assignee**: Muhammad Azhar Khaira (`5dde213aba60e10cfd674e64`) - 64 items (5 Epics, 26 Stories, 33 Subtasks).

## Status Implementasi
- Frontend: 100% Epic 1-10 selesai. Lolos `npm run lint` & `npm run build`.
- Backend: 52 endpoints aktif. Lolos seluruh 72 `pytest` tests & `ruff`.
- Git: Branch `main`. Menunggu eksekusi commit & push.

## Perintah Kerja
- Frontend Dev: `npm run dev`
- Frontend Build/Lint: `npm run lint && npm run build`
- Backend Dev: `source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`
- Backend Tests: `pytest`
- Git: `git add . && git commit -m "feat(fe): complete all member and manager UI features for Epic 1-10" && git push origin main`
