# OSAJA'20 Welfare Platform

**Asuofua D/A JHS Block A Batch 2020** — A premium digital welfare ecosystem for member management, contributions, welfare cases, voting, celebrations, and community governance.

## Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 15, TypeScript, Tailwind CSS |
| API | FastAPI, Python 3.12 |
| Database | PostgreSQL (Supabase) |
| Cache | Redis |
| Auth | Supabase Auth (JWT) |

## Monorepo Structure

```
apps/
  api/v1/              FastAPI REST API
  web/member-app/      Member portal (port 3000)
  web/admin-portal/    Admin dashboard (port 3001)
packages/
  types/               Shared domain types
  utils/               Data structure algorithms
  config/              Platform constants
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
pnpm install
cd infrastructure/docker && docker compose up -d postgres redis
cd ../../apps/api && pip install -r requirements.txt && uvicorn v1.main:app --reload
pnpm dev:member
pnpm dev:admin
```

See [docs/setup/Installation.md](docs/setup/Installation.md) for full setup instructions.

## API Endpoints

| Module | Base Path |
|--------|-----------|
| Health | `GET /health` |
| Members | `/api/v1/members` |
| Welfare | `/api/v1/welfare` |
| Contributions | `/api/v1/contributions` |
| Voting | `/api/v1/voting` |
| Dashboard | `/api/v1/dashboard` |

Interactive docs at `http://localhost:8000/docs`.

## License

See [LICENSE](LICENSE).
