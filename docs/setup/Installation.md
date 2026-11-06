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

## 2. Set up and run all apps locally (no Docker required)

From the repository root:

```bash
pnpm setup:local
pnpm dev:all
```

`setup:local` creates `apps/api/.venv`, installs the API requirements, and copies
local environment examples only where a local env file does not already exist.
The default API database is SQLite, local auth is enabled, and the background
Redis worker is disabled. `dev:all` starts the API and all four web apps:

| App | URL |
|-----|-----|
| Member portal | http://localhost:3000 |
| Admin dashboard | http://localhost:3001 |
| Public landing site | http://localhost:3002 |
| SMS portal | http://localhost:3003 |
| API docs | http://localhost:8000/docs |

All five ports must be free. Press Ctrl+C to stop all apps. Optional integrations
such as Supabase, Paystack, Arkesel, and SMTP still require their own credentials.

## Bra Fie Night ticketing

The landing page and API include the Bra Fie Night 2027 ticket flow. On first API
startup, the event and its Early Bird (GH₵90), Single (GH₵100), and Double
(GH₵180, two admissions) categories are created if they do not already exist.
Executives can manage event and category configuration through the ticket API;
administrators can also manage category prices and inventory in the admin portal.

Ticket purchases use the existing server-side Paystack client. To enable checkout:

1. Configure `PAYSTACK_SECRET_KEY` in `apps/api/.env` (test key for development).
2. Set `TICKET_CALLBACK_URL` to the public landing URL plus `/tickets/complete`.
3. Configure the Paystack webhook to call `/api/v1/payments/webhook`.
4. Generate and set a stable `TICKET_TOKEN_ENCRYPTION_KEY` using the command in
   `apps/api/.env.example`; do not rotate it while existing tickets must remain
   retrievable.
5. Apply the API database migrations during deployment.

Without Paystack credentials, checkout fails explicitly; tickets are never issued
from a browser-only success message. The purchaser can retrieve issued QR tickets
from the payment-return page using the order reference and purchaser email. Ticket
tokens are random, hashed for lookup, and encrypted at rest. The same QR code is
used for both Double admissions.

The admin portal permits executive/administrator accounts to check in tickets
online at Gate 1, Gate 2, or Gate 3. Admission increments are atomic, and each
record includes the gate, browser device ID, staff account, and timestamp. The
scanner fails closed during network errors; it does not queue offline admissions.
Gate/staff assignment, email/SMS delivery, USSD purchases, refunds, and a shared
offline admission service are not yet implemented. The event page uses the venue
shown in the supplied video: Candix Royal Hotel, Amanfrom Sawmill Junction,
opposite Seventh Day Adventist (SDA) School. Configure the early-bird sales
cutoff once organizers confirm it.

## 3. Start infrastructure (optional for local dev)

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

## 4. Set up API virtual environment (local, not global)

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

## 5. Configure API

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your database and optional Supabase credentials.

For the SMS portal (Arkesel), also set:

```env
ARKESEL_API_KEY=your_arkesel_api_key
ARKESEL_SENDER_ID=OSAJA20
ARKESEL_BASE_URL=https://sms.arkesel.com/api/v2
ARKESEL_SANDBOX=false
# Public API origin for delivery webhooks (not localhost)
# PUBLIC_API_URL=https://your-api.example.com
```

`ARKESEL_SENDER_ID` must be **≤ 11 characters** and approved in the Arkesel dashboard.  
`sms_balance` from Arkesel is SMS **credits**; `main_balance` is GHS wallet money.

Include the SMS portal origin in CORS for local multi-app work:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
```

## 6. Run database migrations (optional)

With venv activated:

```bash
cd apps/api
alembic upgrade head
```

On first run, tables are also created automatically via `init_database()` at API startup.

**Fresh local Postgres:** Alembic revisions are incremental (no full baseline). Prefer:

```bash
python scripts/seed_admin.py   # create_all + seed admin
alembic stamp head             # mark migrations applied
```

Do not run `alembic upgrade head` on an empty database first — later revisions expect core tables such as `members` to already exist.

## 7. Seed admin account (optional)

```bash
cd apps/api
# Activate venv first
python scripts/seed_admin.py
```

Default admin: `admin@osaja20.local` / `Admin@OSAJA20`

## 8. Run API

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

## 9. Run web apps

### Web environment (`.env.local`)

Copy the example files and edit payment details, API URL, etc.:

```bash
cp apps/web/member-app/.env.local.example apps/web/member-app/.env.local
cp apps/web/admin-portal/.env.local.example apps/web/admin-portal/.env.local
cp apps/web/landing/.env.local.example apps/web/landing/.env.local
cp apps/web/sms-portal/.env.local.example apps/web/sms-portal/.env.local
```

Key variables (all `NEXT_PUBLIC_*` are exposed to the browser):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | API base (leave empty for auto-detect + tunnel proxy) |
| `API_PROXY_TARGET` | Server-side proxy to FastAPI (`http://127.0.0.1:8000`) |
| `NEXT_PUBLIC_MONTHLY_DUES_AMOUNT` | Displayed dues amount (default `30`) |
| `NEXT_PUBLIC_MOMO_NUMBER` | MoMo payment number |
| `NEXT_PUBLIC_MOMO_ACCOUNT_NAME` | MoMo account display name |
| `NEXT_PUBLIC_BANK_NAME` | Bank name |
| `NEXT_PUBLIC_BANK_ACCOUNT_NAME` | Bank account holder |
| `NEXT_PUBLIC_BANK_ACCOUNT_NUMBER` | Bank account number |
| `NEXT_PUBLIC_ADMIN_APP_URL` | SMS/admin cross-links between portals |
| `NEXT_PUBLIC_MEMBER_APP_URL` | Admin/SMS links to member portal |
| `NEXT_PUBLIC_SMS_APP_URL` | Admin link to SMS portal (if set) |

Restart the dev server after editing `.env.local`.

```bash
npx pnpm dev:member   # http://localhost:3000 — member portal
npx pnpm dev:admin    # http://localhost:3001 — admin portal
npx pnpm dev:landing  # http://localhost:3002 — public site
npx pnpm dev:sms      # http://localhost:3003 — SMS portal (executives)
```

SMS portal login uses the same executive/admin credentials as the admin portal (`admin@osaja20.local` / `Admin@OSAJA20` after seeding). Product overview: [docs/sms/sms_portal.md](../sms/sms_portal.md).

### Cloudflare tunnel (share dev build publicly)

Tunnel the **Next.js** port only (e.g. `cloudflared tunnel --url http://localhost:3000`). The member app proxies `/api/v1` and `/uploads` to your local API on port 8000, so you do **not** need a separate API tunnel.

**Required:** API and member app must both be running on the same machine:

```bash
# Terminal 1 — API on :8000
cd apps/api && uvicorn v1.main:app --reload

# Terminal 2 — member app on :3000
npx pnpm dev:member

# Terminal 3 — tunnel to Next.js
cloudflared tunnel --url http://localhost:3000
```

Do **not** set `NEXT_PUBLIC_API_URL=http://localhost:8000/...` when using a tunnel — the browser cannot reach your machine’s localhost. Leave it unset so the app uses same-origin `/api/v1`.

After changing `next.config.ts`, restart the Next.js dev server.

## Run tests

From the repo root (auto-uses `apps/api/.venv`, creates it on first run):

```bash
pnpm test          # utils + API tests
pnpm ci:fast       # lint, typecheck, tests
```

Or manually inside the API venv:

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

## Web Push (VAPID)

Generate keys:

```bash
npx web-push generate-vapid-keys
```

Add to `apps/api/.env`:

```env
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_CONTACT_EMAIL=admin@osaja.com
```

Install the Python dependency and restart the API:

```bash
cd apps/api
pip install pywebpush
uvicorn v1.main:app --reload
```

Members enable push under **Settings → Browser push notifications**, then use **Send test** to verify delivery.

## Related

- [Architecture](../architecture/Architecture.md)
- [SMS portal](../sms/sms_portal.md)
- [Deployment](../deployment/Deployment.md)
- [Security](../security/Security.md)
