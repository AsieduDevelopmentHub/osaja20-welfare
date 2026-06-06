# Installation Guide

## Prerequisites

- Node.js 20+
- pnpm 9+ (or `npx pnpm@9.15.0`)
- Python 3.11+
- Docker (for PostgreSQL & Redis)

## 1. Install frontend dependencies

```bash
npx pnpm@9.15.0 install
```

## 2. Start infrastructure (optional for local dev)

The API defaults to **SQLite** — no Docker required for local development.

For PostgreSQL + Redis (production-like setup):

```bash
cd infrastructure/docker
docker compose up -d postgres redis
```

Then set in `apps/api/.env`:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/osaja_welfare
```

## 3. Set up API virtual environment (local, not global)

**Windows (PowerShell):**

```powershell
.\scripts\setup-api-venv.ps1
```

**macOS / Linux:**

```bash
chmod +x scripts/setup-api-venv.sh
./scripts/setup-api-venv.sh
```

This creates `apps/api/.venv` and installs all Python dependencies inside it.

## 4. Configure API

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your database and optional Supabase credentials.

## 5. Run database migrations (optional)

With venv activated:

```bash
cd apps/api
alembic upgrade head
```

On first run, tables are also created automatically via `init_database()` at API startup.

## 6. Seed admin account (optional)

```bash
cd apps/api
# Activate venv first
python scripts/seed_admin.py
```

Default admin: `admin@osaja20.local` / `Admin@OSAJA20`

## 7. Run API

**Windows:**

```powershell
.\scripts\run-api.ps1
```

**Manual (any OS):**

```bash
cd apps/api
source .venv/bin/activate   # or .\.venv\Scripts\Activate.ps1 on Windows
export PYTHONPATH=.
uvicorn v1.main:app --reload
```

API docs: http://localhost:8000/docs

## 8. Run web apps

```bash
npx pnpm dev:member   # http://localhost:3000
npx pnpm dev:admin    # http://localhost:3001
```

## Run tests (inside venv)

```bash
cd apps/api
pytest tests/ -q
```

## Auth modes

| Mode | When | Endpoints |
|------|------|-----------|
| **Local** | `USE_LOCAL_AUTH=true` | `/auth/register`, `/auth/login` with bcrypt |
| **Supabase** | Supabase env vars set + `USE_LOCAL_AUTH=false` | Supabase Auth tokens + local member profiles |

## Supabase setup

In `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
SUPABASE_JWT_SECRET=...   # Project Settings → API → JWT Secret
USE_LOCAL_AUTH=false
```

The API automatically:
- Converts `postgresql://` → `postgresql+asyncpg://` (no psycopg2 needed)
- Enables SSL for remote Supabase hosts
- Returns Supabase access tokens on login/register
- Links `auth_user_id` on members table to Supabase users

On first run, tables are created via SQLAlchemy. For production, prefer running `docs/architecture/schema.sql` in the Supabase SQL editor.

All protected routes require `Authorization: Bearer <token>`.
