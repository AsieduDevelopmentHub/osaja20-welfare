# Client Handover Checklist

Use this after production deploy (Render API + Vercel member + admin + SMS + landing) before handing the platform to the welfare executives.

## 1. Live URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Landing site | `https://…` | Public marketing site |
| Member portal | `https://…` | Members sign in, pay dues, vote, welfare |
| Admin portal | `https://…` | Executives manage members, cases, inquiries |
| SMS portal | `https://…` | Executives send / schedule SMS via Arkesel |
| API | `https://…onrender.com` | Backend (proxied by member, admin, and SMS apps) |

Save these in a secure place for the client. Add custom domains later if needed.

## 2. Executive admin account

Create the first administrator (one-time):

```bash
cd apps/api
# Point DATABASE_URL at production Supabase/Postgres
python scripts/create_admin.py \
  --email admin@osaja.com \
  --password "ChooseAStrongPassword32chars+" \
  --full-name "Welfare Administrator"
```

Share credentials securely (not over WhatsApp in plain text). Client should change password after first login.

**Do not** run `seed_admin.py` in production — it is blocked when `DEBUG=false`.

### Fresh start (remove test data)

After testing, wipe all member data and keep only `admin@osaja.com`:

```bash
cd apps/api
# DATABASE_URL must point at production Supabase
python scripts/purge_database.py --confirm PURGE --email admin@osaja.com
```

This deletes contributions, votes, inquiries, notifications, etc., and removes other Supabase Auth users / storage avatars when configured. **Irreversible.**

After purging, **redeploy or restart the API on Render** so in-memory member search / vote indexes reload (birthday listings now read directly from Postgres).

## 3. Production settings verification

### API (Render)

| Check | Expected |
|-------|----------|
| `GET /health` | `status: healthy`, `database_ok: true` |
| `DEBUG` | `false` |
| `REGISTRATION_AUTO_APPROVE` | `false` (executives approve new members) |
| `ALLOW_TUNNEL_CORS` | `false` |
| `MEMBER_PORTAL_URL` | Live member Vercel URL |
| `CORS_ORIGINS` | `https://member…,https://admin…,https://sms…` (comma-separated) |
| `PUBLIC_API_URL` | Live API URL (Arkesel SMS delivery webhooks) |
| `ARKESEL_API_KEY` / `ARKESEL_SENDER_ID` | Arkesel configured; sender ≤ 11 chars & approved |
| `JWT_SECRET` | 32+ random characters |
| `WHATSAPP_NUMBER` | Executive WhatsApp(s), slash-separated |
| VAPID keys | Set (push notifications) |
| Paystack keys | Live keys when going live with real payments |
| Supabase Storage | Public `avatars` bucket; `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` on Render |

### Member app (Vercel)

| Variable | Set? |
|----------|------|
| `API_PROXY_TARGET` | Render API URL |
| `NEXT_PUBLIC_SITE_URL` | Member app URL |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Matches API |

### Admin app (Vercel)

| Variable | Set? |
|----------|------|
| `API_PROXY_TARGET` | Render API URL |
| `NEXT_PUBLIC_MEMBER_APP_URL` | Member app URL |
| `NEXT_PUBLIC_SITE_URL` | Admin app URL |

### SMS app (Vercel)

| Variable | Set? |
|----------|------|
| `API_PROXY_TARGET` | Render API URL |
| `NEXT_PUBLIC_SITE_URL` | SMS app URL |
| `NEXT_PUBLIC_ADMIN_APP_URL` | Admin app URL |
| `NEXT_PUBLIC_MEMBER_APP_URL` | Member app URL |

## 4. Functional smoke test

Walk through with the client (or record a short Loom):

**Member portal**

- [ ] Register new member (should stay **pending** if `REGISTRATION_AUTO_APPROVE=false`)
- [ ] Executive approves member in admin → member can log in
- [ ] Dashboard loads dues and contributions
- [ ] Paystack test payment (test keys) or manual contribution recorded in admin
- [ ] Contact FAB → send inquiry → appears in admin **Inquiries**
- [ ] Notifications bell works
- [ ] Push notification permission (optional)
- [ ] Birthdays page
- [ ] Welfare case submission

**Admin portal**

- [ ] Log in as administrator
- [ ] Notifications bell (payments, inquiries, birthdays)
- [ ] **Inquiries** — reply to member message
- [ ] **Birthdays** — run birthday scan
- [ ] Record contribution / view ledger
- [ ] Publish announcement → members notified
- [ ] Create and publish vote
- [ ] Welfare case workflow (approve → resolve)
- [ ] Reports export (CSV)

**SMS portal**

- [ ] Log in with the same executive/admin account
- [ ] Dashboard shows **SMS credits** (`sms_balance`) and wallet (`main_balance`)
- [ ] **Compose** — send a test SMS to a real Ghana number (`055…` / `+233…`)
- [ ] Apply a **Template** on compose
- [ ] **Members yet to join** — paste contacts and send
- [ ] **History** / **Campaigns** / **Scheduled** pages load
- [ ] Settings shows Arkesel configured + webhook status

## 5. Paystack (when accepting real payments)

1. Switch API env to **live** `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY`
2. Webhook URL in Paystack dashboard:

   ```text
   https://YOUR-API.onrender.com/api/v1/payments/webhook
   ```

3. Confirm `MEMBER_PORTAL_URL` is the live member app (payment return URL)

## 6. Supabase (if using Supabase Auth)

- **Authentication → URL configuration**
  - Site URL: member portal URL
  - Redirect URLs: `https://YOUR-MEMBER-URL/reset-password`
- Service role key only on API (never in Vercel `NEXT_PUBLIC_*`)

## 7. Ongoing operations

| Task | How often | Who |
|------|-----------|-----|
| Approve new registrations | As needed | Executive |
| Reply to member inquiries | As needed | Executive |
| Record manual MoMo/bank payments | Weekly | Treasurer |
| Publish announcements | As needed | Executive |
| Send SMS campaigns (SMS portal) | As needed | Executive |
| Monitor Arkesel SMS credits | Weekly | Treasurer / Executive |
| Run birthday scan (or rely on daily job if worker enabled) | Daily / on birthdays page | Executive |
| Monitor Render/Vercel deploy logs | After each release | Technical contact |
| Database backups | Automatic (Supabase) | — |

## 8. Support contacts for the client

Document who maintains:

- Render billing / API uptime
- Vercel billing / frontend deploys (member, admin, landing, SMS)
- Supabase database
- Arkesel SMS account / sender ID / credits
- Paystack merchant account
- Domain DNS (if custom domains added)

## 9. Repository & CI

- Pushes to `main` run GitHub Actions (lint, typecheck, build, tests)
- Before releases: `pnpm ci:fast` locally
- Full pre-release: `pnpm build:verify`

## Related

- [Deployment.md](./Deployment.md) — deploy steps
- [Installation.md](../setup/Installation.md) — local development
- [sms_portal.md](../sms/sms_portal.md) — SMS portal product + Arkesel
- [Security.md](../security/Security.md) — security notes
