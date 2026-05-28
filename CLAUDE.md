# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fries OA — a full-stack Chinese-language office automation system for a hardware sales/repair business. Two-directory layout: `backend/` (Python FastAPI) and `frontend/` (React + TypeScript Vite SPA). In production, FastAPI serves the built frontend from `frontend/dist/`.

## Development Commands

**Frontend** (run from `frontend/`):
```bash
npm run dev        # Vite dev server on :5173 (proxies /api → :8000, /ws → ws://:8000)
npm run build      # TypeScript compile + Vite production build
npm run lint       # ESLint
```

**Backend** (run from `backend/`):
```bash
python main.py     # Uvicorn on :8000 with auto-reload
```

**Database migrations** (from `backend/`):
```bash
alembic upgrade head
alembic revision --autogenerate -m "description"
```

No test framework is configured.

## Architecture

### Backend (Python / FastAPI)

- **Entry point**: `backend/main.py` — mounts routers, middleware, static file serving
- **Database**: SQLAlchemy 2.0 with `backend/models/base.py` providing `Engine`, `SessionLocal`, `Base`. SQLite by default; PostgreSQL via `DATABASE_URL` env var. Custom `JSONType` auto-selects JSONB on Postgres.
- **Auth**: `backend/auth.py` — JWT (python-jose) + bcrypt. Role-based with fine-grained permissions (`tickets:view`, `tickets:edit`, etc.). Three built-in roles: `admin`, `technician`, `customer`.
- **Multi-tenancy**: `backend/middleware/company_guard.py` — most models have `company_id` foreign keys; middleware enforces tenant isolation.
- **Routers**: ~28 FastAPI routers in `backend/routers/`, one per business domain
- **Schemas**: Pydantic v2 models in `backend/schemas/`
- **Services**: Business logic in `backend/services/` (audit, notifications, DingTalk sync, subscriptions, charges)
- **File storage**: `backend/storage.py` — abstract `StorageBackend` with Local and S3 (Tencent COS / AWS S3 / MinIO) implementations. Switch via `STORAGE_BACKEND=s3`.
- **WebSocket**: `backend/websocket/` — `ConnectionManager` for per-user push notifications
- **Subscription guard**: `subscription_write_guard` middleware blocks writes for expired subscriptions

### Frontend (React 18 / TypeScript / Vite)

- **Routing**: React Router DOM v7 in `src/App.tsx`. `ProtectedRoute` checks JWT validity (including expiration). Routes are dynamically generated from `MODULE_REGISTRY`.
- **API layer**: `src/api/client.ts` — Axios instance with auto Bearer token injection from `localStorage` and smart 401 handling. Per-domain API files in `src/api/`.
- **State management**: No external store. `useState` + `localStorage` (token/user) + custom hooks (`useAuth`, `useWebSocket`).
- **Layout**: `src/components/AppLayout.tsx` — sidebar navigation, content area, props drilling for auth context.
- **Module registry**: `src/config/moduleRegistry.ts` (frontend) mirrors `backend/models/module_registry.py` (backend). Both are the Single Source of Truth for configurable business modules (return/exchange, repair, gifts, cashback, gift resend) — defining fields, permissions, routing, and display metadata.
- **Styling**: Tailwind CSS 3.4 with custom primary color palette in `tailwind.config.js`. No CSS modules.
- **Types**: Shared TypeScript interfaces in `src/types/index.ts`

### Key Config Files

| File | Purpose |
|---|---|
| `backend/config.py` | DB URL, JWT secret, CORS origins, SaaS/Alipay settings |
| `backend/models/permissions.py` | Permission constants and default role assignments |
| `frontend/vite.config.ts` | Dev proxy rules, build config |
| `frontend/tailwind.config.js` | Custom design tokens |

## Branch Strategy

| Branch | Purpose | Notes |
|---|---|---|
| `main` | Server deployment edition | SaaS/multi-tenant, PostgreSQL, S3 storage, subscription billing |
| `local-edition` | Local single-machine edition | SQLite, local file storage, no subscription, simplified auth |

- **main**: The primary production branch for server deployment. Features multi-tenancy, cloud storage, payment integration.
- **local-edition**: Standalone version for users deploying on a single machine. Uses SQLite, local filesystem, no subscription guard, simplified company setup.

When working on this project, check which branch you're on before making changes. Server-specific features should go to `main`; local-friendly features should go to `local-edition`.

## Conventions

- Business modules follow a consistent pattern: model in `backend/models/`, router in `backend/routers/`, schema in `backend/schemas/`, API client in `frontend/src/api/`, page in `frontend/src/pages/`
- Adding a new module requires updates in both the backend and frontend module registries
- The `company_guard` middleware means most queries must be scoped to `company_id`
- Auth permissions are checked via `require_permission` dependency in backend routers and `useAuth().hasPermission()` hook in frontend
- File uploads go through `backend/storage.py` — don't write direct file I/O for uploads
