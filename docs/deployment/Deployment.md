# Deployment Guide

Production deployment checklist for the OSAJA'20 Welfare Platform.

## Architecture

| Component | Suggested host | Port |
|-----------|----------------|------|
| API (FastAPI) | Render, Railway, Fly.io, VPS | 8000 |
| Member app | Vercel | 3000 |
| Admin portal | Vercel | 3001 |
| Database | Supabase PostgreSQL | 5432 (session pooler) |

The Next.js apps proxy `/api/v1` and `/uploads` to the API — set `API_PROXY_TARGET` on Vercel to your API URL.

## Pre-deploy checklist

### API (`apps/api/.env`)

- [ ] `DEBUG=false`
- [ ] `JWT_SECRET` — at least 32 random characters (startup will fail if weak)
- [ ] `DATABASE_URL` — PostgreSQL with SSL (Supabase session pooler on port **5432**)
- [ ] `USE_LOCAL_AUTH=false` when using Supabase Auth
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` configured
- [ ] `REGISTRATION_AUTO_APPROVE=false` for executive-approved signups
- [ ] `ALLOW_TUNNEL_CORS=false` in production
- [ ] `CORS_ORIGINS` — comma-separated member + admin portal URLs
- [ ] VAPID keys for web push (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- [ ] `REDIS_URL` for async push/digest jobs (optional — sync fallback without Redis)
- [ ] SMTP settings if email digest is required (`EMAIL_ENABLED=true`)

### Member app (`apps/web/member-app`)

- [ ] `API_PROXY_TARGET=https://your-api.example.com`
- [ ] `NEXT_PUBLIC_APP_NAME`, payment env vars as needed

### Admin portal (`apps/web/admin-portal`)

- [ ] `API_PROXY_TARGET` (same API)
- [ ] `NEXT_PUBLIC_MEMBER_APP_URL=https://members.your-domain.com`

## Database migrations

1. **New environment:** API startup runs `create_all` + incremental fixes via `init_db.py`.
2. **Versioned upgrades:** From `apps/api`:

```bash
# After models change
alembic upgrade head
```

For databases created before Alembic was introduced, run `alembic upgrade head` once to apply `20260605_incremental`.

## API deploy steps

```bash
cd apps/api
pip install -r requirements.txt
alembic upgrade head   # optional if schema already current
uvicorn v1.main:app --host 0.0.0.1 --port 8000
```

Use a process manager (systemd, Docker, Render web service) and persist the `uploads/` volume for avatars.

## Web deploy steps

```bash
pnpm install
pnpm --filter @osaja/types build
pnpm --filter @osaja/ui build
pnpm --filter @osaja/member-app build
pnpm --filter @osaja/admin-portal build
```

Deploy each Next.js app separately on Vercel with root directory set to the app folder.

## Health checks

- `GET https://api.example.com/health` — expect `status: healthy`
- Verify login on member and admin portals after deploy

## CI/CD

GitHub Actions workflow is **not yet configured** — run locally before release:

```bash
pnpm typecheck
pnpm test
cd apps/api && python -m pytest tests/ -q
```

## Related

- [Installation](../setup/Installation.md)
- [Security](../security/Security.md)
- [System audit](../audit/SYSTEM_AUDIT.md)
