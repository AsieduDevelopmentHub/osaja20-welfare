# OSAJA'20 Welfare Platform

**Asuofua D/A JHS Block A Batch 2020** — A premium digital welfare ecosystem for member management, contributions, welfare cases, voting, celebrations, SMS campaigns, and community governance.

## Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 15, TypeScript, Tailwind CSS |
| API | FastAPI, Python 3.12 |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) / local JWT for development |
| SMS | Arkesel SMS API v2 |
| Notifications | In-app + Web Push (no Celery) |

## Monorepo Structure

```
apps/
  api/v1/              FastAPI REST API
  web/member-app/      Member portal (port 3000)
  web/admin-portal/    Admin dashboard (port 3001)
  web/landing/         Public marketing site (port 3002)
  web/sms-portal/      SMS campaigns portal (port 3003)
packages/
  types/               Shared domain types
  utils/               Data structure algorithms
  config/              Platform constants
  ui/                  Shared UI + nav configs
infrastructure/docker/   PostgreSQL + Redis
docs/                  Architecture & setup guides
```

## Data Structure Algorithms

The platform uses purpose-built algorithms for robustness:

- **Trie** — O(k) member prefix search across name, email, membership ID
- **Vote Engine** — Hash-based duplicate protection + efficient tally with `UNIQUE(member_id, vote_id)` at DB level
- **Contribution Ledger** — Append-only ledger with O(1) balance lookups and reconciliation
- **Welfare FSM** — Finite state machine enforcing valid case workflow transitions
- **Priority Queue** — Min-heap for scheduled notification dispatch
- **Birthday Index** — Day-bucket index for O(1) celebration lookups

## Quick Start

```bash
npx pnpm@9.15.0 install

# One-time local setup: creates apps/api/.venv and copies local env examples
pnpm setup:local

# Starts the API and all four web apps (SQLite; Docker is not required)
pnpm dev:all
```

| App | Local URL |
|-----|-----------|
| Member portal | http://localhost:3000 |
| Admin dashboard | http://localhost:3001 |
| Public landing site | http://localhost:3002 |
| SMS portal | http://localhost:3003 |
| API / interactive docs | http://localhost:8000/docs |

`pnpm dev:all` requires these ports to be free. Press Ctrl+C to stop all processes.
PostgreSQL and Redis are optional; see [docs/setup/Installation.md](docs/setup/Installation.md) for the Docker-based option and full setup instructions.
SMS portal product spec: [docs/sms/sms_portal.md](docs/sms/sms_portal.md).
Bra Fie Night ticketing setup and operational limits: [docs/setup/Installation.md](docs/setup/Installation.md#bra-fie-night-ticketing).

## API Endpoints

| Module | Base Path |
|--------|-----------|
| Health | `GET /health` |
| Members | `/api/v1/members` |
| Welfare | `/api/v1/welfare` |
| Contributions | `/api/v1/contributions` |
| Voting | `/api/v1/voting` |
| Dashboard | `/api/v1/dashboard` |
| SMS | `/api/v1/sms` |

Interactive docs at `http://localhost:8000/docs`.

## License

See [LICENSE](LICENSE).
