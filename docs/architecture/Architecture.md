# OSAJA'20 Welfare — Architecture

## Overview

Modular monorepo following Domain-Driven Design (DDD) with API-first REST communication.

```
osaja20-welfare/
├── apps/
│   ├── api/v1/           # FastAPI backend
│   └── web/
│       ├── member-app/   # Next.js member portal (:3000)
│       ├── admin-portal/ # Next.js admin dashboard (:3001)
│       ├── landing/      # Public marketing site (:3002)
│       └── sms-portal/   # SMS campaigns portal (:3003)
├── packages/
│   ├── types/            # Shared TypeScript types
│   ├── utils/            # Algorithms & helpers
│   ├── config/           # Shared constants + SITE_META
│   └── ui/               # Shared UI, adminNav, smsNav
└── infrastructure/
    └── docker/           # PostgreSQL, Redis, API
```

## Platform surfaces

| App | Port (local) | Audience | Auth |
|-----|--------------|----------|------|
| Member portal | 3000 | Members | Any active member |
| Admin portal | 3001 | Executives / admins | Executive roles only |
| Landing | 3002 | Public | None |
| SMS portal | 3003 | Executives / admins | Same auth as admin |

All authenticated apps share the FastAPI backend, Postgres database, and brand system.

## Data Structure Algorithms

| Algorithm | Structure | Use Case | Complexity |
|-----------|-----------|----------|------------|
| MemberSearchTrie | Trie (prefix tree) | Member search/autocomplete | O(k) search |
| VoteEngine | Hash Set + Map | Duplicate detection & tally | O(1) per vote |
| ContributionLedger | Hash Map + append log | Balance tracking | O(1) balance lookup |
| WelfareStateMachine | FSM adjacency map | Case workflow validation | O(1) transition check |
| PriorityQueue | Min-heap | Notification scheduling | O(log n) insert/extract |
| BirthdayIndex | Day-bucket hash map | Birthday calendar | O(1) per day lookup |

## Backend Modules

- `auth` — Local JWT or Supabase Auth
- `members` — Registration, search, profiles
- `welfare` — Case lifecycle with FSM
- `contributions` — Ledger-backed financial records
- `voting` — Vote engine with fraud protection
- `dashboard` — Aggregated analytics
- `sms` — Arkesel campaigns, history, templates, delivery webhooks
- `announcements`, `notifications`, `payments`, `support`, `settings`

## SMS integration

- Provider: **Arkesel** (`POST /api/v2/sms/send`)
- Models: `sms_campaigns`, `sms_messages`, `sms_templates`
- Phone numbers normalized to `233XXXXXXXXX` (`055…`, `+233…`, `233…`)
- Optional delivery callbacks via `PUBLIC_API_URL` → `/api/v1/sms/webhooks/arkesel`
- `sms_balance` = send credits; `main_balance` = GHS wallet

See [docs/sms/sms_portal.md](../sms/sms_portal.md).

## Database

PostgreSQL with `UNIQUE(member_id, vote_id)` constraint for vote duplicate protection at the persistence layer.

Fresh local databases: run `python scripts/seed_admin.py` (creates tables via `init_database()`), then `alembic stamp head`. Do not run incremental Alembic upgrades on an empty database first.

## Notifications (No Celery)

Background workers are **not** used to keep hosting costs low. Instead:

| Feature | Approach |
|---------|----------|
| In-app notifications | Created synchronously via API |
| Birthday scan | On-demand `POST /notifications/scan-birthdays` |
| Announcements | Fan-out notifications at publish time |
| Push notifications | Web Push API + stored subscriptions (`POST /push/subscribe`) |
| SMS delivery updates | Arkesel callback webhook when `PUBLIC_API_URL` is set |

## Deployment

- Frontend apps: Vercel (member, admin, landing, SMS)
- Backend: Render
- Database/Auth: Supabase
- SMS: Arkesel
- Push: Web Push (VAPID keys on server when ready)

## Related

- [Installation](../setup/Installation.md)
- [SMS portal](../sms/sms_portal.md)
- [Deployment](../deployment/Deployment.md)
- [Security](../security/Security.md)
