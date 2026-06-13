# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

微迹OA (WeiJiOA) — a full-stack Chinese-language office automation system for a hardware sales/repair business. Two-directory layout: `backend/` (Python FastAPI) and `frontend/` (React + TypeScript Vite SPA). In production, FastAPI serves the built frontend from `frontend/dist/`.

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

**Default dev credentials**: `admin@weiji.local` / `admin`

No test framework is configured. Alembic config exists but is unused — database schema changes are handled by manual migration logic in `backend/models/init_db.py` (see Database Migrations below).

## Architecture

### Backend (Python / FastAPI)

- **Entry point**: `backend/main.py` — mounts routers, middleware, static file serving. On startup, `init_db()` creates tables and runs migrations, `seed_knowledge()` populates defaults.
- **Middleware stack** (applied in order): `RateLimitMiddleware` (600 req/60s, exempts localhost) → `request_log_middleware` (logs to `backend/logs/requests.log`) → `company_guard` → CORS
- **Database**: SQLAlchemy 2.0 with `backend/models/base.py` providing `Engine`, `SessionLocal`, `Base`. SQLite by default (stored as `data.db` in project root); PostgreSQL via `DATABASE_URL` env var. Custom `JSONType` auto-selects JSONB on Postgres, TEXT on SQLite.
- **Database migrations**: Alembic config exists but is stale/unused. Schema changes are managed via raw SQL in `backend/models/init_db.py`'s `_migrate_db()` function — add ALTER TABLE / CREATE TABLE statements there. This handles SQLite limitations (no DROP COLUMN, etc.) by rebuilding tables when needed.
- **Auth**: `backend/auth.py` — JWT (python-jose) + bcrypt, 8-hour token expiry. Role-based with fine-grained permissions (`tickets:view`, `tickets:edit`, etc.). Three built-in roles: `admin`, `technician`, `customer`. Admin role bypasses all permission checks. Row-level access via `owner_filter()` / `apply_owner_filter()` (non-admins see only their own records).
- **Multi-tenancy**: `backend/middleware/company_guard.py` — most models have `company_id` foreign keys; actual tenant isolation is enforced per-router via query scoping (the middleware is a pattern enforcer, not an active filter).
- **Routers**: ~31 FastAPI routers in `backend/routers/`, one per business domain
- **Schemas**: Pydantic v2 models in `backend/schemas/`
- **Services**: Business logic in `backend/services/` (audit, notifications, DingTalk sync, subscriptions, charges)
- **File storage**: `backend/storage.py` — abstract `StorageBackend` with Local and S3 (Tencent COS / AWS S3 / MinIO) implementations. Switch via `STORAGE_BACKEND=s3`. Local uploads stored in `uploads/` at project root.
- **WebSocket**: `backend/websocket/manager.py` — `ConnectionManager` singleton for per-user push notifications via `/ws/{user_id}`
- **Subscription guard**: `subscription_write_guard` middleware blocks writes for expired subscriptions

### Frontend (React 18 / TypeScript / Vite)

- **Routing**: React Router DOM v7 in `src/App.tsx`. `ProtectedRoute` checks JWT validity (including expiration). Routes are dynamically generated from `MODULE_REGISTRY`.
- **API layer**: `src/api/client.ts` — Axios instance with auto Bearer token injection from `localStorage` and smart 401 handling. Per-domain API files in `src/api/`.
- **State management**: No external store. `useState` + `localStorage` (token/user) + custom hooks (`useAuth`, `useWebSocket`).
- **Layout**: `src/components/AppLayout.tsx` — sidebar navigation, content area, props drilling for auth context.
- **Module registry**: `src/config/moduleRegistry.ts` (frontend) mirrors `backend/models/module_registry.py` (backend). Both are the Single Source of Truth for configurable business modules (tickets, return/exchange, repair, gifts, cashback, gift resend) — defining fields, permissions, routing, and display metadata. Icons use lucide-react via `ICON_MAP` in the frontend registry.
- **Styling**: Tailwind CSS 3.4 with custom primary color palette in `tailwind.config.js`. No CSS modules.
- **Types**: Shared TypeScript interfaces in `src/types/index.ts`

### Key Config Files

| File | Purpose |
|---|---|
| `backend/config.py` | DB URL, JWT secret, CORS origins, SaaS/Alipay settings |
| `backend/models/permissions.py` | Permission constants and default role assignments |
| `backend/models/init_db.py` | Table creation, schema migrations (raw SQL), seed data |
| `backend/models/module_registry.py` | Configurable business module definitions (backend SSOT) |
| `frontend/src/config/moduleRegistry.ts` | Configurable business module definitions (frontend SSOT) |
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
- Adding a new module requires updates in **both** the backend (`backend/models/module_registry.py`) and frontend (`frontend/src/config/moduleRegistry.ts`) module registries, plus a new model/router/schema/page
- The `company_guard` middleware means most queries must be scoped to `company_id`
- Auth permissions are checked via `require_permission` dependency in backend routers and `useAuth().hasPermission()` hook in frontend. Admin role bypasses all checks.
- Row-level data filtering uses `owner_filter()` / `apply_owner_filter()` from `auth.py` — non-admins see only their own records
- Database sessions in routers use `Depends(get_db)` from `database.py`, not `SessionLocal()` directly
- File uploads go through `backend/storage.py` — don't write direct file I/O for uploads
- Schema changes: add raw SQL migration steps to `backend/models/init_db.py` `_migrate_db()`, not alembic
- Navigation sidebar groups and their permission requirements are defined in `AppLayout.tsx`; dynamic module items are merged in at runtime from `/api/module-configs`
- After editing frontend code, run `npm run build` (from `frontend/`) before restarting the backend — FastAPI serves from `frontend/dist/`, not the dev server
- To restart the backend: kill the process on port 8000, then `cd backend && python main.py`
- WebSocket endpoint is `/ws/{user_id}` — used for real-time notifications (new tickets, status changes, etc.)
- The `ReturnExchangeRecord` model uses JSON columns for `damage_items` (array of `{name, amount, desc}`) — follow this same pattern for any new array-type fields
