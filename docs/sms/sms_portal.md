
---

# OSAJA'20 SMS PORTAL

## Overview

The OSAJA'20 SMS Portal is a dedicated administrative application within the OSAJA'20 Welfare Platform ecosystem.

It serves as the organization's centralized SMS management system, allowing authorized administrators to create, schedule, automate, monitor, and manage SMS communications with members.

Unlike the Member Portal and Administration Portal, the SMS Portal focuses exclusively on SMS communication and campaign management.

It operates as an independent web application under its own subdomain while sharing the same authentication system, database, and branding as the rest of the platform.

Note that am using ARKESEL as the 3rd party sms provider.

---

# Platform Structure

```text
                    OSAJA'20 Welfare Platform

                             │
     ┌──────────────┬──────────────┬──────────────┬──────────────┐
     │              │              │              │
     ▼              ▼              ▼              ▼

 Public Website   Member Portal   Admin Portal    SMS Portal
 www              member          admin           sms

                             │
                             ▼

                     Shared Backend Services

                             │

                    Shared Database & Storage
```

---

# Purpose

The SMS Portal provides a dedicated workspace where administrators can:

* Send SMS messages
* Create bulk SMS campaigns
* Schedule SMS campaigns
* Create reusable SMS templates
* Send announcements
* Send reminders
* Monitor SMS delivery
* View SMS history
* Manage SMS settings
* Monitor SMS balance
* Configure SMS automation

The portal is not intended for member access.

---

# Access Control

Only authorized users can access the SMS Portal.

Suggested roles:

* Super Administrator
* Executive

Members cannot log in to the SMS Portal.

---

# URL Structure

```text
www.osajawelfare.org

member.osajawelfare.org

admin.osajawelfare.org

sms.osajawelfare.org
```

---

# Authentication

The SMS Portal uses the same authentication system as the Administration Portal.

Administrators should not need separate credentials.

After authentication, access is granted based on assigned permissions.

---

# Dashboard

The dashboard provides an overview of SMS activity.

Example widgets:

```text
SMS Sent Today

SMS Sent This Month

Scheduled Messages

Pending Campaigns

Automatic Messages

SMS Balance

Delivery Success Rate

Recent Campaigns

Recent Failed Deliveries
```

---

# Navigation

```text
Dashboard

Compose SMS

Campaigns

Scheduled SMS

Templates

Recipient Groups

Automation

History

Reports

Settings
```

---

---

# Responsiveness

Mobile 1st design.
---

---

# Compose SMS

Administrators can:

* Create new SMS
* Select recipients
* Preview messages
* Estimate SMS cost
* Schedule delivery
* Send immediately

Workflow:

```text
Compose Message

↓

Choose Template (Optional)

↓

Select Recipients

↓

Preview

↓

Estimate Cost

↓

Send or Schedule

↓

Delivery Report
```

---

# Recipient Groups

Recipients are selected from the Welfare Platform.

Available groups include:

* All Members
* Registered Members
* Members Yet to Join
* Executive Members
* Welfare Committee
* Members with Outstanding Dues
* Birthday Celebrants
* Custom Selection

No duplicate contact list is maintained within the SMS Portal.

---

# SMS Campaigns

Every bulk SMS is treated as a campaign.

Campaign information includes:

* Campaign name
* Message content
* Recipient count
* Scheduled time
* Delivery status
* Delivery summary
* Cost estimate
* Created by
* Created date

---

# SMS Templates

The system provides reusable templates.

Examples:

* Birthday Wishes
* Meeting Reminder
* Contribution Reminder
* Welfare Update
* Emergency Notice
* Election Notice
* Event Invitation
* Registration Invitation

Administrators can create additional templates.

---

# Automation

The SMS Portal includes an automation engine for recurring communications.

### Birthday Messages

Every morning:

```text
Check Today's Birthdays

↓

Generate Birthday Message

↓

Send SMS

↓

Save History
```

---

### Monthly Contribution Reminder

Near the end of each month:

```text
Check Outstanding Contributions

↓

Generate Reminder

↓

Send SMS

↓

Record Delivery
```

---

### Meeting Reminder

```text
Meeting Scheduled

↓

Reminder Date Reached

↓

Send SMS

↓

Log Activity
```

---

### Voting Reminder

```text
Voting Opens

↓

Identify Eligible Members

↓

Send Reminder SMS

↓

Record Delivery
```

---

### Welcome Message

```text
New Member Approved

↓

Send Welcome SMS

↓

Save Activity
```

---

### Registration Invitation

For members who have not yet registered:

```text
Select Unregistered Members

↓

Generate Invitation

↓

Send Registration SMS

↓

Record Campaign
```

---

# SMS History

Every SMS sent through the system is stored.

History includes:

* Date and time
* Sender
* Recipient
* Message
* Campaign
* Delivery status
* SMS cost
* API response

Administrators can search, filter, and export SMS history.

---

# Reports

The portal provides reporting for:

* SMS usage
* Delivery performance
* Campaign summaries
* Monthly SMS statistics
* Failed deliveries
* Estimated SMS costs

---

# Settings

Administrators can configure:

* SMS Sender ID
* Arkesel API Key
* Default SMS templates
* Automation rules
* Scheduled sending preferences

---

# SMS Provider

The first implementation uses **Arkesel SMS**.

The integration is designed so that additional providers can be added in the future without affecting the user interface or workflow.

---

# Design Requirements

The SMS Portal must match the existing OSAJA'20 ecosystem.

It should reuse the same:

* Branding
* Logo
* Color palette
* Typography
* Dashboard layout
* Sidebar navigation
* Card components
* Buttons
* Tables
* Animations
* Responsive behavior

A user moving between `member.osajawelfare.org`, `admin.osajawelfare.org`, and `sms.osajawelfare.org` should immediately recognize that they are part of the same platform ecosystem.

---

# Integration

The SMS Portal does not store member information independently.

Instead, it reads data from the existing Welfare Platform, including:

* Member profiles
* Phone numbers
* Membership status
* Contribution status
* Birthdays
* Meetings
* Announcements
* Voting events

This ensures there is a single source of truth for all member information while the SMS Portal focuses solely on managing and delivering SMS communications.

---

# Implementation status (codebase)

The SMS Portal is implemented in this monorepo on branch `feature/sms-portal` (and subsequent merges).

| Area | Location |
|------|----------|
| Web app | `apps/web/sms-portal` (`pnpm dev:sms` → http://localhost:3003) |
| API module | `apps/api/v1/modules/sms` → `/api/v1/sms/*` |
| Arkesel client | `apps/api/v1/core/arkesel_client.py` |
| Models | `sms_campaigns`, `sms_messages`, `sms_templates` |
| Nav / modules | `packages/ui/src/sms-nav.ts` |
| Env (API) | `ARKESEL_*`, `PUBLIC_API_URL` in `apps/api/.env.example` |
| Env (web) | `apps/web/sms-portal/.env.local.example` |

### Working features

- Login (executive / administrator only; same accounts as admin portal)
- Dashboard (SMS credits = `sms_balance`, wallet = `main_balance`)
- Compose **3-step mobile wizard** (templates, GSM-7/UCS-2 segment meter, phone preview, recipients, schedule, cost estimate)
- Recipient groups: built-ins + **custom phone lists** (numbers / name+number); hide/restore built-ins; **Members yet to join** uses a paste-contacts card (no DB roster)
- Campaigns; **Scheduled detail** (countdown, edit message/time before send, cancel); History; Templates with **custom category** + **workflow binding** (birthday / dues)
- Default automations seeded: birthday, outstanding dues, month-end unpaid dues — editable/removable/creatable
- Reports (monthly usage, delivery breakdown, Excel/CSV export)
- Sender ID: Arkesel enforces **max 11 characters** (use `OSAJA20`)
- PWA install banner + service worker (same pattern as admin/member)
- Phone sanitize: `055…`, `+233…`, `233…`, `2330…`
- Delivery webhook: `/api/v1/sms/webhooks/arkesel` when `PUBLIC_API_URL` is public HTTPS

### Still product backlog (from this doc)

- Scheduled cron worker for automation (workflows are runnable on demand today)
- Welcome SMS hook on member approval
- Meeting / voting reminder automation jobs
- Multi-provider abstraction beyond Arkesel (architecture allows it)

### Local git branch (historical)

```bash
git checkout -b feature/sms-portal
```

