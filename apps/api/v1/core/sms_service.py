"""SMS campaign and delivery orchestration (Arkesel provider)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import and_, extract, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core import arkesel_client
from v1.core.arkesel_client import ArkeselError, estimate_units, normalize_gh_msisdn, sms_page_count
from v1.core.config import settings
from v1.core.models import (
    Member,
    MemberStatus,
    SmsCampaign,
    SmsCampaignStatus,
    SmsDeliveryStatus,
    SmsMessage,
    SmsTemplate,
    UserRole,
)

RECIPIENT_GROUPS: list[dict[str, str]] = [
    {"id": "all", "label": "All Members", "description": "Every member with a phone number"},
    {"id": "active", "label": "Registered Members", "description": "Active members only"},
    {"id": "pending", "label": "Members Yet to Join", "description": "Pending registration / approval"},
    {"id": "executive", "label": "Executive Members", "description": "Administrators and executives"},
    {"id": "birthdays_today", "label": "Birthday Celebrants", "description": "Members with birthday today"},
    {"id": "custom", "label": "Custom Selection", "description": "Pick specific members"},
]


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
        elif group == "executive":
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
        else:
            raise ValueError(f"Unknown recipient group: {group}")

        result = await db.execute(query.order_by(Member.full_name.asc()))
        return list(result.scalars().all())

    async def estimate(
        self,
        db: AsyncSession,
        *,
        message: str,
        recipient_group: str,
        member_ids: list[UUID],
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
        # unique phones
        unique = list(dict.fromkeys(valid_phones))
        pages = sms_page_count(message)
        units = estimate_units(message, len(unique))
        return {
            "recipient_count": len(unique),
            "invalid_phone_count": invalid,
            "pages_per_message": pages,
            "estimated_units": units,
            "character_count": len(message),
            "sender_id": settings.arkesel_sender,
            "arkesel_configured": arkesel_client.is_configured(),
            "sandbox": settings.arkesel_sandbox,
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
        schedule_at: datetime | None,
        sandbox: bool | None,
    ) -> dict:
        if not arkesel_client.is_configured():
            raise ArkeselError("Arkesel is not configured — set ARKESEL_API_KEY")

        members = await self.resolve_recipients(db, group=recipient_group, member_ids=member_ids)
        recipients: list[tuple[Member, str]] = []
        seen: set[str] = set()
        for member in members:
            msisdn = normalize_gh_msisdn(member.phone_number)
            if not msisdn or msisdn in seen:
                continue
            seen.add(msisdn)
            recipients.append((member, msisdn))

        if not recipients:
            raise ValueError("No recipients with valid phone numbers")

        use_sandbox = settings.arkesel_sandbox if sandbox is None else sandbox
        pages = sms_page_count(message)
        units = estimate_units(message, len(recipients))
        campaign_name = (name or "").strip() or f"SMS {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"

        scheduled_at = schedule_at
        if scheduled_at and scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        campaign = SmsCampaign(
            name=campaign_name,
            message=message,
            recipient_group=recipient_group,
            recipient_count=len(recipients),
            status=SmsCampaignStatus.SCHEDULED.value if scheduled_at else SmsCampaignStatus.SENDING.value,
            provider="arkesel",
            sender_id=settings.arkesel_sender,
            estimated_units=units,
            scheduled_at=scheduled_at,
            created_by=actor.id,
            sandbox=use_sandbox,
        )
        db.add(campaign)
        await db.flush()

        for member, msisdn in recipients:
            db.add(
                SmsMessage(
                    campaign_id=campaign.id,
                    member_id=member.id,
                    recipient_phone=msisdn,
                    message=message,
                    status=SmsDeliveryStatus.SCHEDULED.value if scheduled_at else SmsDeliveryStatus.PENDING.value,
                    cost_units=pages,
                )
            )
        await db.flush()

        scheduled_date = None
        if scheduled_at:
            # Arkesel format: 'Y-m-d H:i A' e.g. 2026-07-29 05:30 PM
            local = scheduled_at.astimezone(timezone.utc)
            scheduled_date = local.strftime("%Y-%m-%d %I:%M %p")

        try:
            provider_payload = await arkesel_client.send_sms(
                message=message,
                recipients=[msisdn for _, msisdn in recipients],
                scheduled_date=scheduled_date,
                sandbox=use_sandbox,
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
            else:
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
            "estimated_units": units,
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
        self, db: AsyncSession, *, page: int = 1, page_size: int = 20
    ) -> dict:
        total = int((await db.execute(select(func.count()).select_from(SmsCampaign))).scalar() or 0)
        result = await db.execute(
            select(SmsCampaign)
            .order_by(SmsCampaign.created_at.desc())
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

    def settings_public(self) -> dict:
        return {
            "arkesel_configured": arkesel_client.is_configured(),
            "sender_id": settings.arkesel_sender,
            "base_url": settings.arkesel_base_url,
            "sandbox": settings.arkesel_sandbox,
            "api_key_set": bool(settings.arkesel_api_key.strip()),
        }


sms_service = SmsService()
