# Audit Gap Remediation Log

**Date:** June 2026  
**Scope:** All audit gaps including **G01 CI/CD pipeline** (added June 2026)

## Resolved

| ID | Gap | Fix |
|----|-----|-----|
| G02 | No API integration tests | `apps/api/tests/test_auth.py`, `test_registration_pending.py`, `conftest.py` |
| G03 | No rate limiting | `v1/core/rate_limit.py` on auth + push test |
| G04 | Weak JWT secret default | `v1/core/startup.py` — fails startup when `DEBUG=false` + weak secret |
| G05 | Ad-hoc DB migrations | `alembic/versions/20260605_incremental_columns.py` |
| G06 | No deployment docs | `docs/deployment/Deployment.md` |
| G07 | Avatar content validation | Magic-byte check in `avatar_storage.py` |
| G08 | Public `/uploads` without auth | Avatars-only route in `modules/uploads/router.py` |
| G09 | Open registration → active | `REGISTRATION_AUTO_APPROVE` env; pending blocks login |
| G10 | Accessibility form labels | Register + forgot-password forms labeled |
| G11 | Forgot password | `POST /auth/forgot-password` + member `/forgot-password` page |
| G12 | Member announcements page | `/announcements` route + nav item |
| G13 | Audit log admin UI | `GET /activity` + admin `/activity` page |
| G15 | `compactDashboard` unused | Dashboard respects preference (compact layout) |
| G18 | Admin hardcoded localhost | `NEXT_PUBLIC_MEMBER_APP_URL` |
| G19 | Silent dashboard errors | Error banner + retry on member dashboard |
| G20 | Empty utils test suite | `packages/utils/src/formatters.test.ts` |
| — | OpenAPI in production | `/docs` disabled when `DEBUG=false` |
| — | Generic 500 responses | Global exception handler in `main.py` |
| — | `auth_user_id` in responses | Omitted unless `include_internal=True` |
| — | Security docs | `docs/security/Security.md` |
| — | Root test script | `pnpm test` in root `package.json` |
| — | Pinch zoom blocked | Removed `maximumScale: 1` from member viewport |

## Phase 2 resolved (June 2026)

| ID | Gap | Fix |
|----|-----|-----|
| G14 | PWA offline / icons | `sw.js` offline shell, SVG icons, `offline.html`, `ServiceWorkerInit` |
| G16 | Redis / job queue | `v1/core/jobs/` — async push + digest worker, sync fallback without Redis |
| — | Email digest | SMTP config + weekly digest for `emailDigest` pref |
| — | Playwright E2E | `e2e/` smoke tests — `pnpm test:e2e` |
| — | WCAG pass | SkipLink, `aria-current`, nav labels, form labels, `aria-live` |
| G01 | CI/CD pipeline | `.github/workflows/ci.yml` + local `pnpm ci:local` / `pnpm ci:fast` |

## Still pending

| ID | Gap | Notes |
|----|-----|-------|
| G17 | Duplicate utils in API | Maintainability — low priority |

## Resolved (post-audit, June 2026)

| Item | Fix |
|------|-----|
| Admin self-profile | `admin-portal` `/profile` |
| PWA icons + install banner | PNG icons + `PwaInstallBanner` |
| Production hardening | Security headers, `/health` DB check, `requirements-dev.txt`, `Handover.md` |
| Render deploy | `render.yaml` disk, alembic preDeploy, Python 3.12 |
| CORS env parsing | Comma-separated `CORS_ORIGINS` on Render |

## New environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REGISTRATION_AUTO_APPROVE` | `true` | Set `false` for executive-approved signups |
| `RATE_LIMIT_AUTH_PER_MINUTE` | `10` | Auth endpoint rate limit |
| `RATE_LIMIT_PUSH_TEST_PER_MINUTE` | `5` | Push test rate limit |
| `ALLOW_TUNNEL_CORS` | `true` | Cloudflare tunnel CORS regex (disable in prod) |
| `NEXT_PUBLIC_MEMBER_APP_URL` | `http://localhost:3000` | Admin login member portal link |
| `JOB_WORKER_ENABLED` | `true` | Background Redis job worker in API process |
| `EMAIL_ENABLED` + SMTP_* | off | Weekly email digest delivery |

## Verify locally

```powershell
cd apps/api
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH="."
python -m pytest tests/ -q

cd ..\..
npx pnpm --filter @osaja/utils test
npx pnpm typecheck
```
