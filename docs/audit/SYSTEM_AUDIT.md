# OSAJA'20 Welfare Platform — Full System Audit

**Audit date:** June 2026  
**Repository:** `osaga20-welfare`  
**Scope:** API, member app, admin portal, shared packages, infrastructure, tests, security, UX/theming, documentation  
**Audience:** Executive team, developers, and deployment stakeholders

---

## Executive summary

The OSAJA'20 Welfare Platform is a **functionally rich monorepo** with a working FastAPI backend, member portal (Next.js :3000), and admin portal (Next.js :3001). Core workflows—registration, dues, contributions, welfare cases, voting with published results, announcements, web push, payment settings, member profiles, and CSV/Excel exports—are **implemented and wired end-to-end**.

The system is **suitable for pilot / internal use** with manual ops, but is **not production-hardened** from an engineering-operations perspective. The largest gaps are:

| Area | Maturity | Risk |
|------|----------|------|
| Core functionality | **High** | Low for pilot |
| Security hardening | **Medium** | Medium–High at scale |
| Automated testing | **Low** | High regression risk |
| CI/CD & deployment | **Absent** | Critical for prod |
| DB migrations | **Ad-hoc** | Medium operational risk |
| Accessibility | **Partial** | Medium compliance risk |
| Documentation (ops) | **Partial** | Medium onboarding risk |

**Top 5 actions before public production:**

1. Add CI (lint, typecheck, build, pytest) and block merges on failure  
2. Add API integration tests for auth, RBAC, and critical routes  
3. Enforce strong secrets at startup (`JWT_SECRET`, VAPID, DB URL)  
4. Add rate limiting on `/auth/login` and `/auth/register`  
5. Replace ad-hoc `init_db` migrations with versioned Alembic revisions  

---

## 1. Scope & methodology

This audit reviewed:

- **Backend:** `apps/api/v1/` — routers, services, auth, models, algorithms, push, uploads  
- **Member app:** `apps/web/member-app/` — all portal and auth routes  
- **Admin portal:** `apps/web/admin-portal/` — all portal and auth routes  
- **Shared packages:** `packages/types`, `packages/ui`, `packages/utils`, `packages/config`  
- **Infrastructure:** `infrastructure/docker/`, scripts, env examples  
- **Tests & CI:** `apps/api/tests/`, `.github/` (none found), root scripts  
- **Documentation:** `docs/`, `README.md`, `overview.md`  

Method: static code review, route inventory, dependency and config inspection, cross-reference with `overview.md` specification.

---

## 2. Architecture overview

```
┌─────────────────┐     ┌─────────────────┐
│  Member App     │     │  Admin Portal   │
│  :3000          │     │  :3001          │
│  (light theme)  │     │  (dark theme)   │
└────────┬────────┘     └────────┬────────┘
         │    Next.js rewrites   │
         │    /api/v1 → API      │
         └──────────┬────────────┘
                    ▼
         ┌──────────────────────┐
         │  FastAPI API :8000   │
         │  apps/api/v1/        │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │  PostgreSQL / SQLite │
         │  (Supabase prod)     │
         └──────────────────────┘
```

| Layer | Technology | Notes |
|-------|------------|-------|
| API | FastAPI, Python 3.12, SQLAlchemy async | Single `platform_service` orchestration layer |
| Web | Next.js 15, React 19, Tailwind 3.4 | pnpm workspace; API outside workspace (venv) |
| Auth | Dual: local bcrypt **or** Supabase + API-issued JWT | Role always resolved from DB |
| Push | pywebpush + VAPID | Synchronous delivery in request path |
| Algorithms | In-memory Trie, VoteEngine, Ledger, FSM, BirthdayIndex | Rebuilt from DB on startup |

**Strengths:** Clear module boundaries, shared `@osaja/ui` / `@osaja/types`, consistent `ApiResponse` envelope, executive RBAC on sensitive routes.

**Gaps:** No shared API client package (duplicated `apiFetch` in both apps), `packages/utils` algorithms duplicated in Python API (TypeScript copies unused in web), Redis configured but unused, no background job worker.

---

## 3. Functionality audit

### 3.1 API modules

| Module | Base path | Status | Notes |
|--------|-----------|--------|-------|
| Auth | `/auth` | ✅ Complete | Register, login, profile, avatar, local + Supabase |
| Members | `/members` | ✅ Complete | List, search, profile, dues, contributions, balance, role, status |
| Welfare | `/welfare` | ✅ Complete | Create, list (exec), `me/cases`, transitions |
| Contributions | `/contributions` | ✅ Complete | Record dues, ledger, summary |
| Voting | `/voting` | ✅ Complete | CRUD lifecycle, submit, results, publish-results |
| Announcements | `/announcements` | ✅ Complete | Publish, list, edit, delete (archive) |
| Notifications | `/notifications` | ✅ Complete | In-app list, unread, birthday scan |
| Push | `/push` | ✅ Complete | VAPID key, subscribe, test |
| Settings | `/settings` | ✅ Complete | Payment config (public GET, exec PUT) |
| Dashboard | `/dashboard` | ✅ Complete | Stats, birthdays by month |
| Health | `/health` | ✅ Present | Liveness check |

### 3.2 Member portal (`apps/web/member-app`)

| Route | Status | Gaps |
|-------|--------|------|
| `/` Dashboard | ✅ | Silent error swallow on load; `compactDashboard` pref unused |
| `/contributions` | ✅ | Payment from API + env fallback |
| `/welfare` | ✅ | Submit + track status |
| `/voting` | ✅ | Confirm-before-submit; published results |
| `/notifications` | ✅ | Announcements only as notification type |
| `/birthdays` | ✅ | — |
| `/profile` | ✅ | Read-only; edit in settings |
| `/settings` | ✅ | Avatar, prefs, push |
| `/login`, `/register` | ✅ | No forgot-password / email-verify pages |

**Missing routes:** `/announcements` (dedicated), password reset, email verification UI.

### 3.3 Admin portal (`apps/web/admin-portal`)

| Route | Status | Gaps |
|-------|--------|------|
| `/` Dashboard | ✅ | — |
| `/members` | ✅ | Links to `/profile/[id]` |
| `/profile/[id]` | ✅ | Status, role, balance, avatar |
| `/welfare` | ✅ | Create, filter, transitions (simplified FSM) |
| `/contributions` | ✅ | Record dues + ledger (cards/table toggle) |
| `/voting` | ✅ | Draft → open → close → publish results |
| `/announcements` | ✅ | CRUD + re-notify |
| `/reports` | ✅ | CSV/Excel exports, birthday scan |
| `/settings` | ✅ | Payment gateways / dues amount |
| `/login` | ✅ | Hardcoded `localhost:3000` member link |

**Missing routes:** Admin self-profile/settings, bulk member operations, dedicated audit log UI.

### 3.4 Welfare workflow (current)

Simplified status model (migrated from legacy states):

```
pending → approved → allocated → resolved
```

Members see cases on `/welfare` and dashboard. Executives manage on `/welfare` (admin).

### 3.5 Voting workflow (current)

```
draft → open → closed → (admin publishes) → result_published
```

Members see published results on dashboard and `/voting`. Admins see full results anytime.

### 3.6 Functional gaps (cross-cutting)

| Gap | Impact | Suggested fix |
|-----|--------|---------------|
| No email delivery (digest, verification) | Medium | Supabase email or SMTP integration |
| No forgot/change password UI | High for self-service | Supabase reset flow + pages |
| No member announcements page | Low | Add `/announcements` or clarify nav |
| `compactDashboard` saved but not used | Low | Implement or remove pref |
| Dashboard API errors swallowed (member) | Medium | Show error banner |
| No pagination UI on long lists | Medium | Add load-more / pages |
| Export depends on client-side paging | Low | OK for &lt;500 rows; add server export for large data |
| No audit log viewer in admin | Medium | `/activity` page consuming `activity_logs` |

---

## 4. Security audit

### 4.1 Strengths

- **DB-backed RBAC:** Authorization uses `member.role` from database, not JWT claims alone (`apps/api/v1/core/auth/dependencies.py`).
- **Inactive/archived accounts** blocked at login and on every authenticated request.
- **Parameterized SQL** throughout SQLAlchemy services — low SQL injection risk.
- **Password hashing** via bcrypt for local auth (`apps/api/v1/core/password.py`).
- **Upload constraints:** Avatar MIME allowlist, 2 MB cap, UUID filenames (`apps/api/v1/core/avatar_storage.py`).
- **Secrets gitignored:** `.env`, `.env.local`, `uploads/`, `*.pem` (`.gitignore`).
- **CORS allowlist** via `CORS_ORIGINS` env (`apps/api/v1/core/config.py`).
- **Executive-only** routes for contributions, welfare transitions, payment settings, vote management.

### 4.2 Gaps & risks

| Issue | Severity | Location | Recommendation |
|-------|----------|----------|----------------|
| **No rate limiting** | 🔴 High | All routers | Add `slowapi` or reverse-proxy limits on login/register |
| Default `JWT_SECRET=change-me-in-production` | 🔴 High | `config.py` | Fail startup if weak secret in prod |
| Open self-registration → immediate `active` | 🟠 Medium | `auth/router.py` | Pending status + admin approval option |
| CORS `*.trycloudflare.com` regex | 🟠 Medium | `config.py` | Disable in production |
| Avatar validation = Content-Type only | 🟠 Medium | `avatar_storage.py` | Magic-byte / PIL verify + re-encode |
| `/uploads` served without auth | 🟠 Medium | `main.py` | Signed URLs or auth middleware |
| `DEBUG=true` in `.env.example` | 🟠 Medium | `.env.example` | Document prod must set `false` |
| JWT `verify_aud: False` | 🟡 Low | `jwt.py` | Enable audience check for Supabase tokens |
| No token refresh / revoke | 🟡 Low | Auth module | Refresh endpoint or shorter TTL + UX |
| `POST /push/test` unthrottled | 🟡 Low | `push/router.py` | Rate limit per user |
| Payment details public (`GET /settings/payment`) | ✅ By design | Intentional for member app |
| `auth_user_id` in API responses | 🟡 Low | `serializers.py` | Omit for non-admin callers |
| OpenAPI `/docs` always on | 🟡 Low | `main.py` | Disable when `DEBUG=false` |
| No global exception sanitizer | 🟡 Low | — | Custom 500 handler without stack traces |

### 4.3 Auth flow summary

| Mode | When | Token |
|------|------|-------|
| Local | `USE_LOCAL_AUTH=true` | API JWT (24h default) |
| Supabase | Production default | Supabase session → API re-issues JWT with `member_id` |

Admin portal rejects non-executive roles at login (`apps/web/admin-portal/src/lib/auth.tsx`).

---

## 5. Testing audit

### 5.1 What exists

| Suite | Location | Coverage |
|-------|----------|----------|
| Python algorithm unit tests | `apps/api/tests/test_algorithms.py` | Trie, VoteEngine, Ledger, Welfare FSM, BirthdayIndex (5 tests) |
| Utils package test script | `packages/utils/package.json` | **Script exists, no test files** |

### 5.2 What's missing

| Gap | Priority |
|-----|----------|
| API route / integration tests (`TestClient`, `httpx`) | 🔴 Critical |
| Auth & RBAC regression tests | 🔴 Critical |
| Database fixture / `conftest.py` | 🔴 High |
| Web unit tests (Jest/Vitest) | 🟠 Medium |
| E2E tests (Playwright) for login, dues, vote | 🟠 Medium |
| Coverage reporting & thresholds | 🟡 Low |
| Root `pnpm test` script | 🟡 Low |

### 5.3 Recommended test matrix

| Area | Minimum tests |
|------|----------------|
| Auth | Login fail/success, inactive block, executive gate |
| Welfare | Create, transition invalid/valid, member `me/cases` |
| Voting | Submit duplicate blocked, publish results gating |
| Contributions | Duplicate dues month rejected |
| Uploads | Reject oversize / wrong MIME |
| Push | Mock webpush, preference gating |

---

## 6. CI/CD & infrastructure

### 6.1 Current state

| Item | Status |
|------|--------|
| `.github/workflows/` | ❌ **Missing** |
| `turbo.json` | Present but **not wired** in root scripts |
| `infrastructure/docker/docker-compose.yml` | ✅ Dev only (Postgres, Redis, API volume mount) |
| `Dockerfile.api` | ✅ Single-stage, no healthcheck |
| Web Dockerfiles | ❌ Missing |
| Vercel / Render configs | ❌ Missing (mentioned in Architecture.md only) |
| `.dockerignore` | ❌ Missing |

### 6.2 Recommended CI pipeline

```yaml
# Suggested jobs
- pnpm install → lint → typecheck → build (web + packages)
- pip install → pytest apps/api/tests
- Optional: docker build API image
- Optional: pip audit / npm audit
```

### 6.3 Production deployment checklist

- [ ] Strong `JWT_SECRET`, VAPID keys, `DATABASE_URL` with SSL  
- [ ] `DEBUG=false`, disable `/docs` or protect with auth  
- [ ] Tighten `CORS_ORIGINS`; remove Cloudflare tunnel regex  
- [ ] Alembic migrations run before deploy (not `create_all` only)  
- [ ] Health check monitoring on `GET /health`  
- [ ] Backup strategy for PostgreSQL  
- [ ] HTTPS everywhere (Vercel + Render/Supabase)  

---

## 7. Database & migrations

### 7.1 Current approach

- **Startup:** `init_database()` → `create_all` + inline `ALTER TABLE` in `apps/api/v1/core/init_db.py`
- **Alembic:** Scaffold present (`apps/api/alembic/`) but **`versions/` is empty**
- **Schema reference:** `docs/architecture/schema.sql` (may drift from models)

### 7.2 Migrations applied at runtime (init_db)

- `members.username`, `avatar_url`, `preferences`
- `contributions.period_year`, `period_month`
- `votes.results_published`
- Welfare status normalization (`created` → `pending`, etc.)

### 7.3 Risks

| Risk | Mitigation |
|------|------------|
| No migration history / rollback | Generate Alembic revisions from models |
| Multi-instance race on `create_all` | Run migrations in deploy job, not per-request |
| Schema drift between envs | Single source of truth in Alembic |

---

## 8. Theming, UX & branding

### 8.1 Design system

| Token | Value | Usage |
|-------|-------|-------|
| Navy | `#0a2d6e` | Primary brand, member headers |
| Gold | `#c9a227` | CTAs, admin accents |
| Member theme | Light glass cards | `globals.css`, `glass-card` |
| Admin theme | Dark navy panels | `bg-brand-navy`, gold CTAs |

**Sources:** `packages/config/src/brand.ts`, per-app `tailwind.config.ts`, `packages/ui` (`MobileShell`, `StatCard`, `BrandLogo`).

### 8.2 UX patterns

| Pattern | Member | Admin |
|---------|--------|-------|
| Skeleton loading | ✅ Broad coverage | ✅ Broad coverage |
| Empty states | ✅ `EmptyState` component | ✅ Partial |
| Confirm destructive actions | ✅ Vote confirm | ⚠️ `window.confirm` only |
| Error feedback | ⚠️ Some silent catches | ✅ Generally visible |
| Mobile nav | ✅ Bottom bar + “More” | ✅ Responsive sidebar |

### 8.3 Theming gaps

- No dark mode toggle on member app (light only by design)
- PWA manifest uses JPEG icon (not ideal for maskable install)
- Admin login hardcodes member portal URL
- Inconsistent button classes (`btn-primary` vs inline Tailwind on admin)

---

## 9. Accessibility (a11y)

### 9.1 Present

- `lang="en"` on `<html>`
- Some forms use `htmlFor` / `id` (login pages)
- `SettingsToggle` uses `role="switch"` and `aria-checked`
- Skeletons use `aria-hidden`
- Some `aria-label` on icon buttons

### 9.2 Gaps (WCAG impact)

| Issue | WCAG concern |
|-------|--------------|
| Register form: placeholders only, no labels | 1.3.1, 3.3.2 |
| Many admin/member forms lack associated labels | 1.3.1 |
| `maximumScale: 1` blocks pinch zoom (member) | 1.4.4 |
| No skip navigation link | 2.4.1 |
| No `aria-live` for errors/success | 4.1.3 |
| Color-only status indicators | 1.4.1 |
| No `aria-current="page"` on nav | 2.4.8 |
| `window.confirm` for deletes | 2.1.1 |

**Recommendation:** Run axe-core or Lighthouse on critical paths; fix register + settings forms first.

---

## 10. Notifications & PWA

| Feature | Status | Notes |
|---------|--------|-------|
| In-app notifications | ✅ | Created synchronously on events |
| Web Push (VAPID) | ✅ | Member settings; server-side keys in `apps/api/.env` |
| Service worker | ⚠️ Push only | `public/sw.js` — no offline cache |
| Web manifest | ✅ | `manifest.json`, theme color |
| Admin push | ❌ | Not applicable |
| Email notifications | ❌ | `emailDigest` pref unused |
| Celery / Redis queue | ❌ | Redis in compose but unused; push is sync |

---

## 11. Shared packages audit

| Package | Purpose | Web usage | Gaps |
|---------|---------|-----------|------|
| `@osaja/types` | Domain models | ✅ Both apps | Some duplication with local admin types |
| `@osaja/ui` | Shell, skeletons, ledger, nav | ✅ Both apps | Must `tsc` build before strict consumption |
| `@osaja/config` | Brand, constants | ✅ Both apps | Dues logic duplicated in `utils` |
| `@osaja/utils` | Algorithms + formatters | ⚠️ **formatCurrency/formatDate only** | Full algorithms unused in web (live in API Python) |

**Recommendation:** Either document algorithms as API-only or add a shared test suite in `packages/utils`.

---

## 12. Documentation audit

### 12.1 Present

| Document | Path |
|----------|------|
| README | `README.md` |
| Installation guide | `docs/setup/Installation.md` |
| Architecture | `docs/architecture/Architecture.md` |
| SQL schema reference | `docs/architecture/schema.sql` |
| Env examples | `apps/api/.env.example`, `apps/web/*/.env.local.example` |
| Full spec (aspirational) | `overview.md` (root) |
| **This audit** | `docs/audit/SYSTEM_AUDIT.md` |

### 12.2 Missing (referenced in `overview.md` or needed for ops)

| Document | Priority |
|----------|----------|
| `docs/deployment/Deployment.md` | 🔴 High |
| `docs/security/Security.md` | 🔴 High |
| `docs/api/API.md` (OpenAPI companion) | 🟠 Medium |
| `docs/workflows/Workflows.md` | 🟠 Medium |
| `docs/user-guides/` (member + admin) | 🟡 Low |
| `CONTRIBUTING.md`, `SECURITY.md` | 🟡 Low |
| Runbooks (incident, backup, key rotation) | 🟠 Medium |

---

## 13. Monorepo & developer experience

### 13.1 Scripts (root `package.json`)

| Script | Works | Notes |
|--------|-------|-------|
| `dev:member` | ✅ | Port 3000 |
| `dev:admin` | ✅ | Port 3001 |
| `dev:web` | ⚠️ | `&` may fail on Windows PowerShell |
| `build` | ✅ | Requires package builds first |
| `lint` | ✅ | Per-app `next lint` |
| `typecheck` | ✅ | Strict TS in apps + packages |
| `test` | ❌ | **Not defined at root** |

### 13.2 Hygiene issues

- Dual lockfiles: `pnpm-lock.yaml` + `package-lock.json` — standardize on pnpm  
- API outside pnpm workspace — document clearly (already in Installation.md)  
- No pre-commit hooks (husky, ruff, prettier)  
- `turbo.json` unused  

---

## 14. Gap priority matrix

| ID | Gap | Area | Severity | Effort |
|----|-----|------|----------|--------|
| G01 | No CI/CD pipeline | DevOps | Critical | M |
| G02 | No API integration tests | Tests | Critical | L |
| G03 | No rate limiting on auth | Security | High | S |
| G04 | Weak JWT secret default | Security | High | S |
| G05 | Ad-hoc DB migrations | Data | High | M |
| G06 | No deployment docs/config | Docs/Ops | High | M |
| G07 | Avatar content validation | Security | Medium | S |
| G08 | Public `/uploads` without auth | Security | Medium | M |
| G09 | Open registration → active | Security/Product | Medium | S |
| G10 | Accessibility form labels | a11y | Medium | M |
| G11 | Forgot password / email verify | Functionality | Medium | M |
| G12 | Member announcements page | Functionality | Low | S |
| G13 | Audit log admin UI | Functionality | Medium | M |
| G14 | PWA offline / proper icons | UX | Low | M |
| G15 | `compactDashboard` unused | UX | Low | S |
| G16 | Redis unused / no job queue | Architecture | Low | L |
| G17 | Duplicate types/utils logic | Maintainability | Low | M |
| G18 | Admin hardcoded localhost link | UX | Low | S |
| G19 | Silent dashboard errors (member) | UX | Low | S |
| G20 | `packages/utils` empty test suite | Tests | Low | M |

*Effort: S = small (hours), M = medium (days), L = large (week+)*

---

## 15. Recommended roadmap

### Phase 1 — Production blockers (1–2 weeks)

1. GitHub Actions: lint, typecheck, build, pytest  
2. Startup validation for secrets and `DEBUG=false` in prod  
3. Rate limiting on auth endpoints  
4. Alembic initial revision + deploy migration step  
5. `docs/deployment/Deployment.md` with env checklist  

### Phase 2 — Quality & security (2–4 weeks)

1. API integration test suite (auth, welfare, voting, contributions)  
2. Avatar magic-byte validation; optional signed upload URLs  
3. Accessibility pass on register, settings, welfare forms  
4. Forgot password flow (Supabase)  
5. Global error handler (sanitized 500s)  

### Phase 3 — Product polish (ongoing)

1. Member `/announcements` or improved notification UX  
2. Admin activity log viewer  
3. Playwright smoke E2E  
4. PWA: PNG icons, optional offline shell  
5. Server-side export for large reports  
6. Email digest (if required)  

---

## 16. File reference index

| Area | Key paths |
|------|-----------|
| API entry | `apps/api/v1/main.py` |
| Config / secrets | `apps/api/v1/core/config.py`, `apps/api/.env.example` |
| Auth | `apps/api/v1/core/auth/`, `apps/api/v1/modules/auth/router.py` |
| Services | `apps/api/v1/core/services.py` |
| Models | `apps/api/v1/core/models.py` |
| Migrations | `apps/api/v1/core/init_db.py`, `apps/api/alembic/` |
| Tests | `apps/api/tests/test_algorithms.py` |
| Member app | `apps/web/member-app/src/app/` |
| Admin portal | `apps/web/admin-portal/src/app/` |
| Shared UI | `packages/ui/src/` |
| Shared types | `packages/types/src/index.ts` |
| Docker | `infrastructure/docker/` |
| Setup docs | `docs/setup/Installation.md` |

---

## 17. Sign-off

| Role | Status | Date |
|------|--------|------|
| Automated code audit | Complete | June 2026 |
| Penetration test | Not performed | — |
| Load test | Not performed | — |
| UAT with executive team | Recommended before go-live | — |

---

*This document should be updated after major releases or before production deployment. For setup instructions, see [docs/setup/Installation.md](../setup/Installation.md). For architecture context, see [docs/architecture/Architecture.md](../architecture/Architecture.md).*
