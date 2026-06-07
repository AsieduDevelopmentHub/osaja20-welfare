# Security Guide

Security practices for the OSAJA'20 Welfare Platform.

## Authentication

- **Local dev:** bcrypt passwords + API-issued JWT (`USE_LOCAL_AUTH=true`)
- **Production:** Supabase Auth with API JWT that embeds `member_id`
- **RBAC:** Roles (`administrator`, `executive`, `member`) are always read from the database, not trusted from the JWT alone

## Implemented controls

| Control | Details |
|---------|---------|
| Rate limiting | `/auth/login`, `/auth/register`, `/auth/forgot-password` — per-IP limits (`RATE_LIMIT_AUTH_PER_MINUTE`) |
| Push test limit | `POST /push/test` throttled per IP |
| Async job queue | Push delivery via Redis queue when available; sync fallback |
| Email digest | SMTP-only when `EMAIL_ENABLED=true`; weekly opt-in via member pref |
| Startup validation | `DEBUG=false` requires strong `JWT_SECRET` and PostgreSQL |
| Registration approval | `REGISTRATION_AUTO_APPROVE=false` keeps new accounts `pending` until executive activates |
| Account status | `pending`, `inactive`, and `archived` accounts cannot use the API |
| Avatar validation | Magic-byte verification; 2 MB cap; JPEG/PNG/WebP only |
| Upload serving | Only `/uploads/avatars/{uuid}.ext` — no directory listing or arbitrary paths |
| CORS | Explicit `CORS_ORIGINS`; tunnel regex disabled when `ALLOW_TUNNEL_CORS=false` |
| OpenAPI | `/docs` and `/redoc` disabled when `DEBUG=false` |
| Error responses | Unhandled 500s return generic message (no stack traces) |
| Sensitive fields | `auth_user_id` omitted from public member API responses |

## Secrets management

Never commit:

- `apps/api/.env`
- `apps/web/*/.env.local`
- VAPID private keys
- `uploads/` user content

Rotate `JWT_SECRET` and VAPID keys if compromised — all users must re-login and re-subscribe to push.

## Production environment variables

```env
DEBUG=false
JWT_SECRET=<64+ char random string>
REGISTRATION_AUTO_APPROVE=false
ALLOW_TUNNEL_CORS=false
CORS_ORIGINS=https://members.example.com,https://admin.example.com
```

## Reporting vulnerabilities

Contact the platform administrator directly. Do not open public issues for undisclosed security bugs.

## Remaining recommendations

- Add GitHub Actions CI with `pip audit` / `npm audit`
- Consider WAF or reverse-proxy rate limiting for DDoS
- Enable Supabase JWT audience verification
- Penetration test before public launch
- Signed avatar URLs if avatars must stay private

## Related

- [Deployment](../deployment/Deployment.md)
- [System audit](../audit/SYSTEM_AUDIT.md)
