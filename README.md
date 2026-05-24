# ConstructAI — Smart Construction Management System

A full-stack construction management platform with AI-assisted scheduling, materials tracking, labour management, and cost prediction.

## Architecture

```
constructai/
├── apps/
│   ├── api/          FastAPI backend  (Python 3.12, SQLAlchemy 2, PostgreSQL)
│   ├── web/          Next.js 15 frontend  (React, TanStack Query, Tailwind)
│   └── mobile/       Expo React Native app  (Expo SDK 52, expo-router 4)
└── packages/
    └── shared/       Shared TypeScript types (web ↔ mobile)
```

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.12+ | API runtime |
| Node.js | 20+ | Web & mobile build |
| PostgreSQL | 15+ | Database |
| Expo Go app | latest | Mobile preview (iOS/Android) |

---

## Quick Start

### 1. Database

Start PostgreSQL and create the database:

```sql
CREATE DATABASE constructai;
CREATE USER constructai WITH PASSWORD 'constructai_dev';
GRANT ALL PRIVILEGES ON DATABASE constructai TO constructai;
```

Or with Docker:
```bash
docker run -d --name constructai-db \
  -e POSTGRES_DB=constructai \
  -e POSTGRES_USER=constructai \
  -e POSTGRES_PASSWORD=constructai_dev \
  -p 5432:5432 postgres:15
```

### 2. API

```bash
cd apps/api

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (Linux/Mac)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migration
alembic upgrade head

# Seed demo data
python scripts/seed.py

# Start API server
uvicorn app.main:app --reload --port 8000
```

API will be available at:
- **Base:** http://localhost:8000
- **Docs:** http://localhost:8000/api/docs
- **Health:** http://localhost:8000/api/v1/health

### 3. Web App

```bash
cd apps/web

# Install dependencies
npm install

# Start development server
npm run dev
```

Web app at **http://localhost:3000**

### 4. Mobile App

```bash
cd apps/mobile

# Install dependencies
npm install

# Start Expo dev server
npm start
```

- Scan the QR code with **Expo Go** (iOS App Store / Google Play)
- For Android emulator: press `a`
- For iOS simulator: press `i`

> **Android emulator note:** Change `API_BASE` in `src/services/api.ts` from `localhost` to `10.0.2.2`

---

## Demo Credentials

| Role | Email | Password |
|------|-------|---------|
| Project Manager | `pm@constructai.lk` | `demo1234` |
| Site Supervisor | `supervisor@constructai.lk` | `demo1234` |
| Admin | `admin@constructai.lk` | `demo1234` |

---

## Demo Project

The seed creates a realistic two-storey residential construction project:

- **Project:** Two-Storey House, Colombo, Sri Lanka
- **Budget:** LKR 12,000,000
- **Duration:** 120 days
- **Tasks:** 12 tasks with dependencies and progress tracking
- **Workers:** 12 workers across 5 skill types
- **Materials:** 15 material items with stock levels
- **Alerts:** Mix of critical, warning, and info severity

---

## Features

### Web (Next.js 15)

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | JWT auth with error handling |
| Dashboard | `/dashboard` | KPIs, alerts, budget risk widget |
| Projects | `/projects` | Project list + create modal |
| Schedule | `/schedule` | Custom CSS Gantt chart |
| Materials | `/materials` | Inventory + transaction modal |
| Labour | `/labour` | Workers + attendance marking |
| Payroll | `/payroll` | Payroll runs + line detail |
| Costs | `/costs` | Budget vs actual + prediction |
| Alerts | `/alerts` | Alert list + dismiss |
| Settings | `/settings` | Profile + project info |

### Mobile (Expo React Native)

| Screen | Description |
|--------|-------------|
| Home | Live KPI cards + quick actions |
| Tasks | Task list with progress bars |
| Scan | QR code scanner for worker check-in |
| Attendance | Daily attendance marking |
| Alerts | Alert list with dismiss |

### API (FastAPI)

49 REST endpoints across 8 modules:
- **Auth** — Login, token refresh, `/me`
- **Projects** — CRUD + dashboard aggregate
- **Tasks** — CRUD, progress updates, Gantt data, delay propagation
- **Materials** — Inventory, transactions (with negative stock guard)
- **Labour** — Workers, attendance (QR scan + manual), payroll generation
- **Costs** — Budget items, expenses, ML-style prediction
- **Alerts** — List, mark read, mark all read

---

## Environment Variables

### API (`apps/api/.env`)
```env
DATABASE_URL=postgresql+psycopg://constructai:constructai_dev@localhost:5432/constructai
JWT_SECRET_KEY=change-this-in-production
CORS_ORIGINS=["http://localhost:3000","http://localhost:8081"]
```

### Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Mobile (`apps/mobile/.env`)
```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI 0.115, SQLAlchemy 2.0, Pydantic v2, Alembic |
| Database | PostgreSQL 15, psycopg3 |
| Auth | JWT (python-jose), bcrypt |
| Web | Next.js 15 App Router, React 19, Tailwind CSS |
| State | TanStack Query v5 (server state), React Context (auth) |
| Mobile | Expo SDK 52, Expo Router 4, expo-camera |
| Monorepo | npm workspaces |

---

## Key Design Decisions

- **Single active project** — `useActiveProject()` always picks the first project; enables clean mobile UX without a project switcher
- **Rule-based cost prediction** — `predicted_final = actual / (progress/100) + risk_buffer_per_delayed_task`; interpretable V1 model
- **Recursive delay propagation** — scheduling service's `_push_successors()` cascades delays through the task dependency graph
- **Negative stock guard** — material transaction endpoint returns HTTP 400 if stock would go negative (except `adjustment` type)
- **QR scan deduplication** — `scanLock` ref prevents double-submission during API round-trip
