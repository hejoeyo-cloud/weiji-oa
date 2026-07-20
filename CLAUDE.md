# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

微迹OA (WeiJiOA) — a full-stack Chinese-language office automation system for a hardware sales/repair business. Two-directory layout: `backend/` (Python FastAPI) and `frontend/` (React + TypeScript Vite SPA). In production, FastAPI serves the built frontend from `frontend/dist/`.

The system covers: ticket management, return/exchange & repair registration, shipping/cost/profit tracking, cashback ledger, gift resend, warehouse (products/inbound/outbound/factory-return), finance (invoice requests / sales / purchase / expense invoices), approvals, scheduling, attendance (with DingTalk sync), announcements, internal messages, task board, product catalog, knowledge base, reports, and a configurable module system.

## Development Commands

**Frontend** (run from `frontend/`):
```bash
npm run dev        # Vite dev server on :5173 (proxies /api → :8000, /ws → ws://:8000)
npm run build      # TypeScript compile + Vite production build
npm run lint       # ESLint
```

**Backend** (run from `backend/`):
```bash
python main.py     # Uvicorn on :8000 (0.0.0.0), auto-reload via __main__
```

**Default dev credentials**: `admin@weiji.local` / `admin`

No test framework is configured. Alembic config exists but is unused — database schema changes are handled by manual migration logic in `backend/models/init_db.py` (see Database Migrations below).

**Client deployment build** (源码分发，客户需要 Python 环境):
```bash
python build_deploy.py                  # 一键构建（前端构建 + 复制源码 + 打包 zip）
python build_deploy.py --skip-npm       # 跳过前端构建，只更新源码和 zip
```
The packaged executable loads `license.lic` from the same directory. The `build.spec` auto-collects backend modules, bundles `frontend/dist/` and `public.pem`, and excludes heavy packages (numpy, pandas, matplotlib, tkinter). `build_deploy.py` orchestrates the full pipeline: builds frontend, copies backend source code, syncs `version.json`, and packages the zip.

## Architecture

### Backend (Python / FastAPI)

- **Entry point**: `backend/main.py` — mounts routers, middleware, static file serving. On startup (lifespan): `init_db()` creates tables and runs migrations, `seed_knowledge()` populates defaults, license status is checked and printed, APScheduler starts (3AM daily backup, 4AM daily data cleanup), and an immediate backup runs once.
- **Middleware stack** (applied in order): `RateLimitMiddleware` (600 req/60s, burst 30, exempts localhost) → `LicenseGuardMiddleware` (blocks writes when expired, all requests when locked) → `request_log_middleware` (logs to `backend/logs/requests.log`) → CORS
- **Database**: SQLAlchemy 2.0 with `backend/models/base.py` providing `Engine`, `SessionLocal`, `Base`. SQLite by default (stored as `data.db` in project root); PostgreSQL via `DATABASE_URL` env var. Custom `JSONType` auto-selects JSONB on Postgres, TEXT on SQLite.
- **Database proxy**: `backend/database.py` is a thin re-export layer over `models/` for backward compatibility — imports all model classes and exposes `get_db()`, `Base`, `SessionLocal`, `ALL_PERMISSIONS`, etc.
- **Database migrations**: Alembic config exists but is stale/unused. Schema changes are managed via raw SQL in `backend/models/init_db.py`'s `_migrate_db()` function — add ALTER TABLE / CREATE TABLE statements there. This handles SQLite limitations (no DROP COLUMN, etc.) by rebuilding tables when needed.
- **Auth**: `backend/auth.py` — JWT (python-jose) + bcrypt (direct, not passlib), 8-hour token expiry (configurable via `JWT_EXPIRE_MINUTES`). Role-based with fine-grained permissions (`tickets:view`, `tickets:edit`, etc.). Three built-in roles: `admin`, `technician`, `customer`. Admin role bypasses all permission checks. `get_current_user_flexible` supports both `Authorization` header and `?token=` query param (for iframe/img/a elements that can't carry headers). Platform admin (`is_platform_admin` flag) is a separate super-admin concept above regular roles.
- **Multi-tenancy**: Removed. `company_guard` middleware is deleted. `company_id` columns remain in the schema (SQLite can't drop columns easily) but are unused. New code should not reference `company_id` or `is_platform_admin`.
- **Routers**: 35 FastAPI routers in `backend/routers/`, one per business domain (see full list in Routers section below)
- **Schemas**: Pydantic v2 models in `backend/schemas/`
- **Services**: Business logic in `backend/services/` — `audit_service.py`, `notification_service.py`, `dingtalk_sync.py`, `cache.py`, `charge_service.py`, `data_cleanup.py` (audit log archiving + notification cleanup)
- **File storage**: `backend/storage.py` — abstract `StorageBackend` with Local and S3 (Tencent COS / AWS S3 / MinIO) implementations. Switch via `STORAGE_BACKEND=s3`. Local uploads stored in `uploads/` at project root. File serving via `/api/files/{path}` endpoint (auth required).
- **WebSocket**: `backend/websocket/manager.py` — `ConnectionManager` singleton for per-user push notifications via `/ws/{user_id}`. Client sends `{"type":"ping"}`, server responds `{"type":"pong"}`.
- **License system**: `backend/license.py` + `backend/middleware/license_guard.py` — RSA-signed license file (`license.lic`) verified against `backend/keys/public.pem`. States: `active` (full access), `expired` (read-only — GET/HEAD/OPTIONS allowed, writes blocked), `locked` (all API requests blocked). Login and license-status endpoints are always exempt. License generation tool: `tools/gen_license.py` (requires `backend/keys/private.pem`).
  - **Deployment mode detection**: `license.py` detects whether it's running from source (dev) or a packaged build (deployment). In deployment mode, `LICENSE_REQUIRED` is **hardcoded to True** — no license file means system is locked, regardless of environment variables. This prevents customers from bypassing the license by deleting `license.lic` or setting env vars.
- **Scheduled tasks**: APScheduler runs in lifespan background — 3AM daily DB backup (`backup.py`, supports SQLite file-copy and PostgreSQL `pg_dump`), 4AM daily data cleanup (`services/data_cleanup.py` archives audit logs older than 6 months, cleans stale notifications). Backups stored in `backups/`, retained 30 days.

### Frontend (React 18 / TypeScript / Vite)

- **Routing**: React Router DOM v7 in `src/App.tsx`. `ProtectedRoute` checks JWT validity (including expiration). Routes are dynamically generated from `MODULE_REGISTRY`.
- **API layer**: `src/api/client.ts` — Axios instance with auto Bearer token injection from `localStorage` and smart 401 handling. Per-domain API files in `src/api/` (33 API modules mirroring backend routers).
- **State management**: No external store. `useState` + `localStorage` (token/user) + custom hooks (`useAuth`, `useWebSocket`).
- **Layout**: `src/components/AppLayout.tsx` — sidebar navigation, content area, props drilling for auth context.
- **Module registry**: `src/config/moduleRegistry.ts` (frontend) mirrors `backend/models/module_registry.py` (backend). Both are the Single Source of Truth for configurable business modules (tickets, return/exchange, repair, gifts, cashback, gift resend) — defining fields, permissions, routing, and display metadata. Icons use lucide-react via `ICON_MAP` in the frontend registry.
- **Styling**: Tailwind CSS 3.4 with custom primary color palette in `tailwind.config.js`. No CSS modules. `tailwindcss-animate` for transitions.
- **Types**: Shared TypeScript interfaces in `src/types/index.ts`
- **Rich text**: `react-quill-new` for knowledge base article editing
- **Charts**: `recharts` for reports/dashboards
- **Excel export**: `xlsx` library, client-side export (see Conventions)

### Key Config Files

| File | Purpose |
|---|---|
| `backend/config.py` | DB URL, JWT secret/expiry, CORS origins, server host/port |
| `backend/models/permissions.py` | Permission constants (`ALL_PERMISSIONS`), permission groups, default role seed data |
| `backend/models/init_db.py` | Table creation, schema migrations (raw SQL), seed data |
| `backend/models/module_registry.py` | Configurable business module definitions (backend SSOT) |
| `frontend/src/config/moduleRegistry.ts` | Configurable business module definitions (frontend SSOT) |
| `backend/license.py` | License verification logic (RSA signature, expiry, lock state) |
| `backend/keys/public.pem` | Public key for license verification (committed) |
| `backend/keys/private.pem` | Private key for license signing (gitignored) |
| `frontend/vite.config.ts` | Dev proxy rules, build config |
| `frontend/tailwind.config.js` | Custom design tokens |
| `tools/gen_license.py` | License file generator (requires private key) |
| `tools/migrate_to_pg.py` | SQLite → PostgreSQL migration utility |
| `build.spec` | PyInstaller 打包配置（客户交付用） |
| `build_deploy.py` | 一键构建部署包脚本（前端构建 → 打包 → 组装 → 自动同步 version.json） |

## Branch Strategy

**当前只有 `main` 一个主分支**（`local-edition` 已合并入 `main`，不再维护）。

项目定位为**单机本地部署版**（SQLite + 本地文件存储 + License 授权）。已执行的精简（2026-06-28）：

### 已删除/精简的代码
- ✅ `backend/storage.py` 的 `S3Storage` 类 — 已删除，`get_storage()` 简化为只返回 `LocalStorage`
- ✅ `backend/middleware/company_guard.py` — 已删除（空壳 no-op 中间件）
- ✅ `backend/schemas/auth.py` 的 `RegisterRequest` — 已删除（SaaS 自注册遗留）
- ✅ `auth.py` 的 `require_platform_admin()` / `owner_filter()` — 已删除；`is_platform_admin()` 改为 `return False`
- ✅ router 中的 `is_platform_admin` / `company_id` 过滤分支 — 已移除（role/user/department/audit_log/auth router）
- ✅ schemas/auth.py 中的 `company_id` / `company_name` / `is_platform_admin` 字段 — 已移除
- ✅ 前端 `types/index.ts`、`AppLayout.tsx` — 同步精简

### ⚠️ 必须保留的业务功能（非多租户概念）
- 🔒 **`bound_shops` 店铺数据权限**：业务级的店铺数据隔离机制，运营等角色绑定特定店铺后只能查看绑定店铺的数据。`apply_owner_filter()`、`Role.bound_shops`、schemas/role.py、前端 UserManage.tsx 的店铺权限 UI 均已恢复保留。**不要删除**。

### 完整保留的代码
- 🔒 **License 授权系统**（`license.py` + `license_guard.py` + `license_router.py` + `keys/` + 前端 `LicenseBanner`）— 本地部署交付的核心机制
- 🔒 **PostgreSQL 支持代码**（`base.py` JSONType PG 分支 / `backup.py` pg_dump 分支 / `config.py` DATABASE_URL / `tools/migrate_to_pg.py`）— 用户计划后续迁移到 PG
- 🔒 **数据库 schema 层的多租户字段**（`company_id` / `companies` 表 / `Company` 模型 / `shops` 表 / `is_platform_admin` 字段 / `bound_shops` 字段）— SQLite 删列困难，**保留字段但不再使用**

### 新功能开发约束
- 新功能按单租户思路实现，**不要依赖** `company_id` / `is_platform_admin`
- `auth.is_platform_admin()` 保留函数签名但始终返回 `False`
- **`bound_shops` 是业务功能，正常使用**（`apply_owner_filter` 按店铺过滤数据）

## Conventions

- Business modules follow a consistent pattern: model in `backend/models/`, router in `backend/routers/`, schema in `backend/schemas/`, API client in `frontend/src/api/`, page in `frontend/src/pages/`
- Adding a new module requires updates in **both** the backend (`backend/models/module_registry.py`) and frontend (`frontend/src/config/moduleRegistry.ts`) module registries, plus a new model/router/schema/page
- No multi-tenant filtering needed — queries are not scoped by `company_id`
- Auth permissions are checked via `require_permission` dependency in backend routers and `useAuth().hasPermission()` hook in frontend. Admin role bypasses all checks. Permission constants are in `backend/models/permissions.py` — add new permissions to `ALL_PERMISSIONS` and `PERMISSION_GROUPS` there.
- User model has `is_manager` boolean field — used for department-level access control (e.g., attendance records). This is separate from role permissions.
- Row-level data filtering uses `owner_filter()` / `apply_owner_filter()` from `auth.py`. `apply_owner_filter` filters by **shop binding**: roles with `bound_shops` restrict queries to records whose `shop_name` matches a bound shop. Admins and roles with no shop binding see all data.
- Database sessions in routers use `Depends(get_db)` from `database.py`, not `SessionLocal()` directly
- File uploads go through `backend/storage.py` — don't write direct file I/O for uploads. File retrieval via `GET /api/files/{filepath}` (uses `get_current_user_flexible` to support `<img>`/`<iframe>` with `?token=`).
- Schema changes: add raw SQL migration steps to `backend/models/init_db.py` `_migrate_db()`, not alembic
- Navigation sidebar groups and their permission requirements are defined in `AppLayout.tsx`; dynamic module items are merged in at runtime from `/api/module-configs`
- After editing frontend code, run `npm run build` (from `frontend/`) before restarting the backend — FastAPI serves from `frontend/dist/`, not the dev server. For customer deployment, run `pyinstaller build.spec --clean` after building frontend.
- To restart the backend: kill the process on port 8000, then `cd backend && python main.py`
- **Deployment package**: Run `python build_deploy.py` from project root — it automates: frontend build (`npm run build`) → copy backend source, frontend dist, tools, and root files into `微迹OA系统-部署包/weijioa-deploy/` → create `weijioa-deploy.zip`. The script **automatically syncs `version.json` from root** into the deployment package, preventing version mismatch bugs. Options: `--skip-npm` (skip frontend build), `--skip-zip` (skip zipping). The customer places `license.lic` next to the exe.
- WebSocket endpoint is `/ws/{user_id}` — used for real-time notifications (new tickets, status changes, etc.)
- The `ReturnExchangeRecord` model uses JSON columns for `damage_items` (array of `{name, amount, desc}`) — follow this same pattern for any new array-type fields
- **Field options system**: `backend/models/field_option.py` provides a generic per-company key-value store for dropdown presets. `field_name` distinguishes categories (e.g., `model`, `config`, `color`, `accessories`). The `FieldSelect` component (`frontend/src/components/FieldSelect.tsx`) is the frontend consumer — it auto-loads options for a given `fieldName` and renders a searchable dropdown with management modal. The `color` field_name additionally supports `color_code` for visual swatches.
- **Visibility pattern for attendance/records**: Use `is_manager` (boolean on User model) for department-level visibility and `attendance:manage` permission for company-wide visibility. The `_build_records_query` pattern in `attendance_router.py` shows how to scope queries: `has_manage` → full company, `is_manager` → department, else → self only.
- **Frontend Excel export**: Export is done client-side using the `xlsx` library (see `GiftList.tsx` or `AttendancePage.tsx`). The backend supports `all=true` query parameter on list endpoints to return unpaginated data for export. Use the `exportToExcel()` helper pattern.
- **Attendance-schedule integration**: `AttendanceRecord` has `scheduled_start`/`scheduled_end` fields that snapshot the shift times at check-in. The `ScheduleSlot` + `ScheduleShift` models define who works when. Check-in logic queries the user's slot for the day and uses the shift's `start_time`/`end_time` for late/early detection. DingTalk attendance sync takes priority over manual check-in.
- **License enforcement**: All write operations (`POST`/`PUT`/`DELETE`) are blocked when license is `expired`; all API requests are blocked when `locked`. The frontend reads `X-License-Status` response header and shows a `LicenseBanner`. License-related and login endpoints are always exempt.
- **File deduplication**: Uploaded files use SHA-256 hash fingerprinting with reference counting for storage efficiency.

## Backend Routers (35)

| Prefix | Router file | Domain |
|---|---|---|
| `/api/auth` | `auth_router.py` | Login, current user, token refresh |
| `/api/tickets` | `ticket_router.py` | Ticket CRUD + processing flow + feedback |
| `/api/users` | `user_router.py` | User management |
| `/api/departments` | `department_router.py` | Department management |
| `/api/roles` | `role_router.py` | Role + permission management |
| `/api/knowledge` | `knowledge_router.py` | Knowledge base (categories/articles/search) |
| `/api/after-sales` → split | `return_exchange_router.py` | Return/exchange registration |
| `/api/repair` | `repair_router.py` | Repair registration |
| `/api/gifts` | `gift_router.py` | Shipping registration (cost/profit/cashback) |
| `/api/gift-cashback` | `gift_cashback_router.py` | Cashback ledger (per order) |
| `/api/gift-resend` | `gift_resend_router.py` | Gift resend registration |
| `/api/gift-presets` | `gift_preset_router.py` | Shipping preset options |
| `/api/gift-resend-presets` | `gift_resend_preset_router.py` | Gift resend preset options |
| `/api/warehouse` | `warehouse_router.py` | Warehouse (products/inbound/outbound/factory-return) |
| `/api/finance` | `finance_router.py` | Finance (invoice requests/sales/purchase/expense) |
| `/api/announcements` | `announcement_router.py` | Announcements + read tracking |
| `/api/approvals` | `approval_router.py` | Approval workflow (leave/reimbursement/purchase) |
| `/api/approval-rules` | `approval_rules_router.py` | Approval rule configuration |
| `/api/schedule` | `schedule_router.py` | Scheduling (calendar/batch/swap) |
| `/api/attendance` | `attendance_router.py` | Attendance check-in + records |
| `/api/dingtalk` | `dingtalk_router.py` | DingTalk attendance sync config |
| `/api/tasks` | `task_router.py` | Task board (kanban) |
| `/api/messages` | `messages_router.py` | Internal messages/mail |
| `/api/products` | `product_router.py` | Product catalog |
| `/api/shops` | `shop_router.py` | Shop management |
| `/api/customers` | `customer_router.py` | Customer profiles |
| `/api/reports` | `report_router.py` | Data reports/analytics |
| `/api/dashboard` | `dashboard_router.py` | Dashboard aggregation (role-based cards + shortcuts) |
| `/api/module-configs` | `module_config_router.py` | Module configuration (enable/disable/customize) |
| `/api/field-options` | `field_option_router.py` | Dropdown option presets |
| `/api/sidebar-badges` | `sidebar_badge_router.py` | Sidebar notification badges |
| `/api/notifications` | `notification_router.py` | WebSocket push notifications |
| `/api/audit-logs` | `audit_log_router.py` | Operation audit logs |
| `/api/upload` | `upload_router.py` | File upload (dedup via SHA-256) |
| `/api/license` | `license_router.py` | License status & management |

## Backend Models (`backend/models/`)

Organized by domain module:
- `user.py` — User, Role (with `permissions` JSON + `bound_shops` JSON)
- `company.py` — Company, Shop
- `ticket.py` — Ticket, TicketFeedback
- `aftersales.py` — ReturnExchangeRecord, RepairRecord, AfterSalesChargeRequest + feedback tables
- `gift.py` — GiftRecord (with order_amount/cost/profit), GiftCashback, GiftResendRecord + feedback tables
- `warehouse.py` — WarehouseProduct, WarehouseInbound, WarehouseOutbound + feedback tables
- `finance.py` — CustomerInvoiceRequest, SalesInvoice, PurchaseInvoice, ExpenseInvoice
- `approval.py` — ApprovalRequest, ApprovalStep
- `schedule.py` — ScheduleShift, ScheduleSlot, ShiftSwapRequest
- `attendance.py` — AttendanceRecord (DingTalk sync priority)
- `announcement.py` — Announcement, AnnouncementRead
- `message.py` — Message (internal mail)
- `task.py` — Task (kanban board)
- `product.py` — Product catalog
- `knowledge.py` — KnowledgeCategory, KnowledgeArticle
- `notification.py` — Notification
- `audit.py` — AuditLog, AuditLogArchive
- `field_option.py` — FieldOption (generic dropdown presets)
- `module_registry.py` — Configurable module definitions (backend SSOT)
- `permissions.py` — ALL_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLES
- `misc.py` — Miscellaneous models
- `base.py` — Engine, SessionLocal, Base, JSONType
- `init_db.py` — Table creation + raw SQL migrations + seed data
- `seed_modules.py` — Module seed data
