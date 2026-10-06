# Cloud-Based Virtual Lab Management System

A college micro-project prototype for the SIH Smart Education theme.

## Features
- Student and faculty/admin login
- Role-based dashboards
- Lab catalog and lab launch/stop
- Virtual machine/container provisioning simulation
- Optional real Docker container provisioning
- Browser-based lab terminal (safe demo shell/Python commands)
- File upload/delete and storage quota tracking
- Admin lab and user monitoring
- JWT authentication and password hashing
- REST API

## Requirements
- Node.js 18+
- npm
- Docker Desktop (optional; required only for real container provisioning)

## Run
```bash
cd backend
npm install
npm start
```
Then open http://localhost:5000

Demo accounts:
- Student: student@vlab.com / Student@123
- Faculty: faculty@vlab.com / Faculty@123

## Optional Docker mode
Set `USE_DOCKER=true` in backend/.env and make sure Docker Desktop is running.
If Docker is unavailable, the application automatically uses a simulated provisioning mode.

## Project structure
- `backend/` Express REST API and persistence
- `frontend/` responsive single-page web UI
- `docs/` architecture and viva notes
