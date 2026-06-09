"""Database-backed service layer with in-memory algorithm indexes."""

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from pywebpush import WebPushException

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from v1.core.config import settings
from v1.core.algorithms import (
    BirthdayIndex,
    BirthdayMember,
    ContributionLedger,
    LedgerEntry,
    MemberSearchTrie,
    VoteContext,
    VoteEligibilityRules,
    VoteEngine,
    WelfareStateMachine,
)
from v1.core.models import (
    ActivityLog,
    Announcement,
    BirthdayWish,
    Contribution,
    Member,
    MemberStatus,
    Notification,
    PushSubscription,
    UserRole,
    Vote,
    VoteAuditLog,
    VoteLifecycle,
    VoteOption,
    VoteSubmission,
    WelfareCase,
    WelfareStatus,
)
from v1.core.dues import MONTHLY_DUES_AMOUNT, compute_dues_summary
from v1.core.platform_settings import get_monthly_dues_amount
from v1.core.member_identity import (
    generate_membership_id,
    generate_username,
    resolve_member_by_identifier,
    validate_username,
)
from v1.core.member_preferences import PREFERENCE_KEYS, merge_preferences
from v1.core.password import hash_password, verify_password
from v1.core.email_service import build_digest_email, is_email_configured, send_email
from v1.core.jobs.queue import job_queue
from v1.core.push_service import (
    build_payload,
    is_push_configured,
    is_subscription_gone,
    member_allows_push_type,
    send_web_push,
)
from v1.core.serializers import (
    contribution_to_dict,
    member_to_dict,
    vote_to_dict,
    welfare_case_to_dict,
)

class AlgorithmRegistry:
    """In-memory indexes rebuilt from PostgreSQL on startup."""

    def __init__(self) -> None:
        self.member_index = MemberSearchTrie()
        self.vote_engine = VoteEngine()
        self.ledger = ContributionLedger()
        self.welfare_fsm = WelfareStateMachine()
        self.birthday_index = BirthdayIndex()
        self._loaded = False

    async def rebuild(self, db: AsyncSession) -> None:
        self.member_index.clear()
        self.birthday_index = BirthdayIndex()
        self.ledger = ContributionLedger()
        self.vote_engine = VoteEngine()

        members = (await db.execute(select(Member))).scalars().all()
        for member in members:
            self._index_member(member)

        contributions = (await db.execute(select(Contribution))).scalars().all()
        for c in contributions:
            self.ledger.append(
                LedgerEntry(
                    id=str(c.id),
                    member_id=str(c.member_id),
                    amount=float(c.amount),
                    type="credit",
                    reference=c.reference,
                    created_at=c.created_at.replace(tzinfo=None),
                    created_by=str(c.created_by),
                    verified_by=str(c.verified_by) if c.verified_by else None,
                )
            )

        submissions = (
            await db.execute(select(VoteSubmission).order_by(VoteSubmission.submitted_at))
        ).scalars().all()
        for sub in submissions:
            self.vote_engine.submit_vote(str(sub.vote_id), str(sub.member_id), str(sub.option_id))

        self._loaded = True

    def _index_member(self, member: Member) -> None:
        self.member_index.insert(
            str(member.id),
            member.full_name,
            member.email,
            member.membership_id,
            member.username,
        )
        self.birthday_index.insert(
            BirthdayMember(
                member_id=str(member.id),
                full_name=member.full_name,
                month=member.date_of_birth.month,
                day=member.date_of_birth.day,
            )
        )

    def _reindex_member(self, member: Member, *, old_full_name: str, old_username: str, old_dob) -> None:
        mid = str(member.id)
        self.member_index.remove(mid, old_full_name, member.email, member.membership_id, old_username)
        self._index_member(member)
        if old_dob != member.date_of_birth:
            self.birthday_index.remove(mid, old_dob.month, old_dob.day)
            self.birthday_index.insert(
                BirthdayMember(
                    member_id=mid,
                    full_name=member.full_name,
                    month=member.date_of_birth.month,
                    day=member.date_of_birth.day,
                )
            )


registry = AlgorithmRegistry()


class PlatformService:
    async def log_activity(
        self,
        db: AsyncSession,
        *,
        actor_id: UUID | None,
        action: str,
        entity_type: str,
        entity_id: UUID,
        metadata: dict | None = None,
    ) -> None:
        db.add(
            ActivityLog(
                actor_id=actor_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                metadata_json=metadata or {},
            )
        )

    async def get_member(self, db: AsyncSession, member_id: UUID) -> Member | None:
        result = await db.execute(select(Member).where(Member.id == member_id))
        return result.scalar_one_or_none()

    async def register_member(
        self,
        db: AsyncSession,
        *,
        full_name: str,
        email: str,
        phone_number: str,
        date_of_birth,
        batch: int,
        membership_id: str | None = None,
        username: str | None = None,
        password: str | None = None,
        role: str = UserRole.MEMBER.value,
        auth_user_id: UUID | None = None,
        email_verified: bool = False,
        actor_id: UUID | None = None,
    ) -> Member:
        email = email.lower()
        if not membership_id:
            membership_id = await generate_membership_id(db, batch)
        if username:
            username = validate_username(username)
            taken = await db.execute(select(Member).where(Member.username == username))
            if taken.scalar_one_or_none():
                raise ValueError("Username already taken")
        else:
            username = await generate_username(db, full_name, email)

        member = Member(
            full_name=full_name,
            username=username,
            email=email,
            phone_number=phone_number,
            date_of_birth=date_of_birth,
            membership_id=membership_id,
            batch=batch,
            status=MemberStatus.PENDING.value,
            role=role,
            email_verified=email_verified,
            auth_user_id=auth_user_id,
            password_hash=hash_password(password) if password else None,
        )
        db.add(member)
        await db.flush()

        registry._index_member(member)
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="member_registered",
            entity_type="member",
            entity_id=member.id,
        )
        return member

    async def authenticate_local(self, db: AsyncSession, identifier: str, password: str) -> Member | None:
        member = await resolve_member_by_identifier(db, identifier)
        if not member or not member.password_hash:
            return None
        if not verify_password(password, member.password_hash):
            return None
        return member

    async def resolve_login_email(self, db: AsyncSession, identifier: str) -> str | None:
        member = await resolve_member_by_identifier(db, identifier)
        return member.email if member else None

    async def search_members(self, db: AsyncSession, query: str, limit: int = 20) -> list[dict]:
        if not registry._loaded:
            await registry.rebuild(db)

        ids = registry.member_index.search(query, limit)
        if not ids:
            return []

        uuids = [UUID(mid) for mid in ids]
        result = await db.execute(select(Member).where(Member.id.in_(uuids)))
        members = {str(m.id): m for m in result.scalars().all()}
        return [member_to_dict(members[mid]) for mid in ids if mid in members]

    async def list_members(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> dict:
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        query = select(Member).order_by(Member.created_at.desc())
        count_query = select(func.count()).select_from(Member)

        if status:
            query = query.where(Member.status == status)
            count_query = count_query.where(Member.status == status)

        total = await db.scalar(count_query) or 0
        result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
        items = [member_to_dict(m) for m in result.scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        }

    async def update_member_role(
        self,
        db: AsyncSession,
        member_id: UUID,
        role: str,
        *,
        actor_id: UUID | None = None,
    ) -> Member:
        member = await self.get_member(db, member_id)
        if not member:
            raise ValueError("Member not found")
        member.role = role
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="member_role_updated",
            entity_type="member",
            entity_id=member.id,
            metadata={"role": role},
        )
        return member

    async def update_member_status(
        self,
        db: AsyncSession,
        member_id: UUID,
        status: str,
        *,
        actor_id: UUID | None = None,
    ) -> Member:
        member = await self.get_member(db, member_id)
        if not member:
            raise ValueError("Member not found")
        if actor_id and member_id == actor_id and status != MemberStatus.ACTIVE.value:
            raise ValueError("Cannot deactivate your own account")
        member.status = status
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="member_status_updated",
            entity_type="member",
            entity_id=member.id,
            metadata={"status": status},
        )
        return member

    async def update_member_profile(
        self,
        db: AsyncSession,
        member: Member,
        *,
        full_name: str | None = None,
        phone_number: str | None = None,
        username: str | None = None,
        date_of_birth=None,
        preferences: dict | None = None,
        actor_id: UUID | None = None,
    ) -> Member:
        old_full_name = member.full_name
        old_username = member.username
        old_dob = member.date_of_birth
        changed_search = False

        if full_name is not None:
            member.full_name = full_name.strip()
            changed_search = True
        if phone_number is not None:
            member.phone_number = phone_number.strip()
        if username is not None:
            normalized = validate_username(username)
            if normalized != member.username:
                taken = await db.execute(
                    select(Member).where(Member.username == normalized, Member.id != member.id)
                )
                if taken.scalar_one_or_none():
                    raise ValueError("Username already taken")
                member.username = normalized
                changed_search = True
        if date_of_birth is not None:
            member.date_of_birth = date_of_birth
            changed_search = True
        if preferences:
            current = merge_preferences(member.preferences_json)
            for key, value in preferences.items():
                if key in PREFERENCE_KEYS and value is not None:
                    current[key] = bool(value)
            member.preferences_json = current

        await db.flush()

        if changed_search:
            registry._reindex_member(
                member,
                old_full_name=old_full_name,
                old_username=old_username,
                old_dob=old_dob,
            )

        await self.log_activity(
            db,
            actor_id=actor_id or member.id,
            action="profile_updated",
            entity_type="member",
            entity_id=member.id,
        )
        return member

    async def set_member_avatar(
        self,
        db: AsyncSession,
        member: Member,
        avatar_url: str,
        *,
        actor_id: UUID | None = None,
    ) -> Member:
        member.avatar_url = avatar_url
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id or member.id,
            action="avatar_updated",
            entity_type="member",
            entity_id=member.id,
        )
        return member

    async def clear_member_avatar(
        self,
        db: AsyncSession,
        member: Member,
        *,
        actor_id: UUID | None = None,
    ) -> Member:
        member.avatar_url = None
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id or member.id,
            action="avatar_removed",
            entity_type="member",
            entity_id=member.id,
        )
        return member

    async def create_welfare_case(self, db: AsyncSession, data: dict, actor_id: UUID | None = None) -> dict:
        case = WelfareCase(
            member_id=UUID(data["member_id"]),
            title=data["title"],
            description=data["description"],
            status=WelfareStatus.PENDING.value,
        )
        db.add(case)
        await db.flush()
        await self.log_activity(
            db, actor_id=actor_id, action="welfare_created", entity_type="welfare_case", entity_id=case.id
        )
        return welfare_case_to_dict(case)

    async def transition_welfare_case(
        self, db: AsyncSession, case_id: UUID, target_status: str, actor_id: UUID | None = None
    ) -> dict:
        result = await db.execute(select(WelfareCase).where(WelfareCase.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise ValueError("Case not found")

        old_status = case.status
        success, new_status, error = registry.welfare_fsm.transition(old_status, target_status)
        if not success:
            raise ValueError(error)

        from v1.core.algorithms.state_machine import normalize_welfare_status

        case.status = normalize_welfare_status(new_status)
        case.updated_at = datetime.now(timezone.utc)
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="welfare_transition",
            entity_type="welfare_case",
            entity_id=case.id,
            metadata={"from": old_status, "to": new_status},
        )
        return welfare_case_to_dict(case)

    async def unarchive_welfare_case(
        self, db: AsyncSession, case_id: UUID, actor_id: UUID | None = None
    ) -> dict:
        result = await db.execute(select(WelfareCase).where(WelfareCase.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise ValueError("Case not found")
        if case.status != WelfareStatus.ARCHIVED.value:
            raise ValueError("Case is not archived")
        case.status = WelfareStatus.RESOLVED.value
        case.updated_at = datetime.now(timezone.utc)
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="welfare_unarchived",
            entity_type="welfare_case",
            entity_id=case.id,
        )
        return welfare_case_to_dict(case)

    async def get_welfare_case(self, db: AsyncSession, case_id: UUID) -> dict | None:
        result = await db.execute(select(WelfareCase).where(WelfareCase.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            return None
        data = welfare_case_to_dict(case)
        data["available_transitions"] = registry.welfare_fsm.get_available_transitions(case.status)
        return data

    async def list_welfare_cases(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> dict:
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        query = (
            select(WelfareCase, Member.full_name, Member.membership_id)
            .join(Member, WelfareCase.member_id == Member.id)
            .order_by(WelfareCase.created_at.desc())
        )
        count_query = select(func.count()).select_from(WelfareCase)
        if status:
            query = query.where(WelfareCase.status == status)
            count_query = count_query.where(WelfareCase.status == status)
        else:
            query = query.where(WelfareCase.status != WelfareStatus.ARCHIVED.value)
            count_query = count_query.where(WelfareCase.status != WelfareStatus.ARCHIVED.value)

        total = await db.scalar(count_query) or 0
        result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
        items = []
        for case, full_name, membership_id in result.all():
            row = welfare_case_to_dict(case)
            row["member_name"] = full_name
            row["membership_id"] = membership_id
            row["available_transitions"] = registry.welfare_fsm.get_available_transitions(case.status)
            items.append(row)

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        }

    async def list_member_welfare_cases(
        self,
        db: AsyncSession,
        member_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        query = (
            select(WelfareCase)
            .where(
                WelfareCase.member_id == member_id,
                WelfareCase.status != WelfareStatus.ARCHIVED.value,
            )
            .order_by(WelfareCase.created_at.desc())
        )
        count_query = (
            select(func.count())
            .select_from(WelfareCase)
            .where(
                WelfareCase.member_id == member_id,
                WelfareCase.status != WelfareStatus.ARCHIVED.value,
            )
        )
        total = await db.scalar(count_query) or 0
        cases = (
            await db.execute(query.offset((page - 1) * page_size).limit(page_size))
        ).scalars().all()
        items = [welfare_case_to_dict(c) for c in cases]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        }

    async def record_contribution(self, db: AsyncSession, data: dict, actor_id: UUID | None = None) -> dict:
        contrib_type = data.get("type", "dues")
        period_year = data.get("period_year")
        period_month = data.get("period_month")
        now = datetime.now(timezone.utc)

        if contrib_type == "dues" and (period_year is None or period_month is None):
            period_year = now.year
            period_month = now.month

        if contrib_type == "dues" and period_year and period_month:
            existing = await db.execute(
                select(func.coalesce(func.sum(Contribution.amount), 0)).where(
                    Contribution.member_id == UUID(data["member_id"]),
                    Contribution.type == "dues",
                    Contribution.period_year == period_year,
                    Contribution.period_month == period_month,
                )
            )
            already_paid = float(existing.scalar() or 0)
            monthly_dues = await get_monthly_dues_amount(db)
            if already_paid >= monthly_dues:
                raise ValueError(f"Dues for {period_month}/{period_year} already recorded")

        entry = LedgerEntry(
            id=str(uuid4()),
            member_id=data["member_id"],
            amount=float(data["amount"]),
            type="credit",
            reference=data.get("reference", ""),
            created_at=datetime.utcnow(),
            created_by=data["created_by"],
            verified_by=data.get("verified_by"),
        )
        ok, error = registry.ledger.append(entry)
        if not ok:
            raise ValueError(error)

        contribution = Contribution(
            id=UUID(entry.id),
            member_id=UUID(data["member_id"]),
            amount=Decimal(str(data["amount"])),
            type=contrib_type,
            reference=data.get("reference", ""),
            period_year=period_year if contrib_type == "dues" else None,
            period_month=period_month if contrib_type == "dues" else None,
            created_by=UUID(data["created_by"]),
            verified_by=UUID(data["verified_by"]) if data.get("verified_by") else None,
        )
        db.add(contribution)
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="contribution_recorded",
            entity_type="contribution",
            entity_id=contribution.id,
            metadata={
                "amount": float(contribution.amount),
                "type": contrib_type,
                "period_year": period_year,
                "period_month": period_month,
            },
        )

        member_uuid = UUID(data["member_id"])
        ref = contribution.reference or ""
        is_online = ref.lower().startswith("osaja") or ref.startswith("PSK-")
        await self.create_notification(
            db,
            member_id=member_uuid,
            type="contribution",
            title="Payment received" if is_online else "Contribution recorded",
            message=(
                f"GHS {float(contribution.amount):.2f} {contrib_type} paid online. Ref: {ref}"
                if is_online
                else f"GHS {float(contribution.amount):.2f} {contrib_type} payment recorded. Ref: {ref or '—'}"
            ),
            actor_id=actor_id,
        )

        return contribution_to_dict(contribution, registry.ledger.get_balance(data["member_id"]))

    async def get_contribution_summary(self, db: AsyncSession) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)
        return {"total_contributions": registry.ledger.get_total_contributions()}

    async def list_contributions(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        member_id: UUID | None = None,
    ) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)

        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        query = (
            select(Contribution, Member.full_name, Member.membership_id)
            .join(Member, Contribution.member_id == Member.id)
            .order_by(Contribution.created_at.desc())
        )
        count_query = select(func.count()).select_from(Contribution)
        if member_id:
            query = query.where(Contribution.member_id == member_id)
            count_query = count_query.where(Contribution.member_id == member_id)

        total = await db.scalar(count_query) or 0
        result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
        items = []
        for contrib, full_name, membership_id in result.all():
            row = contribution_to_dict(contrib, registry.ledger.get_balance(str(contrib.member_id)))
            row["member_name"] = full_name
            row["membership_id"] = membership_id
            items.append(row)

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        }

    async def get_member_balance(self, db: AsyncSession, member_id: UUID) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)
        mid = str(member_id)
        return {
            "balance": registry.ledger.get_balance(mid),
            "reconciliation": registry.ledger.reconcile(mid),
        }

    async def list_member_contributions(
        self,
        db: AsyncSession,
        member_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)

        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        mid = str(member_id)

        count_query = select(func.count()).select_from(Contribution).where(Contribution.member_id == member_id)
        total = await db.scalar(count_query) or 0

        result = await db.execute(
            select(Contribution)
            .where(Contribution.member_id == member_id)
            .order_by(Contribution.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = [
            contribution_to_dict(c, registry.ledger.get_balance(mid))
            for c in result.scalars().all()
        ]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        }

    async def get_member_dues(self, db: AsyncSession, member: Member) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)

        contributions = (
            await db.execute(
                select(Contribution).where(
                    Contribution.member_id == member.id,
                    Contribution.type == "dues",
                )
            )
        ).scalars().all()

        paid_periods: list[dict] = []
        for c in contributions:
            year = c.period_year or c.created_at.year
            month = c.period_month or c.created_at.month
            paid_periods.append({"year": year, "month": month, "amount": float(c.amount)})

        since = member.registration_date or member.created_at
        monthly = await get_monthly_dues_amount(db)
        summary = compute_dues_summary(since, paid_periods, monthly_amount=monthly)
        balance = registry.ledger.get_balance(str(member.id))
        summary["balance"] = balance
        return summary

    async def create_vote(self, db: AsyncSession, data: dict, created_by: UUID | None = None) -> dict:
        vote = Vote(
            title=data["title"],
            description=data.get("description"),
            vote_type=data["vote_type"],
            status=VoteLifecycle.DRAFT.value,
            opens_at=data["opens_at"],
            closes_at=data["closes_at"],
            require_email_verified=data.get("require_email_verified", True),
            minimum_contribution=Decimal(str(data["minimum_contribution"]))
            if data.get("minimum_contribution") is not None
            else None,
            executive_only=data.get("executive_only", False),
            created_by=created_by,
        )
        db.add(vote)
        await db.flush()

        options = []
        for i, opt in enumerate(data.get("options", [])):
            option = VoteOption(
                id=UUID(opt["id"]) if opt.get("id") else uuid4(),
                vote_id=vote.id,
                label=opt["label"],
                sort_order=opt.get("sort_order", i),
            )
            db.add(option)
            options.append(option)
        await db.flush()
        return vote_to_dict(vote, options)

    async def open_vote(self, db: AsyncSession, vote_id: UUID, actor_id: UUID | None = None) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")
        vote.status = VoteLifecycle.OPEN.value
        await db.flush()
        await self.log_activity(
            db, actor_id=actor_id, action="vote_opened", entity_type="vote", entity_id=vote.id
        )
        return vote_to_dict(vote)

    async def close_vote(self, db: AsyncSession, vote_id: UUID, actor_id: UUID | None = None) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")
        vote.status = VoteLifecycle.CLOSED.value
        await db.flush()
        await self.log_activity(
            db, actor_id=actor_id, action="vote_closed", entity_type="vote", entity_id=vote.id
        )
        return vote_to_dict(vote)

    async def publish_vote_results(
        self, db: AsyncSession, vote_id: UUID, actor_id: UUID | None = None
    ) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")
        if vote.status not in (VoteLifecycle.CLOSED.value, VoteLifecycle.RESULT_PUBLISHED.value):
            raise ValueError("Vote must be closed before publishing results")
        now = datetime.now(timezone.utc)
        vote.results_published = True
        vote.results_published_at = now
        vote.status = VoteLifecycle.RESULT_PUBLISHED.value
        await db.flush()

        members = (
            await db.execute(select(Member).where(Member.status == MemberStatus.ACTIVE.value))
        ).scalars().all()
        for member in members:
            await self.create_notification(
                db,
                member_id=member.id,
                type="voting",
                title=f"Vote results: {vote.title}",
                message="Results are now available. View them on the Voting page.",
                actor_id=actor_id,
            )

        await self.log_activity(
            db,
            actor_id=actor_id,
            action="vote_results_published",
            entity_type="vote",
            entity_id=vote.id,
        )
        return vote_to_dict(vote)

    async def unpublish_vote_results(
        self, db: AsyncSession, vote_id: UUID, actor_id: UUID | None = None
    ) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")
        if not vote.results_published:
            raise ValueError("Results are not published")
        vote.results_published = False
        vote.results_published_at = None
        if vote.status == VoteLifecycle.RESULT_PUBLISHED.value:
            vote.status = VoteLifecycle.CLOSED.value
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="vote_results_unpublished",
            entity_type="vote",
            entity_id=vote.id,
        )
        return vote_to_dict(vote)

    async def archive_vote(self, db: AsyncSession, vote_id: UUID, actor_id: UUID | None = None) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")
        if vote.status == VoteLifecycle.ARCHIVED.value:
            raise ValueError("Vote is already archived")
        if vote.status not in (
            VoteLifecycle.CLOSED.value,
            VoteLifecycle.RESULT_PUBLISHED.value,
            VoteLifecycle.VERIFIED.value,
        ):
            raise ValueError("Only closed or completed votes can be archived")

        vote.status = VoteLifecycle.ARCHIVED.value
        vote.results_published = False
        vote.results_published_at = None
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="vote_archived",
            entity_type="vote",
            entity_id=vote.id,
        )
        return vote_to_dict(vote)

    async def unarchive_vote(self, db: AsyncSession, vote_id: UUID, actor_id: UUID | None = None) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")
        if vote.status != VoteLifecycle.ARCHIVED.value:
            raise ValueError("Vote is not archived")
        vote.status = VoteLifecycle.CLOSED.value
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="vote_unarchived",
            entity_type="vote",
            entity_id=vote.id,
        )
        return vote_to_dict(vote)

    async def unpublish_stale_vote_results(self, db: AsyncSession, max_age_days: int = 7) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        result = await db.execute(
            select(Vote).where(
                Vote.results_published.is_(True),
                Vote.results_published_at.isnot(None),
                Vote.results_published_at < cutoff,
            )
        )
        votes = result.scalars().all()
        for vote in votes:
            vote.results_published = False
            vote.results_published_at = None
            if vote.status == VoteLifecycle.RESULT_PUBLISHED.value:
                vote.status = VoteLifecycle.CLOSED.value
        if votes:
            await db.flush()
        return len(votes)

    async def list_published_vote_results(self, db: AsyncSession, member_id: UUID) -> list[dict]:
        result = await db.execute(
            select(Vote)
            .options(selectinload(Vote.options))
            .where(
                Vote.results_published.is_(True),
                Vote.status != VoteLifecycle.ARCHIVED.value,
            )
            .order_by(Vote.closes_at.desc())
            .limit(20)
        )
        votes = result.scalars().all()
        submissions = (
            await db.execute(select(VoteSubmission).where(VoteSubmission.member_id == member_id))
        ).scalars().all()
        voted_map = {str(s.vote_id): str(s.option_id) for s in submissions}

        items: list[dict] = []
        for vote in votes:
            summary = await self.get_vote_results(db, vote.id, allow_member=True)
            vid = str(vote.id)
            option_labels = {str(o.id): o.label for o in vote.options}
            summary["has_voted"] = vid in voted_map
            summary["voted_option_id"] = voted_map.get(vid)
            summary["voted_option_label"] = option_labels.get(voted_map.get(vid, ""), "")
            items.append(summary)
        return items

    async def list_all_votes(
        self,
        db: AsyncSession,
        *,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        query = select(Vote).options(selectinload(Vote.options)).order_by(Vote.created_at.desc())
        count_query = select(func.count()).select_from(Vote)
        if status:
            query = query.where(Vote.status == status)
            count_query = count_query.where(Vote.status == status)
        else:
            query = query.where(Vote.status != VoteLifecycle.ARCHIVED.value)
            count_query = count_query.where(Vote.status != VoteLifecycle.ARCHIVED.value)

        total = await db.scalar(count_query) or 0
        votes = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).scalars().all()

        submission_counts: dict[str, int] = {}
        if votes:
            vote_ids = [v.id for v in votes]
            rows = await db.execute(
                select(VoteSubmission.vote_id, func.count())
                .where(VoteSubmission.vote_id.in_(vote_ids))
                .group_by(VoteSubmission.vote_id)
            )
            submission_counts = {str(vid): cnt for vid, cnt in rows.all()}

        items = []
        for vote in votes:
            data = vote_to_dict(vote)
            data["submission_count"] = submission_counts.get(str(vote.id), 0)
            items.append(data)

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        }

    async def submit_vote(
        self, db: AsyncSession, vote_id: UUID, member_id: UUID, option_id: UUID, actor_id: UUID | None = None
    ) -> dict:
        vote_result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = vote_result.scalar_one_or_none()
        member = await self.get_member(db, member_id)
        if not vote or not member:
            raise ValueError("Vote or member not found")

        context = VoteContext(
            vote_id=str(vote_id),
            vote_type=vote.vote_type,
            status=vote.status,
            opens_at=vote.opens_at.replace(tzinfo=None),
            closes_at=vote.closes_at.replace(tzinfo=None),
            valid_option_ids={str(o.id) for o in vote.options},
            eligibility=VoteEligibilityRules(
                require_email_verified=vote.require_email_verified,
                minimum_contribution=float(vote.minimum_contribution) if vote.minimum_contribution else None,
                executive_only=vote.executive_only,
            ),
        )

        member_dict = member_to_dict(member)
        is_executive = member.role in (UserRole.EXECUTIVE.value, UserRole.ADMINISTRATOR.value)
        contribution_total = registry.ledger.get_balance(str(member_id))

        error = registry.vote_engine.validate_submission(
            member_dict,
            context,
            str(option_id),
            member_contribution_total=contribution_total,
            is_executive=is_executive,
        )
        if error:
            raise ValueError(error)

        submission = VoteSubmission(vote_id=vote_id, member_id=member_id, option_id=option_id, locked=True)
        db.add(submission)
        try:
            await db.flush()
        except IntegrityError as exc:
            raise ValueError("duplicate_vote") from exc

        if not registry.vote_engine.submit_vote(str(vote_id), str(member_id), str(option_id)):
            raise ValueError("duplicate_vote")

        db.add(
            VoteAuditLog(
                vote_id=vote_id,
                member_id=member_id,
                action="vote_submitted",
                metadata_json={"option_id": str(option_id)},
            )
        )
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="vote_submitted",
            entity_type="vote",
            entity_id=vote_id,
            metadata={"option_id": str(option_id)},
        )
        return {
            "vote_id": str(vote_id),
            "member_id": str(member_id),
            "option_id": str(option_id),
            "locked": True,
        }

    async def list_active_votes(self, db: AsyncSession, member_id: UUID) -> list[dict]:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(Vote)
            .options(selectinload(Vote.options))
            .where(Vote.status == VoteLifecycle.OPEN.value)
            .order_by(Vote.closes_at.asc())
        )
        votes = result.scalars().all()

        submissions = (
            await db.execute(
                select(VoteSubmission).where(VoteSubmission.member_id == member_id)
            )
        ).scalars().all()
        voted_map = {str(s.vote_id): str(s.option_id) for s in submissions}

        items: list[dict] = []
        for vote in votes:
            if vote.opens_at > now or vote.closes_at < now:
                continue
            data = vote_to_dict(vote)
            vid = str(vote.id)
            data["has_voted"] = vid in voted_map
            data["voted_option_id"] = voted_map.get(vid)
            items.append(data)
        return items

    async def get_vote_results(
        self, db: AsyncSession, vote_id: UUID, *, allow_member: bool = False
    ) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")
        if allow_member and not vote.results_published:
            raise ValueError("Results are not published yet")

        option_labels = {str(o.id): o.label for o in vote.options}
        option_ids = list(option_labels.keys())
        results = registry.vote_engine.calculate_results(str(vote_id), option_ids)
        winner = registry.vote_engine.get_winner(str(vote_id), option_ids)

        return {
            "vote_id": str(vote_id),
            "vote_title": vote.title,
            "vote_status": vote.status,
            "results": [
                {
                    "option_id": r.option_id,
                    "label": option_labels.get(r.option_id, ""),
                    "count": r.count,
                    "percentage": round(r.percentage, 2),
                }
                for r in results
            ],
            "winner_option_id": winner,
            "winner_label": option_labels.get(winner, "") if winner else None,
            "total_votes": registry.vote_engine.get_total_votes(str(vote_id)),
        }

    async def dashboard_stats(self, db: AsyncSession) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)

        total_members = await db.scalar(select(func.count()).select_from(Member))
        active_members = await db.scalar(
            select(func.count()).select_from(Member).where(Member.status == MemberStatus.ACTIVE.value)
        )
        pending_welfare = await db.scalar(
            select(func.count())
            .select_from(WelfareCase)
            .where(WelfareCase.status.notin_(["resolved", "archived"]))
        )
        active_votes = await db.scalar(
            select(func.count()).select_from(Vote).where(Vote.status == VoteLifecycle.OPEN.value)
        )

        today = datetime.now(timezone.utc).date()
        birthdays_today = registry.birthday_index.get_birthdays_for_date(today.month, today.day)

        return {
            "total_members": total_members or 0,
            "active_members": active_members or 0,
            "pending_welfare_cases": pending_welfare or 0,
            "total_contributions": registry.ledger.get_total_contributions(),
            "upcoming_birthdays_today": len(birthdays_today),
            "active_votes": active_votes or 0,
        }

    async def monthly_birthdays(self, db: AsyncSession, month: int) -> list[dict]:
        if not registry._loaded:
            await registry.rebuild(db)
        birthdays = registry.birthday_index.get_birthdays_for_month(month)
        if not birthdays:
            return []

        member_ids = [UUID(b.member_id) for b in birthdays]
        rows = await db.execute(
            select(Member.id, Member.avatar_url, Member.membership_id).where(Member.id.in_(member_ids))
        )
        meta = {str(r.id): {"avatar_url": r.avatar_url, "membership_id": r.membership_id} for r in rows.all()}

        return [
            {
                "member_id": b.member_id,
                "full_name": b.full_name,
                "day": b.day,
                "avatar_url": meta.get(b.member_id, {}).get("avatar_url"),
                "membership_id": meta.get(b.member_id, {}).get("membership_id"),
            }
            for b in birthdays
        ]

    BIRTHDAY_WISH_TTL_DAYS = 7

    def _member_birthday_on(self, member: Member, on: date) -> bool:
        dob = member.date_of_birth
        return dob.month == on.month and dob.day == on.day

    def _wish_expires_at(self, birthday_on: date) -> datetime:
        end = datetime.combine(birthday_on, time.max, tzinfo=timezone.utc)
        return end + timedelta(days=self.BIRTHDAY_WISH_TTL_DAYS)

    async def _author_brief(self, db: AsyncSession, member_id: UUID) -> dict:
        member = await self.get_member(db, member_id)
        if not member:
            return {"id": str(member_id), "full_name": "Member", "avatar_url": None}
        return {
            "id": str(member.id),
            "full_name": member.full_name,
            "avatar_url": member.avatar_url,
        }

    def _wish_to_dict(self, wish: BirthdayWish, author: dict, replies: list[dict] | None = None) -> dict:
        return {
            "id": str(wish.id),
            "message": wish.message,
            "birthday_on": wish.birthday_on.isoformat(),
            "expires_at": wish.expires_at.isoformat(),
            "created_at": wish.created_at.isoformat(),
            "author": author,
            "replies": replies or [],
        }

    async def list_birthday_wishes(
        self,
        db: AsyncSession,
        *,
        recipient_id: UUID,
        birthday_on: date | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        target = birthday_on or date.today()

        top_level = (
            await db.execute(
                select(BirthdayWish)
                .where(
                    BirthdayWish.recipient_id == recipient_id,
                    BirthdayWish.parent_id.is_(None),
                    BirthdayWish.birthday_on == target,
                    BirthdayWish.expires_at > now,
                )
                .order_by(BirthdayWish.created_at.asc())
            )
        ).scalars().all()

        if not top_level:
            return {"items": [], "birthday_on": target.isoformat(), "can_post": False}

        wish_ids = [w.id for w in top_level]
        replies = (
            await db.execute(
                select(BirthdayWish)
                .where(
                    BirthdayWish.parent_id.in_(wish_ids),
                    BirthdayWish.expires_at > now,
                )
                .order_by(BirthdayWish.created_at.asc())
            )
        ).scalars().all()

        replies_by_parent: dict[UUID, list[BirthdayWish]] = {}
        for r in replies:
            replies_by_parent.setdefault(r.parent_id, []).append(r)

        author_cache: dict[str, dict] = {}
        items: list[dict] = []
        for wish in top_level:
            aid = str(wish.author_id)
            if aid not in author_cache:
                author_cache[aid] = await self._author_brief(db, wish.author_id)
            reply_items: list[dict] = []
            for rep in replies_by_parent.get(wish.id, []):
                rid = str(rep.author_id)
                if rid not in author_cache:
                    author_cache[rid] = await self._author_brief(db, rep.author_id)
                reply_items.append(self._wish_to_dict(rep, author_cache[rid]))
            items.append(self._wish_to_dict(wish, author_cache[aid], reply_items))

        recipient = await self.get_member(db, recipient_id)
        can_post = bool(recipient and self._member_birthday_on(recipient, date.today()))

        return {
            "items": items,
            "birthday_on": target.isoformat(),
            "can_post": can_post,
            "expires_note": f"Wishes disappear {self.BIRTHDAY_WISH_TTL_DAYS} days after the birthday.",
        }

    async def create_birthday_wish(
        self,
        db: AsyncSession,
        *,
        author_id: UUID,
        recipient_id: UUID,
        message: str,
    ) -> dict:
        recipient = await self.get_member(db, recipient_id)
        if not recipient:
            raise ValueError("Member not found")
        if recipient.status != MemberStatus.ACTIVE.value:
            raise ValueError("Cannot send wishes to this member")
        if author_id == recipient_id:
            raise ValueError("You cannot send a wish to yourself")

        today = date.today()
        if not self._member_birthday_on(recipient, today):
            raise ValueError("Wishes can only be sent on the member's birthday")

        author = await self.get_member(db, author_id)
        if not author:
            raise ValueError("Author not found")

        wish = BirthdayWish(
            recipient_id=recipient_id,
            author_id=author_id,
            message=message.strip(),
            birthday_on=today,
            expires_at=self._wish_expires_at(today),
        )
        db.add(wish)
        await db.flush()

        await self.create_notification(
            db,
            member_id=recipient_id,
            type="celebration",
            title="New birthday wish!",
            message=f"{author.full_name} sent you a birthday wish.",
            actor_id=author_id,
        )

        return self._wish_to_dict(wish, await self._author_brief(db, author_id))

    async def reply_birthday_wish(
        self,
        db: AsyncSession,
        *,
        recipient_id: UUID,
        parent_id: UUID,
        message: str,
    ) -> dict:
        parent = await db.get(BirthdayWish, parent_id)
        if not parent or parent.parent_id is not None:
            raise ValueError("Wish not found")
        if parent.recipient_id != recipient_id:
            raise ValueError("Only the birthday member can reply")
        now = datetime.now(timezone.utc)
        if parent.expires_at <= now:
            raise ValueError("This wish thread has expired")

        reply = BirthdayWish(
            recipient_id=recipient_id,
            author_id=recipient_id,
            parent_id=parent_id,
            message=message.strip(),
            birthday_on=parent.birthday_on,
            expires_at=parent.expires_at,
        )
        db.add(reply)
        await db.flush()

        if parent.author_id != recipient_id:
            await self.create_notification(
                db,
                member_id=parent.author_id,
                type="celebration",
                title="Birthday wish reply",
                message=f"Your wish received a reply from the birthday celebrant.",
                actor_id=recipient_id,
            )

        return self._wish_to_dict(reply, await self._author_brief(db, recipient_id))

    async def create_notification(
        self,
        db: AsyncSession,
        *,
        member_id: UUID,
        type: str,
        title: str,
        message: str,
        actor_id: UUID | None = None,
        push_pending: bool = True,
    ) -> dict:
        now = datetime.now(timezone.utc)
        notification = Notification(
            member_id=member_id,
            type=type,
            title=title,
            message=message,
            sent_at=now,
            push_pending=push_pending,
        )
        db.add(notification)
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="notification_created",
            entity_type="notification",
            entity_id=notification.id,
        )

        if push_pending:
            delivered = await self.deliver_push_notification(
                db,
                member_id=member_id,
                notification_id=notification.id,
                notification_type=type,
                title=title,
                message=message,
            )
            if delivered:
                notification.push_pending = False
                await db.flush()
            elif settings.job_worker_enabled:
                push_payload = {
                    "member_id": str(member_id),
                    "notification_id": str(notification.id),
                    "notification_type": type,
                    "title": title,
                    "message": message,
                    "url": "/notifications",
                }
                await job_queue.enqueue("push_notification", push_payload)

        return {
            "id": str(notification.id),
            "member_id": str(member_id),
            "type": type,
            "title": title,
            "message": message,
            "read": False,
            "push_pending": notification.push_pending,
            "created_at": notification.created_at.isoformat(),
        }

    async def deliver_push_notification(
        self,
        db: AsyncSession,
        *,
        member_id: UUID,
        notification_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        url: str = "/notifications",
    ) -> bool:
        if not is_push_configured():
            return False

        member = await self.get_member(db, member_id)
        if not member or not member_allows_push_type(member.preferences_json, notification_type):
            return False

        subs = (
            await db.execute(select(PushSubscription).where(PushSubscription.member_id == member_id))
        ).scalars().all()
        if not subs:
            return False

        payload = build_payload(
            title=title,
            message=message,
            notification_type=notification_type,
            url=url,
        )
        delivered = False
        for sub in subs:
            try:
                send_web_push(
                    endpoint=sub.endpoint,
                    p256dh_key=sub.p256dh_key,
                    auth_key=sub.auth_key,
                    payload=payload,
                )
                delivered = True
            except WebPushException as exc:
                if is_subscription_gone(exc):
                    await self.remove_push_subscription(db, member_id=member_id, endpoint=sub.endpoint)
                continue
            except Exception:
                continue

        return delivered

    async def send_test_push(self, db: AsyncSession, member: Member) -> dict:
        if not is_push_configured():
            raise ValueError("VAPID keys are not configured on the server")

        subs = (
            await db.execute(select(PushSubscription).where(PushSubscription.member_id == member.id))
        ).scalars().all()
        if not subs:
            raise ValueError("No push subscription found — enable push in Settings first")

        payload = build_payload(
            title="OSAJA'20 Welfare",
            message="Push notifications are working!",
            notification_type="announcement",
            url="/notifications",
        )
        sent = 0
        for sub in subs:
            try:
                send_web_push(
                    endpoint=sub.endpoint,
                    p256dh_key=sub.p256dh_key,
                    auth_key=sub.auth_key,
                    payload=payload,
                )
                sent += 1
            except WebPushException as exc:
                if is_subscription_gone(exc):
                    await self.remove_push_subscription(db, member_id=member.id, endpoint=sub.endpoint)
            except Exception:
                continue

        if sent == 0:
            raise ValueError("Could not deliver test push to any device")
        return {"delivered": sent, "subscriptions": len(subs)}

    async def scan_birthday_notifications(self, db: AsyncSession, actor_id: UUID | None = None) -> int:
        if not registry._loaded:
            await registry.rebuild(db)

        today = datetime.now(timezone.utc).date()
        birthdays = registry.birthday_index.get_birthdays_for_date(today.month, today.day)
        if not birthdays:
            return 0

        day_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
        created = 0

        for b in birthdays:
            member_uuid = UUID(b.member_id)
            await self.create_notification(
                db,
                member_id=member_uuid,
                type="celebration",
                title="Happy Birthday!",
                message=f"Happy birthday, {b.full_name}! The OSAJA'20 family celebrates you today.",
                actor_id=actor_id,
            )
            created += 1

        active_members = (
            await db.execute(select(Member).where(Member.status == MemberStatus.ACTIVE.value))
        ).scalars().all()

        for b in birthdays:
            birthday_id = UUID(b.member_id)
            for member in active_members:
                if member.id == birthday_id:
                    continue
                existing = await db.scalar(
                    select(func.count())
                    .select_from(Notification)
                    .where(
                        Notification.member_id == member.id,
                        Notification.type == "celebration",
                        Notification.created_at >= day_start,
                        Notification.message.contains(b.full_name),
                    )
                )
                if existing:
                    continue
                await self.create_notification(
                    db,
                    member_id=member.id,
                    type="celebration",
                    title="Birthday Today",
                    message=f"Join us in celebrating {b.full_name}'s birthday today!",
                    actor_id=actor_id,
                )
                created += 1

        return created

    async def publish_announcement(
        self,
        db: AsyncSession,
        *,
        title: str,
        content: str,
        target_audience: list[str],
        created_by: UUID,
        notify_members: bool = True,
    ) -> dict:
        now = datetime.now(timezone.utc)
        announcement = Announcement(
            title=title,
            content=content,
            target_audience=target_audience,
            published_at=now,
            created_by=created_by,
        )
        db.add(announcement)
        await db.flush()

        if notify_members:
            members = (await db.execute(select(Member).where(Member.status == MemberStatus.ACTIVE.value))).scalars().all()
            for member in members:
                if "all" not in target_audience and member.role not in target_audience:
                    continue
                await self.create_notification(
                    db,
                    member_id=member.id,
                    type="announcement",
                    title=title,
                    message=content[:500],
                    actor_id=created_by,
                )

        await self.log_activity(
            db,
            actor_id=created_by,
            action="announcement_published",
            entity_type="announcement",
            entity_id=announcement.id,
        )
        return {
            "id": str(announcement.id),
            "title": title,
            "content": content,
            "published_at": now.isoformat(),
        }

    async def update_announcement(
        self,
        db: AsyncSession,
        announcement_id: UUID,
        *,
        title: str | None = None,
        content: str | None = None,
        notify_members: bool = False,
        actor_id: UUID | None = None,
    ) -> dict:
        announcement = await db.get(Announcement, announcement_id)
        if not announcement or announcement.archived:
            raise ValueError("Announcement not found")

        if title is not None:
            announcement.title = title
        if content is not None:
            announcement.content = content
        await db.flush()

        if notify_members:
            members = (await db.execute(select(Member).where(Member.status == MemberStatus.ACTIVE.value))).scalars().all()
            audience = announcement.target_audience or ["all"]
            for member in members:
                if "all" not in audience and member.role not in audience:
                    continue
                await self.create_notification(
                    db,
                    member_id=member.id,
                    type="announcement",
                    title=announcement.title,
                    message=announcement.content[:500],
                    actor_id=actor_id,
                )

        await self.log_activity(
            db,
            actor_id=actor_id,
            action="announcement_updated",
            entity_type="announcement",
            entity_id=announcement.id,
        )
        return {
            "id": str(announcement.id),
            "title": announcement.title,
            "content": announcement.content,
            "published_at": announcement.published_at.isoformat() if announcement.published_at else None,
            "created_at": announcement.created_at.isoformat(),
        }

    async def delete_member_notification(
        self, db: AsyncSession, notification_id: UUID, member_id: UUID
    ) -> None:
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.member_id == member_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise ValueError("Notification not found")
        await db.delete(notification)
        await db.flush()

    async def delete_all_member_notifications(self, db: AsyncSession, member_id: UUID) -> int:
        result = await db.execute(
            select(Notification).where(Notification.member_id == member_id)
        )
        items = result.scalars().all()
        for n in items:
            await db.delete(n)
        await db.flush()
        return len(items)

    async def delete_notification_by_id(
        self, db: AsyncSession, notification_id: UUID, *, actor_id: UUID | None = None
    ) -> None:
        notification = await db.get(Notification, notification_id)
        if not notification:
            raise ValueError("Notification not found")
        await db.delete(notification)
        await db.flush()
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="notification_deleted",
            entity_type="notification",
            entity_id=notification_id,
        )

    async def delete_announcement_notifications(
        self, db: AsyncSession, *, title: str
    ) -> int:
        result = await db.execute(
            select(Notification).where(
                Notification.type == "announcement",
                Notification.title == title,
            )
        )
        items = result.scalars().all()
        for n in items:
            await db.delete(n)
        await db.flush()
        return len(items)

    async def scan_dues_reminder_notifications(self, db: AsyncSession) -> int:
        """Remind members with unpaid current-month dues in the last 3 days of the month."""
        import calendar

        from v1.core.dues import DUES_REMINDER_DAYS_BEFORE_MONTH_END, period_label

        today = datetime.now(timezone.utc).date()
        last_day = calendar.monthrange(today.year, today.month)[1]
        days_left = last_day - today.day
        if days_left > DUES_REMINDER_DAYS_BEFORE_MONTH_END or days_left < 0:
            return 0

        day_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
        reminder_title = f"Dues reminder — {period_label(today.year, today.month)}"
        created = 0

        members = (
            await db.execute(select(Member).where(Member.status == MemberStatus.ACTIVE.value))
        ).scalars().all()

        for member in members:
            dues = await self.get_member_dues(db, member)
            if dues.get("current_status") == "paid":
                continue

            existing = await db.scalar(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.member_id == member.id,
                    Notification.type == "contribution",
                    Notification.title == reminder_title,
                    Notification.created_at >= day_start,
                )
            )
            if existing:
                continue

            amount = dues.get("monthly_amount", 30)
            await self.create_notification(
                db,
                member_id=member.id,
                type="contribution",
                title=reminder_title,
                message=(
                    f"{days_left + 1} day(s) left in {period_label(today.year, today.month)}. "
                    f"Pay your GHS {amount:.2f} dues on the Contributions page."
                ),
            )
            created += 1

        return created

    async def archive_announcement(
        self,
        db: AsyncSession,
        announcement_id: UUID,
        *,
        actor_id: UUID | None = None,
    ) -> None:
        announcement = await db.get(Announcement, announcement_id)
        if not announcement or announcement.archived:
            raise ValueError("Announcement not found")
        title = announcement.title
        announcement.archived = True
        await db.flush()
        await self.delete_announcement_notifications(db, title=title)
        await self.log_activity(
            db,
            actor_id=actor_id,
            action="announcement_archived",
            entity_type="announcement",
            entity_id=announcement.id,
        )

    async def register_push_subscription(
        self,
        db: AsyncSession,
        *,
        member_id: UUID,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        user_agent: str | None,
    ) -> dict:
        existing = await db.execute(
            select(PushSubscription).where(
                PushSubscription.member_id == member_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        sub = existing.scalar_one_or_none()
        if sub:
            sub.p256dh_key = p256dh_key
            sub.auth_key = auth_key
            sub.user_agent = user_agent
        else:
            sub = PushSubscription(
                member_id=member_id,
                endpoint=endpoint,
                p256dh_key=p256dh_key,
                auth_key=auth_key,
                user_agent=user_agent,
            )
            db.add(sub)
        await db.flush()
        return {"id": str(sub.id), "endpoint": endpoint}

    async def remove_push_subscription(
        self, db: AsyncSession, *, member_id: UUID, endpoint: str
    ) -> bool:
        result = await db.execute(
            delete(PushSubscription).where(
                PushSubscription.member_id == member_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        await db.flush()
        return result.rowcount > 0

    async def list_activity_logs(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 50,
        action: str | None = None,
    ) -> dict:
        filters = []
        if action:
            filters.append(ActivityLog.action == action)

        count_q = select(func.count(ActivityLog.id))
        if filters:
            count_q = count_q.where(*filters)
        total = (await db.execute(count_q)).scalar_one()

        query = select(ActivityLog)
        if filters:
            query = query.where(*filters)

        offset = (page - 1) * page_size
        result = await db.execute(
            query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(page_size)
        )
        logs = result.scalars().all()

        actor_ids = {log.actor_id for log in logs if log.actor_id}
        actors: dict[UUID, Member] = {}
        if actor_ids:
            actor_rows = await db.execute(select(Member).where(Member.id.in_(actor_ids)))
            actors = {m.id: m for m in actor_rows.scalars().all()}

        items = []
        for log in logs:
            actor = actors.get(log.actor_id) if log.actor_id else None
            items.append(
                {
                    "id": str(log.id),
                    "action": log.action,
                    "entity_type": log.entity_type,
                    "entity_id": str(log.entity_id),
                    "metadata": log.metadata_json or {},
                    "created_at": log.created_at.isoformat(),
                    "actor": (
                        {
                            "id": str(actor.id),
                            "full_name": actor.full_name,
                            "membership_id": actor.membership_id,
                        }
                        if actor
                        else None
                    ),
                }
            )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        }

    async def send_member_email_digest(self, db: AsyncSession, member_id: UUID) -> bool:
        if not is_email_configured():
            return False

        member = await self.get_member(db, member_id)
        if not member or member.status != MemberStatus.ACTIVE.value:
            return False

        prefs = merge_preferences(member.preferences_json)
        if not prefs.get("email_digest"):
            return False

        since = datetime.now(timezone.utc) - timedelta(days=7)
        result = await db.execute(
            select(Notification)
            .where(
                Notification.member_id == member_id,
                Notification.created_at >= since,
            )
            .order_by(Notification.created_at.desc())
            .limit(20)
        )
        notifications = result.scalars().all()
        if not notifications:
            return False

        items = [
            {"type": n.type, "title": n.title, "message": n.message}
            for n in notifications
        ]
        subject, body_text, body_html = build_digest_email(
            member_name=member.full_name,
            items=items,
        )
        send_email(
            to_email=member.email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )

        stored = dict(member.preferences_json or {})
        stored["last_email_digest_at"] = datetime.now(timezone.utc).isoformat()
        member.preferences_json = stored
        await db.flush()

        await self.log_activity(
            db,
            actor_id=member.id,
            action="email_digest_sent",
            entity_type="member",
            entity_id=member.id,
            metadata={"notification_count": len(items)},
        )
        return True

    async def submit_support_inquiry(
        self,
        db: AsyncSession,
        *,
        member: Member,
        message: str,
        subject: str | None = None,
    ) -> dict:
        title = subject.strip() if subject and subject.strip() else "Member inquiry"
        body = f"{member.full_name} ({member.membership_id}): {message.strip()}"

        result = await db.execute(
            select(Member).where(
                Member.role.in_([UserRole.EXECUTIVE.value, UserRole.ADMINISTRATOR.value]),
                Member.status == MemberStatus.ACTIVE.value,
            )
        )
        executives = result.scalars().all()
        for exec_member in executives:
            await self.create_notification(
                db,
                member_id=exec_member.id,
                type="support",
                title=title,
                message=body,
                actor_id=member.id,
            )

        await self.log_activity(
            db,
            actor_id=member.id,
            action="support_inquiry_sent",
            entity_type="member",
            entity_id=member.id,
            metadata={"executive_count": len(executives)},
        )
        return {"notified": len(executives)}


platform_service = PlatformService()
