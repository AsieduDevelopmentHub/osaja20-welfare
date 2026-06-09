# Deployment Guide

Production deployment for **OSAJA'20 Welfare**: API on Render, member + admin apps on Vercel, database on Supabase.

## Overview

| Component | Host | Repo path | Public URL (example) |
|-----------|------|-----------|----------------------|
| **Landing site** | Vercel | `apps/web/landing` | `https://osaja2020welfare.org` |
| API (FastAPI) | Render | `apps/api` | `https://api.osaja2020welfare.org` |
| Member app | Vercel | `apps/web/member-app` | `https://member.osaja2020welfare.org` |
| Admin portal | Vercel | `apps/web/admin-portal` | `https://admin.osaja2020welfare.org` |
| Database | Supabase | — | PostgreSQL session pooler `:5432` |

**Deploy in this order:**

1. Supabase project + `DATABASE_URL`
2. **API** on Render → note the API URL
3. **Landing site** on Vercel (apex domain) → note the public URL
4. **Member app** on Vercel → note the member URL
5. **Admin portal** on Vercel
6. Update API env (`CORS_ORIGINS`, `MEMBER_PORTAL_URL`) and redeploy API
7. Supabase auth redirect URLs + Paystack webhook (if used)

Both Next.js apps proxy `/api/v1` and `/uploads` to the API using `API_PROXY_TARGET` (server-side). The browser usually talks to the same origin as the app, not Render directly.

---

## 1. API on Render

### Create the service

1. [Render](https://render.com) → **New** → **Web Service** → connect `osaja20-welfare` repo.
2. Use these settings:

| Field | Value |
|-------|--------|
| **Root directory** | `apps/api` |
| **Runtime** | Python |
| **Python version** | **3.12.8** (Dashboard → Environment → `PYTHON_VERSION=3.12.8`, or use repo `apps/api/.python-version`) |
| **Build command** | `pip install -r requirements.txt` |
| **Start command** | `uvicorn v1.main:app --host 0.0.0.0 --port $PORT` |

> **Do not use Python 3.14.** The build will fail compiling `pydantic-core` (Rust/maturin on a read-only filesystem). Pin **3.12**.

Optional: import `render.yaml` from the repo root for the same defaults.

### Environment variables (Render dashboard)

Copy from `apps/api/.env.example`. Minimum for production:

| Variable | Example / notes |
|----------|-----------------|
| `DEBUG` | `false` |
| `JWT_SECRET` | 32+ random characters (required when `DEBUG=false`) |
| `DATABASE_URL` | Supabase session pooler `postgresql://...pooler.supabase.com:5432/postgres` |
| `USE_LOCAL_AUTH` | `true` for bcrypt login, or `false` + Supabase keys |
| `REGISTRATION_AUTO_APPROVE` | `false` if executives must approve signups |
| `ALLOW_TUNNEL_CORS` | `false` |
| `CORS_ORIGINS` | Comma-separated, no quotes: `https://member.vercel.app,https://admin.vercel.app`. **Do not leave blank** — delete the var until URLs exist, or the API will crash on startup. |
| `MEMBER_PORTAL_URL` | `https://YOUR-MEMBER.vercel.app` (Paystack callback + password reset) |
| `WHATSAPP_NUMBER` | e.g. `233531273626/233532918613` (contact FAB + `/settings/contact`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_CONTACT_EMAIL` | `admin@osaja.com` |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | If online dues enabled |
| `JOB_WORKER_ENABLED` | `false` on free tier (push still works inline) |
| `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key (Storage uploads + optional auth admin) |
| `SUPABASE_STORAGE_BUCKET` | `avatars` (default) — public bucket for profile photos |

**Avatars (Supabase Storage):** Render’s persistent disk requires a paid plan. Profile photos are stored in a **public Supabase Storage bucket** instead (free tier includes storage).

1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `avatars` (or match `SUPABASE_STORAGE_BUCKET`)
3. Enable **Public bucket** (profile photos are shown in the member/admin portals)
4. On Render, set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` — the API uploads via the service role (no extra RLS policies needed for server-side uploads)

Members who uploaded avatars before this change may need to re-upload once (old files were on ephemeral Render disk).

**Migrations:** `render.yaml` runs `alembic upgrade head` before each deploy (`preDeployCommand`).

### Verify API

```text
GET https://YOUR-API.onrender.com/health
```

Expect: `"status": "healthy"`.

### Create first admin (one-time)

From your machine with production `DATABASE_URL` (or Render shell):

```bash
cd apps/api
# set DATABASE_URL, JWT_SECRET, etc. in .env or env vars
python scripts/create_admin.py
```

---

## 2. Landing site on Vercel

Public marketing site for the welfare organisation — vision, mission, gallery, and links to the member and admin portals.

### Create the project

1. Vercel → **Add New** → **Project** → same repo (separate project from member/admin).
2. **Project name:** e.g. `osaja-landing`.
3. **Root Directory:** `apps/web/landing`.
4. Leave Install/Build empty (uses `apps/web/landing/vercel.json`).
5. **Deploy**.

### Environment variables

| Variable | Required | Value |
|----------|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | Recommended | `https://osaja2020welfare.org` (or your apex domain) |
| `NEXT_PUBLIC_MEMBER_URL` | Recommended | `https://member.osaja2020welfare.org` |
| `NEXT_PUBLIC_ADMIN_URL` | Optional | `https://admin.osaja2020welfare.org` |

The landing app does **not** need `API_PROXY_TARGET` — it is static marketing content only.

### Gallery photos

1. Add images to `apps/web/landing/public/gallery/` (`.jpg`, `.png`, or `.webp`).
2. Update `GALLERY_ITEMS` in `packages/config/src/landing.ts` with titles, dates, and image paths.
3. Redeploy the landing project.

### Verify landing site

1. Open the apex URL — hero, vision, gallery, and portal CTAs load.
2. **Member portal** and **Admin** buttons point to the correct subdomains.

---

## 3. Member app on Vercel

### Create the project

1. [Vercel](https://vercel.com) → **Add New** → **Project** → import the same GitHub repo.
2. **Project name:** e.g. `osaja-members`.
3. **Root Directory:** click **Edit** → set to `apps/web/member-app`.
4. **Framework Preset:** Next.js (auto-detected after correct install).
5. **Build & Development Settings:**
   - Leave **Install** and **Build** empty in the UI if `apps/web/member-app/vercel.json` is in the repo (recommended).
   - Do **not** set Install to `npm install --prefix=../../..` — that skips workspace packages and breaks the build (`No Next.js version detected`).

The repo `vercel.json` runs:

```text
install: pnpm install --frozen-lockfile   (from monorepo root)
build:   pnpm --filter "./packages/*" build && pnpm --filter @osaja/member-app build
```

6. **Deploy**.

### Environment variables (Vercel → Project → Settings → Environment Variables)

Apply to **Production** (and Preview if you want):

| Variable | Required | Value |
|----------|----------|--------|
| `API_PROXY_TARGET` | **Yes** | `https://YOUR-API.onrender.com` (no trailing slash) |
| `NEXT_PUBLIC_SITE_URL` | Recommended | `https://YOUR-MEMBER.vercel.app` (OG / share links) |
| `NEXT_PUBLIC_APP_NAME` | Optional | `OSAJA'20 Welfare` |
| `NEXT_PUBLIC_CURRENCY` | Optional | `GHS` |
| `NEXT_PUBLIC_MONTHLY_DUES_AMOUNT` | Optional | `30` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Recommended | Same as API `WHATSAPP_NUMBER` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional | `admin@osaja.com` |
| `NEXT_PUBLIC_CONTACT_PHONE` | Optional | Treasurer phone |
| `NEXT_PUBLIC_MOMO_*` / `NEXT_PUBLIC_BANK_*` | Optional | Manual payment fallback copy |

You do **not** need `NEXT_PUBLIC_API_URL` in production if `API_PROXY_TARGET` is set — the app uses same-origin `/api/v1` via `next.config.ts` rewrites.

Full list: `apps/web/member-app/.env.local.example`.

### Supabase (password reset)

If using Supabase Auth, in **Supabase → Authentication → URL Configuration**:

- **Redirect URLs:** add `https://YOUR-MEMBER.vercel.app/reset-password`
- **Site URL:** can be the member app URL

### Verify member app

1. Open `https://YOUR-MEMBER.vercel.app`
2. Register or log in
3. Confirm API calls work (dashboard loads, no network errors to `/api/v1/...`)
4. Test contact FAB, contributions, notifications

---

## 4. Admin portal on Vercel

### Create the project

1. Vercel → **Add New** → **Project** → same repo (second project).
2. **Project name:** e.g. `osaja-admin`.
3. **Root Directory:** `apps/web/admin-portal`.
4. Leave Install/Build empty (uses `apps/web/admin-portal/vercel.json`).
5. **Deploy**.

### Environment variables

| Variable | Required | Value |
|----------|----------|--------|
| `API_PROXY_TARGET` | **Yes** | `https://YOUR-API.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | Recommended | `https://YOUR-ADMIN.vercel.app` |
| `NEXT_PUBLIC_MEMBER_APP_URL` | **Yes** | `https://YOUR-MEMBER.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | Optional | `OSAJA'20 Welfare Admin` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Optional | Same as API |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional | `admin@osaja.com` |

Full list: `apps/web/admin-portal/.env.local.example`.

### Verify admin portal

1. Open `https://YOUR-ADMIN.vercel.app/login`
2. Log in as executive/admin
3. Check **Notifications** bell, **Inquiries**, **Birthdays**, **Contributions**

---

## 5. Wire URLs back to the API

After both Vercel URLs exist, update **Render** env and redeploy API:

```env
CORS_ORIGINS=https://YOUR-MEMBER.vercel.app,https://YOUR-ADMIN.vercel.app
MEMBER_PORTAL_URL=https://YOUR-MEMBER.vercel.app
```

Paystack (if used): webhook URL

```text
https://YOUR-API.onrender.com/api/v1/payments/webhook
```

---

## 6. Custom domains (optional)

| App | Suggested |
|-----|-----------|
| Landing | `osaja2020welfare.org` or `osaja2020.org` (apex / `www`) |
| Member | `member.osaja2020welfare.org` |
| Admin | `admin.osaja2020welfare.org` |
| API | `api.osaja2020welfare.org` (CNAME to Render) |

Update `CORS_ORIGINS`, `MEMBER_PORTAL_URL`, landing `NEXT_PUBLIC_*_URL`, member/admin `NEXT_PUBLIC_SITE_URL`, and Supabase redirect URLs to match.

---

## Database migrations

- **First deploy:** API runs `create_all` + incremental fixes in `init_db.py`.
- **Schema updates:** from `apps/api`:

```bash
alembic upgrade head
```

Run once against production `DATABASE_URL` before or after deploy when models change.

---

## Local build (sanity check)

```bash
pnpm install
pnpm --filter "./packages/*" build
pnpm --filter @osaja/member-app build
pnpm --filter @osaja/admin-portal build
pnpm --filter @osaja/landing build
```

---

## Troubleshooting

### Render: `error parsing value for field "cors_origins"`

Build succeeded but uvicorn exits immediately. Usually `CORS_ORIGINS` is **empty** or malformed on Render.

**Fix (immediate, no code change):** In Render → Environment, either **delete** `CORS_ORIGINS` (uses localhost defaults until you add Vercel URLs) or set:

```text
https://YOUR-MEMBER.vercel.app,https://YOUR-ADMIN.vercel.app
```

Comma-separated — not JSON, no surrounding quotes. After the config fix is deployed, this format is fully supported.

### Render: `pydantic-core` / `maturin` / Rust / read-only filesystem

Render is using **Python 3.14**. Set `PYTHON_VERSION=3.12.8` and redeploy. Repo files: `apps/api/.python-version`, `apps/api/runtime.txt`.

### Vercel: `No Next.js version detected`

Wrong install command (`npm install --prefix=...`) or wrong root directory. Use root `apps/web/member-app` or `apps/web/admin-portal` and repo `vercel.json` with **pnpm**.

### Member/admin: API 502 or login fails

- Check `API_PROXY_TARGET` points to live Render URL (https, no typo).
- Hit `https://YOUR-API.onrender.com/health` directly.
- Free Render services sleep — first request may be slow.

### CORS errors in browser

Usually only if `NEXT_PUBLIC_API_URL` points at Render directly. Prefer proxy mode: leave `NEXT_PUBLIC_API_URL` unset and set `API_PROXY_TARGET` only.

### Push notifications not working

- VAPID keys on API
- HTTPS required (Vercel provides this)
- User must allow notifications in browser; admin/member portals auto-subscribe on load

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) on push/PR to `main`:

| Job | Checks |
|-----|--------|
| **quality** | lint, typecheck, build |
| **test** | utils + API pytest |
| **e2e** | Playwright smoke |
| **audit** | pnpm + pip audit (non-blocking) |

Before pushing:

```bash
pnpm ci:fast    # quick
pnpm ci:local   # full (includes build + e2e)
```

---

## Client handover

After all three services are live, complete [Handover.md](./Handover.md) with the welfare executives (admin account, smoke tests, Paystack, ongoing ops).

## Related

- [Handover checklist](./Handover.md)
- [Installation](../setup/Installation.md) — local dev setup
- [Security](../security/Security.md)
- [System audit](../audit/SYSTEM_AUDIT.md)
