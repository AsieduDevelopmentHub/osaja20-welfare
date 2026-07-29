"""SMS campaign and delivery orchestration (Arkesel provider)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import and_, delete, extract, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core import arkesel_client
from v1.core.arkesel_client import (
    ArkeselError,
    estimate_units,
    normalize_gh_msisdn,
    parse_phone_list,
    sms_encoding,
    sms_page_count,
)
from v1.core.config import settings
from v1.core.models import (
    Contribution,
    Member,
    MemberStatus,
    SmsCampaign,
    SmsCampaignStatus,
    SmsDeliveryStatus,
    SmsMessage,
    SmsTemplate,
    UserRole,
)
from v1.core.platform_settings import get_monthly_dues_amount
from v1.core.dues import DUES_REMINDER_DAYS_BEFORE_MONTH_END

# Ghana (Africa/Accra) has no DST and matches UTC year-round.
GHANA_TZ = timezone.utc

ARKSEL_STATUS_MAP = {
    "DELIVERED": SmsDeliveryStatus.DELIVERED.value,
    "SUBMITTED": SmsDeliveryStatus.SUBMITTED.value,
    "QUEUED": SmsDeliveryStatus.SUBMITTED.value,
    "SCHEDULED": SmsDeliveryStatus.SCHEDULED.value,
    "NOT_DELIVERED": SmsDeliveryStatus.FAILED.value,
    "FAILED": SmsDeliveryStatus.FAILED.value,
    "EXPIRED": SmsDeliveryStatus.FAILED.value,
    "PROHIBITED": SmsDeliveryStatus.FAILED.value,
    "INVALID": SmsDeliveryStatus.INVALID.value,
}

RECIPIENT_GROUPS: list[dict[str, str]] = [
    {"id": "all", "label": "All Members", "description": "Every member with a phone number"},
    {"id": "active", "label": "Registered Members", "description": "Active members only"},
    {
        "id": "pending",
        "label": "Members Yet to Join",
        "description": "Paste contacts at compose time (not stored as members yet)",
    },
    {"id": "executive", "label": "Executive Members", "description": "Administrators and executives"},
    {
        "id": "welfare_committee",
        "label": "Welfare Committee",
        "description": "Executive roles managing welfare operations",
    },
    {
        "id": "outstanding_dues",
        "label": "Outstanding Dues",
        "description": "Active members who have not paid this month's dues",
    },
    {"id": "birthdays_today", "label": "Birthday Celebrants", "description": "Members with birthday today"},
    {"id": "custom", "label": "Custom Selection", "description": "Pick members and/or paste contacts"},
]

SMS_AUTOMATION_KEY = "sms_automation"
SMS_CUSTOM_GROUPS_KEY = "sms_custom_groups"
SMS_TEMPLATE_META_KEY = "sms_template_meta"

MEMBER_PORTAL_URL = "https://member.osajawelfare.org"

TRIGGER_PRESETS: dict[str, dict[str, str]] = {
    "birthday": {
        "recipient_group": "birthdays_today",
        "default_message": (
            "Happy Birthday from OSAJA'20 Welfare! "
            "Wishing you joy, health, and a wonderful year ahead."
        ),
    },
    "outstanding_dues": {
        "recipient_group": "outstanding_dues",
        "default_message": (
            "OSAJA'20 Welfare reminder: your monthly dues are still outstanding. "
            f"Please pay at {MEMBER_PORTAL_URL} Thank you."
        ),
    },
    "dues_month_end": {
        "recipient_group": "outstanding_dues",
        "default_message": (
            "OSAJA'20 Welfare: the month is ending soon and your dues are still unpaid. "
            f"Please pay at {MEMBER_PORTAL_URL} before month-end. Thank you."
        ),
    },
    "members_yet_to_join": {
        "recipient_group": "pending",
        "default_message": (
            "OSAJA'20 Welfare: you are invited to complete your membership. "
            f"Join and register at {MEMBER_PORTAL_URL}"
        ),
    },
    "manual": {
        "recipient_group": "active",
        "default_message": "",
    },
}

DEFAULT_WORKFLOWS: list[dict] = [
    {
        "id": "00000000-0000-4000-8000-000000000001",
        "name": "Birthday wishes",
        "trigger": "birthday",
        "recipient_group": "birthdays_today",
        "message": TRIGGER_PRESETS["birthday"]["default_message"],
        "enabled": True,
        "template_id": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "last_run_at": None,
        "is_default": True,
        "requires_phones": False,
    },
    {
        "id": "00000000-0000-4000-8000-000000000002",
        "name": "Outstanding dues",
        "trigger": "outstanding_dues",
        "recipient_group": "outstanding_dues",
        "message": TRIGGER_PRESETS["outstanding_dues"]["default_message"],
        "enabled": True,
        "template_id": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "last_run_at": None,
        "is_default": True,
        "requires_phones": False,
    },
    {
        "id": "00000000-0000-4000-8000-000000000003",
        "name": "Month-end dues reminder",
        "trigger": "dues_month_end",
        "recipient_group": "outstanding_dues",
        "message": TRIGGER_PRESETS["dues_month_end"]["default_message"],
        "enabled": True,
        "template_id": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "last_run_at": None,
        "is_default": True,
        "requires_phones": False,
    },
    {
        "id": "00000000-0000-4000-8000-000000000004",
        "name": "Members yet to join",
        "trigger": "members_yet_to_join",
        "recipient_group": "pending",
        "message": TRIGGER_PRESETS["members_yet_to_join"]["default_message"],
        "enabled": True,
        "template_id": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "last_run_at": None,
        "is_default": True,
        "requires_phones": True,
    },
]

DEFAULT_AUTOMATION: dict = {
    "workflows": list(DEFAULT_WORKFLOWS),
    "initialized": True,
}


def _campaign_dict(campaign: SmsCampaign, *, include_response: bool = False) -> dict:
    data = {
        "id": str(campaign.id),
        "name": campaign.name,
        "message": campaign.message,
        "recipient_group": campaign.recipient_group,
        "recipient_count": campaign.recipient_count,
        "status": campaign.status,
        "provider": campaign.provider,
        "sender_id": campaign.sender_id,
        "estimated_units": campaign.estimated_units,
        "scheduled_at": campaign.scheduled_at.isoformat() if campaign.scheduled_at else None,
        "sent_at": campaign.sent_at.isoformat() if campaign.sent_at else None,
        "created_by": str(campaign.created_by),
        "sandbox": campaign.sandbox,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "updated_at": campaign.updated_at.isoformat() if campaign.updated_at else None,
    }
    if include_response:
        data["provider_response"] = campaign.provider_response
    return data


def _message_dict(row: SmsMessage, *, member_name: str | None = None) -> dict:
    return {
        "id": str(row.id),
        "campaign_id": str(row.campaign_id),
        "member_id": str(row.member_id) if row.member_id else None,
        "member_name": member_name,
        "recipient_phone": row.recipient_phone,
        "message": row.message,
        "status": row.status,
        "provider_message_id": row.provider_message_id,
        "cost_units": row.cost_units,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _template_dict(row: SmsTemplate) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "body": row.body,
        "category": row.category,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


class SmsService:
    async def _get_setting(self, db: AsyncSession, key: str, default: dict | None = None) -> dict:
        from v1.core.models import PlatformSetting

        row = await db.get(PlatformSetting, key)
        if row and isinstance(row.value, dict):
            return dict(row.value)
        return dict(default or {})

    async def _put_setting(self, db: AsyncSession, key: str, value: dict) -> dict:
        from v1.core.models import PlatformSetting

        row = await db.get(PlatformSetting, key)
        if row:
            row.value = value
        else:
            db.add(PlatformSetting(key=key, value=value))
        await db.commit()
        return value

    async def get_custom_groups_state(self, db: AsyncSession) -> dict:
        state = await self._get_setting(
            db, SMS_CUSTOM_GROUPS_KEY, {"groups": [], "hidden_builtin_ids": []}
        )
        state.setdefault("groups", [])
        state.setdefault("hidden_builtin_ids", [])
        return state

    async def list_recipient_groups(self, db: AsyncSession) -> list[dict]:
        state = await self.get_custom_groups_state(db)
        hidden = set(state.get("hidden_builtin_ids") or [])
        groups = []
        for meta in RECIPIENT_GROUPS:
            if meta["id"] in hidden:
                continue
            if meta["id"] == "pending":
                groups.append(
                    {
                        **meta,
                        "count": 0,
                        "total_members": 0,
                        "requires_manual_phones": True,
                        "builtin": True,
                    }
                )
                continue
            if meta["id"] == "custom":
                groups.append(
                    {
                        **meta,
                        "count": 0,
                        "total_members": 0,
                        "requires_manual_phones": False,
                        "builtin": True,
                    }
                )
                continue
            members = await self.resolve_recipients(db, group=meta["id"], member_ids=[])
            valid = sum(1 for m in members if normalize_gh_msisdn(m.phone_number))
            groups.append(
                {
                    **meta,
                    "count": valid,
                    "total_members": len(members),
                    "requires_manual_phones": False,
                    "builtin": True,
                }
            )

        for cg in state.get("groups") or []:
            contacts = cg.get("contacts") or []
            valid = 0
            for c in contacts:
                if normalize_gh_msisdn(str(c.get("phone") or "")):
                    valid += 1
            groups.append(
                {
                    "id": str(cg.get("id")),
                    "label": str(cg.get("name") or "Custom group"),
                    "description": f"{len(contacts)} saved contact(s)",
                    "count": valid,
                    "total_members": len(contacts),
                    "requires_manual_phones": False,
                    "builtin": False,
                    "contacts": contacts,
                }
            )
        return groups

    async def create_custom_group(
        self,
        db: AsyncSession,
        *,
        name: str,
        contacts: list[dict],
    ) -> dict:
        cleaned: list[dict] = []
        seen: set[str] = set()
        for raw in contacts:
            phone = str((raw or {}).get("phone") or "").strip()
            display = str((raw or {}).get("name") or "").strip() or None
            msisdn = normalize_gh_msisdn(phone)
            if not msisdn or msisdn in seen:
                continue
            seen.add(msisdn)
            cleaned.append({"name": display, "phone": msisdn})
        if not cleaned:
            raise ValueError("Add at least one valid Ghana phone number")
        state = await self.get_custom_groups_state(db)
        group = {
            "id": f"cg_{uuid4()}",
            "name": name.strip() or "Custom group",
            "contacts": cleaned,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        state["groups"] = list(state.get("groups") or []) + [group]
        await self._put_setting(db, SMS_CUSTOM_GROUPS_KEY, state)
        return group

    async def delete_custom_group(self, db: AsyncSession, group_id: str) -> None:
        state = await self.get_custom_groups_state(db)
        groups = list(state.get("groups") or [])
        next_groups = [g for g in groups if str(g.get("id")) != str(group_id)]
        if len(next_groups) == len(groups):
            # Hide builtin group instead
            builtin_ids = {g["id"] for g in RECIPIENT_GROUPS}
            if group_id in builtin_ids and group_id not in {"custom"}:
                hidden = set(state.get("hidden_builtin_ids") or [])
                hidden.add(group_id)
                state["hidden_builtin_ids"] = sorted(hidden)
                await self._put_setting(db, SMS_CUSTOM_GROUPS_KEY, state)
                return
            raise ValueError("Recipient group not found")
        state["groups"] = next_groups
        await self._put_setting(db, SMS_CUSTOM_GROUPS_KEY, state)

    async def restore_builtin_groups(self, db: AsyncSession) -> dict:
        state = await self.get_custom_groups_state(db)
        state["hidden_builtin_ids"] = []
        await self._put_setting(db, SMS_CUSTOM_GROUPS_KEY, state)
        return state

    async def resolve_recipients(
        self,
        db: AsyncSession,
        *,
        group: str,
        member_ids: list[UUID],
    ) -> list[Member]:
        if group.startswith("cg_"):
            return []

        query = select(Member)

        if group == "custom":
            if not member_ids:
                return []
            query = query.where(Member.id.in_(member_ids))
        elif group == "all":
            query = query.where(Member.status != MemberStatus.ARCHIVED.value)
        elif group == "active":
            query = query.where(Member.status == MemberStatus.ACTIVE.value)
        elif group == "pending":
            # Yet-to-join contacts are pasted at compose time — no DB roster.
            return []
        elif group in ("executive", "welfare_committee"):
            query = query.where(
                Member.role.in_([UserRole.ADMINISTRATOR.value, UserRole.EXECUTIVE.value]),
                Member.status != MemberStatus.ARCHIVED.value,
            )
        elif group == "birthdays_today":
            today = date.today()
            query = query.where(
                Member.status == MemberStatus.ACTIVE.value,
                extract("month", Member.date_of_birth) == today.month,
                extract("day", Member.date_of_birth) == today.day,
            )
        elif group == "outstanding_dues":
            return await self._members_with_outstanding_dues(db)
        else:
            raise ValueError(f"Unknown recipient group: {group}")

        result = await db.execute(query.order_by(Member.full_name.asc()))
        return list(result.scalars().all())

    async def resolve_custom_group_phones(self, db: AsyncSession, group_id: str) -> list[str]:
        state = await self.get_custom_groups_state(db)
        group = next((g for g in (state.get("groups") or []) if str(g.get("id")) == str(group_id)), None)
        if not group:
            raise ValueError("Custom recipient group not found")
        phones: list[str] = []
        for c in group.get("contacts") or []:
            msisdn = normalize_gh_msisdn(str(c.get("phone") or ""))
            if msisdn:
                phones.append(msisdn)
        return phones

    async def _members_with_outstanding_dues(self, db: AsyncSession) -> list[Member]:
        """Active members who have not fully paid the current calendar month's dues."""
        today = date.today()
        monthly = await get_monthly_dues_amount(db)
        active = list(
            (
                await db.execute(
                    select(Member)
                    .where(Member.status == MemberStatus.ACTIVE.value)
                    .order_by(Member.full_name.asc())
                )
            )
            .scalars()
            .all()
        )
        if not active:
            return []

        paid_rows = await db.execute(
            select(Contribution.member_id, func.coalesce(func.sum(Contribution.amount), 0))
            .where(
                Contribution.type == "dues",
                Contribution.period_year == today.year,
                Contribution.period_month == today.month,
            )
            .group_by(Contribution.member_id)
        )
        paid_map = {mid: float(amount or 0) for mid, amount in paid_rows.all()}
        return [m for m in active if paid_map.get(m.id, 0.0) < monthly]

    async def estimate(
        self,
        db: AsyncSession,
        *,
        message: str,
        recipient_group: str,
        member_ids: list[UUID],
        phones: list[str] | None = None,
    ) -> dict:
        extra_phones = list(phones or [])
        if recipient_group.startswith("cg_"):
            members: list[Member] = []
            extra_phones.extend(await self.resolve_custom_group_phones(db, recipient_group))
        else:
            members = await self.resolve_recipients(
                db, group=recipient_group, member_ids=member_ids
            )
        valid_phones: list[str] = []
        invalid = 0
        for member in members:
            msisdn = normalize_gh_msisdn(member.phone_number)
            if msisdn:
                valid_phones.append(msisdn)
            else:
                invalid += 1
        manual_valid, manual_invalid = parse_phone_list(extra_phones)
        valid_phones.extend(manual_valid)
        invalid += len(manual_invalid)
        unique = list(dict.fromkeys(valid_phones))
        pages = sms_page_count(message)
        units = estimate_units(message, len(unique))
        return {
            "recipient_count": len(unique),
            "invalid_phone_count": invalid,
            "pages_per_message": pages,
            "estimated_units": units,
            "character_count": len(message),
            "encoding": sms_encoding(message),
            "sender_id": settings.arkesel_sender,
            "arkesel_configured": arkesel_client.is_configured(),
            "sandbox": settings.arkesel_sandbox,
            "sms_credits_needed": units,
        }

    async def compose_and_send(
        self,
        db: AsyncSession,
        *,
        actor: Member,
        message: str,
        name: str | None,
        recipient_group: str,
        member_ids: list[UUID],
        phones: list[str] | None,
        schedule_at: datetime | None,
        sandbox: bool | None,
    ) -> dict:
        if not arkesel_client.is_configured():
            raise ArkeselError("Arkesel is not configured — set ARKESEL_API_KEY")

        merged_phones = list(phones or [])
        if recipient_group.startswith("cg_"):
            members: list[Member] = []
            merged_phones.extend(await self.resolve_custom_group_phones(db, recipient_group))
        else:
            members = await self.resolve_recipients(
                db, group=recipient_group, member_ids=member_ids
            )
        recipients: list[tuple[Member | None, str]] = []
        seen: set[str] = set()
        for member in members:
            msisdn = normalize_gh_msisdn(member.phone_number)
            if not msisdn or msisdn in seen:
                continue
            seen.add(msisdn)
            recipients.append((member, msisdn))

        manual_valid, manual_invalid = parse_phone_list(merged_phones)
        for msisdn in manual_valid:
            if msisdn in seen:
                continue
            seen.add(msisdn)
            recipients.append((None, msisdn))

        if not recipients:
            hint = ""
            if manual_invalid:
                hint = f" Invalid entries: {', '.join(manual_invalid[:5])}"
            raise ValueError(
                "No recipients with valid Ghana mobile numbers. "
                "Use 055…, +233…, or 233… formats."
                + hint
            )

        use_sandbox = settings.arkesel_sandbox if sandbox is None else sandbox
        pages = sms_page_count(message)
        units = estimate_units(message, len(recipients))
        campaign_name = (name or "").strip() or f"SMS {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"

        scheduled_at = schedule_at
        if scheduled_at and scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=GHANA_TZ)
        elif scheduled_at:
            scheduled_at = scheduled_at.astimezone(GHANA_TZ)

        campaign = SmsCampaign(
            name=campaign_name,
            message=message,
            recipient_group=recipient_group,
            recipient_count=len(recipients),
            status=SmsCampaignStatus.SCHEDULED.value if scheduled_at else SmsCampaignStatus.SENDING.value,
            provider="arkesel",
            sender_id=settings.arkesel_sender,
            estimated_units=units,
            scheduled_at=scheduled_at.astimezone(timezone.utc) if scheduled_at else None,
            created_by=actor.id,
            sandbox=use_sandbox,
        )
        db.add(campaign)
        await db.flush()

        for member, msisdn in recipients:
            db.add(
                SmsMessage(
                    campaign_id=campaign.id,
                    member_id=member.id if member else None,
                    recipient_phone=msisdn,
                    message=message,
                    status=SmsDeliveryStatus.SCHEDULED.value if scheduled_at else SmsDeliveryStatus.PENDING.value,
                    cost_units=pages,
                )
            )
        await db.flush()

        scheduled_date = None
        if scheduled_at:
            scheduled_date = scheduled_at.astimezone(GHANA_TZ).strftime("%Y-%m-%d %I:%M %p")

        try:
            provider_payload = await arkesel_client.send_sms(
                message=message,
                recipients=[msisdn for _, msisdn in recipients],
                scheduled_date=scheduled_date,
                sandbox=use_sandbox,
                callback_url=settings.arkesel_callback_url,
            )
        except ArkeselError as exc:
            campaign.status = SmsCampaignStatus.FAILED.value
            campaign.provider_response = {"error": str(exc), "payload": getattr(exc, "payload", None)}
            await db.execute(
                update(SmsMessage)
                .where(SmsMessage.campaign_id == campaign.id)
                .values(status=SmsDeliveryStatus.FAILED.value)
            )
            await db.commit()
            await db.refresh(campaign)
            raise

        campaign.provider_response = provider_payload
        id_by_recipient: dict[str, str] = {}
        invalid_numbers: list[str] = []
        for item in provider_payload.get("data") or []:
            if not isinstance(item, dict):
                continue
            if "invalid numbers" in item:
                invalid_numbers.extend(str(n) for n in (item.get("invalid numbers") or []))
                continue
            recipient = str(item.get("recipient") or "")
            msg_id = item.get("id")
            if recipient and msg_id:
                id_by_recipient[recipient] = str(msg_id)

        msg_result = await db.execute(select(SmsMessage).where(SmsMessage.campaign_id == campaign.id))
        messages = list(msg_result.scalars().all())
        failed = 0
        for row in messages:
            if row.recipient_phone in invalid_numbers:
                row.status = SmsDeliveryStatus.INVALID.value
                failed += 1
                continue
            provider_id = id_by_recipient.get(row.recipient_phone)
            if provider_id:
                row.provider_message_id = provider_id
            row.status = (
                SmsDeliveryStatus.SCHEDULED.value if scheduled_at else SmsDeliveryStatus.SUBMITTED.value
            )

        if scheduled_at:
            campaign.status = SmsCampaignStatus.SCHEDULED.value
        elif failed and failed < len(messages):
            campaign.status = SmsCampaignStatus.PARTIAL.value
            campaign.sent_at = datetime.now(timezone.utc)
        elif failed == len(messages):
            campaign.status = SmsCampaignStatus.FAILED.value
        else:
            campaign.status = SmsCampaignStatus.SENT.value
            campaign.sent_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(campaign)
        return {
            "campaign": _campaign_dict(campaign, include_response=True),
            "submitted": len(messages) - failed,
            "invalid": failed,
            "skipped_invalid_inputs": manual_invalid,
            "estimated_units": units,
            "delivery_webhook_enabled": bool(settings.arkesel_callback_url),
        }

    async def dashboard_stats(self, db: AsyncSession) -> dict:
        now = datetime.now(timezone.utc)
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        async def _count_messages(*, since: datetime | None = None, status: str | None = None) -> int:
            stmt = select(func.count()).select_from(SmsMessage)
            conditions = []
            if since is not None:
                conditions.append(SmsMessage.created_at >= since)
            if status is not None:
                conditions.append(SmsMessage.status == status)
            if conditions:
                stmt = stmt.where(and_(*conditions))
            return int((await db.execute(stmt)).scalar() or 0)

        sent_today = await _count_messages(since=start_today)
        sent_month = await _count_messages(since=start_month)
        failed_recent = await _count_messages(since=start_month, status=SmsDeliveryStatus.FAILED.value)

        scheduled = int(
            (
                await db.execute(
                    select(func.count()).select_from(SmsCampaign).where(
                        SmsCampaign.status == SmsCampaignStatus.SCHEDULED.value
                    )
                )
            ).scalar()
            or 0
        )
        pending_campaigns = int(
            (
                await db.execute(
                    select(func.count()).select_from(SmsCampaign).where(
                        SmsCampaign.status.in_(
                            [
                                SmsCampaignStatus.QUEUED.value,
                                SmsCampaignStatus.SENDING.value,
                                SmsCampaignStatus.DRAFT.value,
                            ]
                        )
                    )
                )
            ).scalar()
            or 0
        )

        delivered = await _count_messages(since=start_month, status=SmsDeliveryStatus.DELIVERED.value)
        submitted = await _count_messages(since=start_month, status=SmsDeliveryStatus.SUBMITTED.value)
        success_rate = None
        denom = delivered + submitted + failed_recent
        if denom:
            success_rate = round(((delivered + submitted) / denom) * 100, 1)

        balance = None
        balance_error = None
        if arkesel_client.is_configured():
            try:
                balance = await arkesel_client.get_balance()
            except ArkeselError as exc:
                balance_error = str(exc)

        recent = await db.execute(
            select(SmsCampaign).order_by(SmsCampaign.created_at.desc()).limit(5)
        )
        failed_msgs = await db.execute(
            select(SmsMessage, Member.full_name)
            .outerjoin(Member, Member.id == SmsMessage.member_id)
            .where(
                or_(
                    SmsMessage.status == SmsDeliveryStatus.FAILED.value,
                    SmsMessage.status == SmsDeliveryStatus.INVALID.value,
                )
            )
            .order_by(SmsMessage.created_at.desc())
            .limit(5)
        )

        return {
            "sms_sent_today": sent_today,
            "sms_sent_this_month": sent_month,
            "scheduled_messages": scheduled,
            "pending_campaigns": pending_campaigns,
            "automatic_messages": 0,
            "failed_deliveries": failed_recent,
            "delivery_success_rate": success_rate,
            "balance": balance,
            "balance_error": balance_error,
            "arkesel_configured": arkesel_client.is_configured(),
            "sender_id": settings.arkesel_sender,
            "sandbox": settings.arkesel_sandbox,
            "recent_campaigns": [_campaign_dict(c) for c in recent.scalars().all()],
            "recent_failed": [
                _message_dict(msg, member_name=name) for msg, name in failed_msgs.all()
            ],
        }

    async def list_campaigns(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> dict:
        conditions = []
        if status:
            conditions.append(SmsCampaign.status == status)
        count_stmt = select(func.count()).select_from(SmsCampaign)
        list_stmt = select(SmsCampaign)
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
            list_stmt = list_stmt.where(and_(*conditions))
        total = int((await db.execute(count_stmt)).scalar() or 0)
        result = await db.execute(
            list_stmt.order_by(SmsCampaign.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        now = datetime.now(timezone.utc)
        items = []
        for c in result.scalars().all():
            row = _campaign_dict(c)
            if c.status == SmsCampaignStatus.SCHEDULED.value and c.scheduled_at:
                row["schedule_state"] = "due" if c.scheduled_at <= now else "upcoming"
            elif c.status == SmsCampaignStatus.CANCELLED.value:
                row["schedule_state"] = "cancelled"
            elif c.status in (SmsCampaignStatus.SENT.value, SmsCampaignStatus.PARTIAL.value):
                row["schedule_state"] = "sent"
            else:
                row["schedule_state"] = c.status
            items.append(row)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }

    async def list_history(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        q: str | None = None,
    ) -> dict:
        conditions = []
        if status:
            conditions.append(SmsMessage.status == status)
        if q:
            like = f"%{q.strip()}%"
            conditions.append(
                or_(
                    SmsMessage.recipient_phone.ilike(like),
                    SmsMessage.message.ilike(like),
                    Member.full_name.ilike(like),
                )
            )

        base = select(SmsMessage).outerjoin(Member, Member.id == SmsMessage.member_id)
        count_stmt = select(func.count()).select_from(SmsMessage).outerjoin(
            Member, Member.id == SmsMessage.member_id
        )
        if conditions:
            base = base.where(and_(*conditions))
            count_stmt = count_stmt.where(and_(*conditions))

        total = int((await db.execute(count_stmt)).scalar() or 0)
        rows = await db.execute(
            base.add_columns(Member.full_name)
            .order_by(SmsMessage.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = [_message_dict(msg, member_name=name) for msg, name in rows.all()]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }

    async def apply_delivery_webhook(
        self,
        db: AsyncSession,
        *,
        sms_id: str,
        status: str,
    ) -> dict | None:
        result = await db.execute(
            select(SmsMessage).where(SmsMessage.provider_message_id == sms_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        mapped = ARKSEL_STATUS_MAP.get(status.strip().upper(), row.status)
        row.status = mapped
        row.provider_response = {"sms_id": sms_id, "status": status, "source": "webhook"}
        await db.commit()
        await db.refresh(row)
        return _message_dict(row)

    async def refresh_message_status(self, db: AsyncSession, message_id: UUID) -> dict:
        result = await db.execute(select(SmsMessage).where(SmsMessage.id == message_id))
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError("SMS message not found")
        if not row.provider_message_id:
            raise ValueError("No Arkesel message id to refresh — webhook/callback may not have been enabled")
        details = await arkesel_client.get_sms_details(row.provider_message_id)
        nested = details.get("data") if isinstance(details.get("data"), dict) else details
        remote_status = str(
            nested.get("status") or nested.get("message_status") or details.get("status") or ""
        )
        if remote_status:
            row.status = ARKSEL_STATUS_MAP.get(remote_status.strip().upper(), row.status)
        row.provider_response = details
        await db.commit()
        await db.refresh(row)
        return {"message": _message_dict(row), "provider": details}

    async def delete_template(self, db: AsyncSession, template_id: UUID) -> None:
        result = await db.execute(delete(SmsTemplate).where(SmsTemplate.id == template_id))
        if result.rowcount == 0:
            raise ValueError("Template not found")
        await db.commit()

    def settings_public(self) -> dict:
        return {
            "arkesel_configured": arkesel_client.is_configured(),
            "sender_id": settings.arkesel_sender,
            "base_url": settings.arkesel_base_url,
            "sandbox": settings.arkesel_sandbox,
            "api_key_set": bool(settings.arkesel_api_key.strip()),
            "delivery_webhook_enabled": bool(settings.arkesel_callback_url),
            "public_api_url": settings.public_api_url or None,
            "callback_url": settings.arkesel_callback_url,
        }

    async def reports_summary(self, db: AsyncSession) -> dict:
        now = datetime.now(timezone.utc)
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        async def _count(*, since: datetime | None = None, status: str | None = None) -> int:
            stmt = select(func.count()).select_from(SmsMessage)
            conditions = []
            if since is not None:
                conditions.append(SmsMessage.created_at >= since)
            if status is not None:
                conditions.append(SmsMessage.status == status)
            if conditions:
                stmt = stmt.where(and_(*conditions))
            return int((await db.execute(stmt)).scalar() or 0)

        sent_month = await _count(since=start_month)
        sent_today = await _count(since=start_today)
        delivered = await _count(since=start_month, status=SmsDeliveryStatus.DELIVERED.value)
        failed = await _count(since=start_month, status=SmsDeliveryStatus.FAILED.value)
        submitted = await _count(since=start_month, status=SmsDeliveryStatus.SUBMITTED.value)
        invalid = await _count(since=start_month, status=SmsDeliveryStatus.INVALID.value)

        units_row = await db.execute(
            select(func.coalesce(func.sum(SmsMessage.cost_units), 0)).where(
                SmsMessage.created_at >= start_month
            )
        )
        units_month = int(units_row.scalar() or 0)

        campaign_counts = await db.execute(
            select(SmsCampaign.status, func.count())
            .where(SmsCampaign.created_at >= start_month)
            .group_by(SmsCampaign.status)
        )
        by_status = {status: int(count) for status, count in campaign_counts.all()}

        denom = delivered + submitted + failed
        success_rate = round(((delivered + submitted) / denom) * 100, 1) if denom else None

        groups = await self.list_recipient_groups(db)
        workflows = await self.list_workflows(db)

        return {
            "period": {
                "label": start_month.strftime("%B %Y"),
                "start": start_month.isoformat(),
                "as_of": now.isoformat(),
            },
            "messages": {
                "sent_today": sent_today,
                "sent_this_month": sent_month,
                "delivered": delivered,
                "submitted": submitted,
                "failed": failed,
                "invalid": invalid,
                "units_this_month": units_month,
                "delivery_success_rate": success_rate,
            },
            "campaigns_by_status": by_status,
            "recipient_groups": groups,
            "workflows_count": len(workflows),
        }

    async def export_history_rows(
        self,
        db: AsyncSession,
        *,
        limit: int = 500,
    ) -> list[list[str]]:
        rows = await db.execute(
            select(SmsMessage, Member.full_name, SmsCampaign.name)
            .outerjoin(Member, Member.id == SmsMessage.member_id)
            .outerjoin(SmsCampaign, SmsCampaign.id == SmsMessage.campaign_id)
            .order_by(SmsMessage.created_at.desc())
            .limit(limit)
        )
        out: list[list[str]] = [
            ["created_at", "campaign", "member_name", "recipient_phone", "status", "cost_units", "message"]
        ]
        for msg, member_name, campaign_name in rows.all():
            out.append(
                [
                    msg.created_at.isoformat() if msg.created_at else "",
                    campaign_name or "",
                    member_name or "",
                    msg.recipient_phone,
                    msg.status,
                    str(msg.cost_units),
                    (msg.message or "").replace("\n", " "),
                ]
            )
        return out

    async def export_history_csv(
        self,
        db: AsyncSession,
        *,
        limit: int = 500,
    ) -> str:
        rows = await self.export_history_rows(db, limit=limit)
        lines: list[str] = []
        for row in rows:
            escaped = []
            for cell in row:
                text = str(cell)
                if "," in text or '"' in text or "\n" in text:
                    escaped.append('"' + text.replace('"', '""') + '"')
                else:
                    escaped.append(text)
            lines.append(",".join(escaped))
        return "\n".join(lines) + "\n"

    def _ensure_default_workflows(self, workflows: list[dict]) -> tuple[list[dict], bool]:
        """Append any missing seeded defaults (by id) without overwriting user edits."""
        existing_ids = {str(w.get("id")) for w in workflows if isinstance(w, dict)}
        changed = False
        out = [dict(w) for w in workflows if isinstance(w, dict)]
        for default in DEFAULT_WORKFLOWS:
            if default["id"] not in existing_ids:
                out.append(dict(default))
                changed = True
        # Patch stock default messages to include member portal URL when still using old copy
        portal = MEMBER_PORTAL_URL
        for w in out:
            if not w.get("is_default"):
                continue
            trigger = str(w.get("trigger") or "")
            preset = TRIGGER_PRESETS.get(trigger, {}).get("default_message")
            if not preset:
                continue
            current = str(w.get("message") or "")
            if trigger in ("outstanding_dues", "dues_month_end", "members_yet_to_join"):
                if portal not in current:
                    w["message"] = preset
                    changed = True
            if trigger == "members_yet_to_join":
                if w.get("requires_phones") is not True:
                    w["requires_phones"] = True
                    changed = True
                if w.get("recipient_group") != "pending":
                    w["recipient_group"] = "pending"
                    changed = True
        return out, changed

    def _migrate_workflows(self, raw: dict) -> list[dict]:
        if isinstance(raw.get("workflows"), list) and (raw.get("workflows") or raw.get("initialized")):
            return [dict(w) for w in raw["workflows"] if isinstance(w, dict)]
        # Legacy toggle format → defaults + any enabled legacy messages
        workflows = [dict(w) for w in DEFAULT_WORKFLOWS]
        if raw.get("birthday_message"):
            for w in workflows:
                if w["trigger"] == "birthday":
                    w["message"] = str(raw["birthday_message"])
                    w["enabled"] = bool(raw.get("birthday_enabled", True))
        if raw.get("dues_message"):
            for w in workflows:
                if w["trigger"] == "outstanding_dues":
                    w["message"] = str(raw["dues_message"])
                    w["enabled"] = bool(raw.get("dues_reminder_enabled", True))
        return workflows

    async def list_workflows(self, db: AsyncSession) -> list[dict]:
        from v1.core.models import PlatformSetting

        row = await db.get(PlatformSetting, SMS_AUTOMATION_KEY)
        if not row or not isinstance(row.value, dict) or "workflows" not in row.value:
            workflows = [dict(w) for w in DEFAULT_WORKFLOWS]
            await self._save_workflows(db, workflows)
            return workflows
        migrated = self._migrate_workflows(row.value)
        if not migrated and not row.value.get("initialized"):
            workflows = [dict(w) for w in DEFAULT_WORKFLOWS]
            await self._save_workflows(db, workflows)
            return workflows
        workflows, patched = self._ensure_default_workflows(migrated)
        if patched:
            await self._save_workflows(db, workflows)
        return workflows

    async def _save_workflows(self, db: AsyncSession, workflows: list[dict]) -> list[dict]:
        from v1.core.models import PlatformSetting

        payload = {"workflows": workflows, "initialized": True}
        row = await db.get(PlatformSetting, SMS_AUTOMATION_KEY)
        if row:
            row.value = payload
        else:
            db.add(PlatformSetting(key=SMS_AUTOMATION_KEY, value=payload))
        await db.commit()
        return workflows

    async def update_workflow(
        self,
        db: AsyncSession,
        *,
        workflow_id: str,
        name: str | None = None,
        message: str | None = None,
        enabled: bool | None = None,
        template_id: str | None = None,
        clear_template: bool = False,
    ) -> dict:
        workflows = await self.list_workflows(db)
        workflow = next((w for w in workflows if str(w.get("id")) == str(workflow_id)), None)
        if not workflow:
            raise ValueError("Workflow not found")
        if name is not None:
            workflow["name"] = name.strip() or workflow.get("name")
        if message is not None:
            workflow["message"] = message.strip() or workflow.get("message")
        if enabled is not None:
            workflow["enabled"] = bool(enabled)
        if clear_template:
            workflow["template_id"] = None
        elif template_id is not None:
            workflow["template_id"] = template_id
        await self._save_workflows(db, workflows)
        return workflow

    async def create_workflow(
        self,
        db: AsyncSession,
        *,
        name: str,
        trigger: str,
        recipient_group: str | None,
        message: str,
        enabled: bool = True,
        template_id: str | None = None,
    ) -> dict:
        trigger_key = (trigger or "manual").strip().lower()
        if trigger_key not in TRIGGER_PRESETS:
            raise ValueError(
                "Unknown trigger — use birthday, outstanding_dues, dues_month_end, "
                "members_yet_to_join, or manual"
            )
        preset = TRIGGER_PRESETS[trigger_key]
        group = (recipient_group or preset["recipient_group"]).strip()
        state = await self.get_custom_groups_state(db)
        custom_ids = {str(g.get("id")) for g in (state.get("groups") or [])}
        valid_groups = {g["id"] for g in RECIPIENT_GROUPS if g["id"] != "custom"} | custom_ids
        if trigger_key == "manual":
            if group not in valid_groups:
                raise ValueError(f"Unknown recipient group: {group}")
        else:
            group = preset["recipient_group"]
        body = (message or "").strip() or preset["default_message"]
        if not body:
            raise ValueError("Message is required")
        workflow = {
            "id": str(uuid4()),
            "name": name.strip() or "Untitled workflow",
            "trigger": trigger_key,
            "recipient_group": group,
            "message": body,
            "enabled": bool(enabled),
            "template_id": template_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_run_at": None,
            "is_default": False,
            "requires_phones": trigger_key == "members_yet_to_join" or group == "pending",
        }
        workflows = await self.list_workflows(db)
        workflows.append(workflow)
        await self._save_workflows(db, workflows)
        return workflow

    async def delete_workflow(self, db: AsyncSession, workflow_id: str) -> None:
        workflows = await self.list_workflows(db)
        next_list = [w for w in workflows if str(w.get("id")) != str(workflow_id)]
        if len(next_list) == len(workflows):
            raise ValueError("Workflow not found")
        await self._save_workflows(db, next_list)

    async def _resolve_workflow_message(self, db: AsyncSession, workflow: dict) -> str:
        template_id = workflow.get("template_id")
        trigger = str(workflow.get("trigger") or "")
        meta = await self._get_setting(db, SMS_TEMPLATE_META_KEY, {})
        if template_id:
            result = await db.execute(select(SmsTemplate).where(SmsTemplate.id == UUID(str(template_id))))
            tpl = result.scalar_one_or_none()
            if tpl:
                return tpl.body
        # Prefer a template linked to this trigger
        for tid, info in meta.items():
            if isinstance(info, dict) and info.get("linked_trigger") == trigger:
                try:
                    result = await db.execute(select(SmsTemplate).where(SmsTemplate.id == UUID(str(tid))))
                    tpl = result.scalar_one_or_none()
                    if tpl:
                        return tpl.body
                except Exception:
                    continue
        return str(workflow.get("message") or "")

    async def run_workflow(
        self,
        db: AsyncSession,
        *,
        actor: Member,
        workflow_id: str,
        phones: list[str] | None = None,
    ) -> dict:
        import calendar

        workflows = await self.list_workflows(db)
        workflow = next((w for w in workflows if str(w.get("id")) == str(workflow_id)), None)
        if not workflow:
            raise ValueError("Workflow not found")
        if not workflow.get("enabled", True):
            raise ValueError("Workflow is disabled — enable it before running")

        trigger = str(workflow.get("trigger") or "")
        if trigger == "dues_month_end":
            today = date.today()
            last_day = calendar.monthrange(today.year, today.month)[1]
            days_left = last_day - today.day
            if days_left > DUES_REMINDER_DAYS_BEFORE_MONTH_END:
                raise ValueError(
                    f"Month-end dues reminder runs only in the last "
                    f"{DUES_REMINDER_DAYS_BEFORE_MONTH_END} day(s) of the month "
                    f"({days_left} day(s) left)."
                )

        message = await self._resolve_workflow_message(db, workflow)
        group = str(workflow.get("recipient_group") or "active")
        if trigger in TRIGGER_PRESETS and trigger != "manual":
            group = TRIGGER_PRESETS[trigger]["recipient_group"]

        needs_phones = (
            bool(workflow.get("requires_phones"))
            or trigger == "members_yet_to_join"
            or group == "pending"
        )
        phone_list = [p.strip() for p in (phones or []) if p and str(p).strip()]
        if needs_phones and not phone_list:
            raise ValueError(
                "Enter phone numbers for members yet to join before running this workflow"
            )

        result = await self.compose_and_send(
            db,
            actor=actor,
            message=message,
            name=f"Workflow · {workflow.get('name')}",
            recipient_group=group,
            member_ids=[],
            phones=phone_list if needs_phones else None,
            schedule_at=None,
            sandbox=False,
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        for w in workflows:
            if str(w.get("id")) == str(workflow_id):
                w["last_run_at"] = now_iso
                break
        await self._save_workflows(db, workflows)
        return {"workflow_id": workflow_id, "run_at": now_iso, **result}

    async def get_template_meta(self, db: AsyncSession) -> dict:
        return await self._get_setting(db, SMS_TEMPLATE_META_KEY, {})

    async def set_template_linked_trigger(
        self, db: AsyncSession, *, template_id: str, linked_trigger: str | None
    ) -> dict:
        meta = await self.get_template_meta(db)
        entry = dict(meta.get(str(template_id)) or {})
        if linked_trigger:
            # Only one template per trigger
            for tid, info in list(meta.items()):
                if isinstance(info, dict) and info.get("linked_trigger") == linked_trigger:
                    info = dict(info)
                    info.pop("linked_trigger", None)
                    meta[tid] = info
            entry["linked_trigger"] = linked_trigger
            meta[str(template_id)] = entry
        else:
            entry.pop("linked_trigger", None)
            if entry:
                meta[str(template_id)] = entry
            else:
                meta.pop(str(template_id), None)
        await self._put_setting(db, SMS_TEMPLATE_META_KEY, meta)
        return meta

    async def list_templates(self, db: AsyncSession) -> list[dict]:
        result = await db.execute(select(SmsTemplate).order_by(SmsTemplate.name.asc()))
        meta = await self.get_template_meta(db)
        items = []
        for t in result.scalars().all():
            data = _template_dict(t)
            info = meta.get(str(t.id)) if isinstance(meta.get(str(t.id)), dict) else {}
            data["linked_trigger"] = info.get("linked_trigger")
            items.append(data)
        return items

    async def create_template(
        self, db: AsyncSession, *, actor: Member, name: str, body: str, category: str,
        linked_trigger: str | None = None,
    ) -> dict:
        template = SmsTemplate(
            name=name.strip(),
            body=body.strip(),
            category=(category.strip() or "general")[:50],
            created_by=actor.id,
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        if linked_trigger:
            await self.set_template_linked_trigger(
                db, template_id=str(template.id), linked_trigger=linked_trigger
            )
        data = _template_dict(template)
        data["linked_trigger"] = linked_trigger
        return data

    async def get_campaign(self, db: AsyncSession, campaign_id: UUID) -> dict:
        result = await db.execute(select(SmsCampaign).where(SmsCampaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise ValueError("Campaign not found")
        data = _campaign_dict(campaign, include_response=True)
        now = datetime.now(timezone.utc)
        scheduled = campaign.scheduled_at
        if campaign.status == SmsCampaignStatus.SCHEDULED.value and scheduled:
            if scheduled <= now:
                data["schedule_state"] = "due"
            else:
                data["schedule_state"] = "upcoming"
                data["seconds_until"] = int((scheduled - now).total_seconds())
        elif campaign.status in (
            SmsCampaignStatus.SENT.value,
            SmsCampaignStatus.PARTIAL.value,
        ):
            data["schedule_state"] = "sent"
        elif campaign.status == SmsCampaignStatus.CANCELLED.value:
            data["schedule_state"] = "cancelled"
        elif campaign.status == SmsCampaignStatus.FAILED.value:
            data["schedule_state"] = "failed"
        else:
            data["schedule_state"] = campaign.status
        return data

    async def update_scheduled_campaign(
        self,
        db: AsyncSession,
        *,
        campaign_id: UUID,
        message: str | None = None,
        name: str | None = None,
        schedule_at: datetime | None = None,
    ) -> dict:
        result = await db.execute(select(SmsCampaign).where(SmsCampaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise ValueError("Campaign not found")
        if campaign.status != SmsCampaignStatus.SCHEDULED.value:
            raise ValueError("Only upcoming scheduled campaigns can be edited")
        now = datetime.now(timezone.utc)
        if campaign.scheduled_at and campaign.scheduled_at <= now:
            raise ValueError("Scheduled time already reached — cancel or wait for delivery")
        if name is not None:
            campaign.name = name.strip() or campaign.name
        if message is not None:
            new_message = message.strip()
            if not new_message:
                raise ValueError("Message is required")
            campaign.message = new_message
            pages = sms_page_count(new_message)
            campaign.estimated_units = pages * max(campaign.recipient_count, 0)
            await db.execute(
                update(SmsMessage)
                .where(SmsMessage.campaign_id == campaign.id)
                .values(message=new_message, cost_units=pages)
            )
        if schedule_at is not None:
            scheduled = schedule_at
            if scheduled.tzinfo is None:
                scheduled = scheduled.replace(tzinfo=GHANA_TZ)
            else:
                scheduled = scheduled.astimezone(GHANA_TZ)
            if scheduled.astimezone(timezone.utc) <= now:
                raise ValueError("New schedule time must be in the future")
            campaign.scheduled_at = scheduled.astimezone(timezone.utc)
        await db.commit()
        return await self.get_campaign(db, campaign_id)

    async def cancel_scheduled_campaign(self, db: AsyncSession, campaign_id: UUID) -> dict:
        result = await db.execute(select(SmsCampaign).where(SmsCampaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise ValueError("Campaign not found")
        if campaign.status != SmsCampaignStatus.SCHEDULED.value:
            raise ValueError("Only scheduled campaigns can be cancelled")
        campaign.status = SmsCampaignStatus.CANCELLED.value
        await db.execute(
            update(SmsMessage)
            .where(SmsMessage.campaign_id == campaign.id)
            .values(status=SmsDeliveryStatus.FAILED.value)
        )
        await db.commit()
        return await self.get_campaign(db, campaign_id)

    # Backward-compatible aliases used by older reports payload
    async def get_automation(self, db: AsyncSession) -> dict:
        workflows = await self.list_workflows(db)
        return {"workflows": workflows}


sms_service = SmsService()
