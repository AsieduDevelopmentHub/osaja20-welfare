# OSAJA'20 Welfare — Architecture

## Overview

Modular monorepo following Domain-Driven Design (DDD) with API-first REST communication.

```
osaja20-welfare/
├── apps/
│   ├── api/v1/          # FastAPI backend
│   └── web/
│       ├── member-app/  # Next.js member portal
│       └── admin-portal/# Next.js admin dashboard
├── packages/
│   ├── types/           # Shared TypeScript types
│   ├── utils/           # Algorithms & helpers
│   └── config/          # Shared constants
└── infrastructure/
    └── docker/          # PostgreSQL, Redis, API
```

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

- `auth` — Supabase Auth integration (pending)
- `members` — Registration, search, profiles
- `welfare` — Case lifecycle with FSM
- `contributions` — Ledger-backed financial records
- `voting` — Vote engine with fraud protection
- `dashboard` — Aggregated analytics

## Database

PostgreSQL with `UNIQUE(member_id, vote_id)` constraint for vote duplicate protection at the persistence layer.

## Notifications (No Celery)

Background workers are **not** used to keep hosting costs low. Instead:

| Feature | Approach |
|---------|----------|
| In-app notifications | Created synchronously via API |
| Birthday scan | On-demand `POST /notifications/scan-birthdays` |
| Announcements | Fan-out notifications at publish time |
| Push notifications | Web Push API + stored subscriptions (`POST /push/subscribe`) |

## Deployment

- Frontend: Vercel
- Backend: Render
- Database/Auth: Supabase
- Push: Web Push (VAPID keys on server when ready)
