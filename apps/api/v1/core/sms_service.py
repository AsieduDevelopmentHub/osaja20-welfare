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
        "description": "Pending members + paste contacts (055 / +233 / 233)",
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
            "Please pay via the member portal. Thank you."
        ),
    },
    "manual": {
        "recipient_group": "active",
        "default_message": "",
    },
}

DEFAULT_AUTOMATION: dict = {
    "workflows": [],
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
    async def list_recipient_groups(self, db: AsyncSession) -> list[dict]:
        groups = []
        for meta in RECIPIENT_GROUPS:
            members = await self.resolve_recipients(db, group=meta["id"], member_ids=[])
            valid = sum(1 for m in members if normalize_gh_msisdn(m.phone_number))
            groups.append({**meta, "count": valid, "total_members": len(members)})
        return groups

    async def resolve_recipients(
        self,
        db: AsyncSession,
        *,
        group: str,
        member_ids: list[UUID],
    ) -> list[Member]:
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
            query = query.where(Member.status == MemberStatus.PENDING.value)
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
        members = await self.resolve_recipients(db, group=recipient_group, member_ids=member_ids)
        valid_phones: list[str] = []
        invalid = 0
        for member in members:
            msisdn = normalize_gh_msisdn(member.phone_number)
            if msisdn:
                valid_phones.append(msisdn)
            else:
                invalid += 1
        manual_valid, manual_invalid = parse_phone_list(phones or [])
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

        members = await self.resolve_recipients(db, group=recipient_group, member_ids=member_ids)
        recipients: list[tuple[Member | None, str]] = []
        seen: set[str] = set()
        for member in members:
            msisdn = normalize_gh_msisdn(member.phone_number)
            if not msisdn or msisdn in seen:
                continue
            seen.add(msisdn)
            recipients.append((member, msisdn))

        manual_valid, manual_invalid = parse_phone_list(phones or [])
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
        items = [_campaign_dict(c) for c in result.scalars().all()]
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

    async def list_templates(self, db: AsyncSession) -> list[dict]:
        result = await db.execute(select(SmsTemplate).order_by(SmsTemplate.name.asc()))
        return [_template_dict(t) for t in result.scalars().all()]

    async def create_template(
        self, db: AsyncSession, *, actor: Member, name: str, body: str, category: str
    ) -> dict:
        template = SmsTemplate(
            name=name.strip(),
            body=body.strip(),
            category=category.strip() or "general",
            created_by=actor.id,
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        return _template_dict(template)

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

    def _migrate_workflows(self, raw: dict) -> list[dict]:
        if isinstance(raw.get("workflows"), list):
            return list(raw["workflows"])
        workflows: list[dict] = []
        now_iso = datetime.now(timezone.utc).isoformat()
        if raw.get("birthday_enabled") or raw.get("birthday_message"):
            workflows.append(
                {
                    "id": str(uuid4()),
                    "name": "Birthday wishes",
                    "trigger": "birthday",
                    "recipient_group": "birthdays_today",
                    "message": str(raw.get("birthday_message") or TRIGGER_PRESETS["birthday"]["default_message"]),
                    "enabled": bool(raw.get("birthday_enabled")),
                    "created_at": now_iso,
                    "last_run_at": raw.get("last_birthday_run_at"),
                }
            )
        if raw.get("dues_reminder_enabled") or raw.get("dues_message"):
            workflows.append(
                {
                    "id": str(uuid4()),
                    "name": "Outstanding dues reminder",
                    "trigger": "outstanding_dues",
                    "recipient_group": "outstanding_dues",
                    "message": str(raw.get("dues_message") or TRIGGER_PRESETS["outstanding_dues"]["default_message"]),
                    "enabled": bool(raw.get("dues_reminder_enabled")),
                    "created_at": now_iso,
                    "last_run_at": raw.get("last_dues_run_at"),
                }
            )
        return workflows

    async def list_workflows(self, db: AsyncSession) -> list[dict]:
        from v1.core.models import PlatformSetting

        row = await db.get(PlatformSetting, SMS_AUTOMATION_KEY)
        raw = dict(DEFAULT_AUTOMATION)
        if row and isinstance(row.value, dict):
            raw.update(row.value)
        workflows = self._migrate_workflows(raw)
        # Persist migration if needed
        if "workflows" not in (row.value if row and isinstance(row.value, dict) else {}):
            await self._save_workflows(db, workflows)
        return workflows

    async def _save_workflows(self, db: AsyncSession, workflows: list[dict]) -> list[dict]:
        from v1.core.models import PlatformSetting

        payload = {"workflows": workflows}
        row = await db.get(PlatformSetting, SMS_AUTOMATION_KEY)
        if row:
            row.value = payload
        else:
            db.add(PlatformSetting(key=SMS_AUTOMATION_KEY, value=payload))
        await db.commit()
        return workflows

    async def create_workflow(
        self,
        db: AsyncSession,
        *,
        name: str,
        trigger: str,
        recipient_group: str | None,
        message: str,
        enabled: bool = True,
    ) -> dict:
        trigger_key = (trigger or "manual").strip().lower()
        if trigger_key not in TRIGGER_PRESETS:
            raise ValueError("Unknown trigger — use birthday, outstanding_dues, or manual")
        preset = TRIGGER_PRESETS[trigger_key]
        group = (recipient_group or preset["recipient_group"]).strip()
        valid_groups = {g["id"] for g in RECIPIENT_GROUPS if g["id"] != "custom"}
        if group not in valid_groups and trigger_key == "manual":
            raise ValueError(f"Unknown recipient group: {group}")
        if trigger_key != "manual":
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
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_run_at": None,
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

    async def run_workflow(
        self,
        db: AsyncSession,
        *,
        actor: Member,
        workflow_id: str,
    ) -> dict:
        workflows = await self.list_workflows(db)
        workflow = next((w for w in workflows if str(w.get("id")) == str(workflow_id)), None)
        if not workflow:
            raise ValueError("Workflow not found")
        if not workflow.get("enabled", True):
            raise ValueError("Workflow is disabled — enable it before running")

        result = await self.compose_and_send(
            db,
            actor=actor,
            message=str(workflow.get("message") or ""),
            name=f"Workflow · {workflow.get('name')}",
            recipient_group=str(workflow.get("recipient_group") or "active"),
            member_ids=[],
            phones=None,
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

    # Backward-compatible aliases used by older reports payload
    async def get_automation(self, db: AsyncSession) -> dict:
        workflows = await self.list_workflows(db)
        return {"workflows": workflows}


sms_service = SmsService()
