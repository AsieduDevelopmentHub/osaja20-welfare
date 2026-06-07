# E2E tests (Playwright)

Smoke tests for member and admin portals.

## Prerequisites

- Member app on `:3000` and admin on `:3001` (or set `MEMBER_BASE_URL` / `ADMIN_BASE_URL`)
- Optional: API on `:8000` for authenticated flows

## Run

```bash
# Install browsers (first time)
npx playwright install chromium

# Auto-starts dev servers if not running
npx pnpm test:e2e

# Against already-running servers
PLAYWRIGHT_SKIP_WEBSERVER=1 npx pnpm test:e2e
```

## Authenticated flows (optional)

Set env vars for login integration tests (future):

```bash
E2E_MEMBER_EMAIL=member@example.com
E2E_MEMBER_PASSWORD=yourpassword
```
