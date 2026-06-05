"""Database-backed service layer with in-memory algorithm indexes."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    Contribution,
    Member,
    MemberStatus,
    UserRole,
    Vote,
    VoteAuditLog,
    VoteLifecycle,
    VoteOption,
    VoteSubmission,
    WelfareCase,
)
from v1.core.serializers import (
    contribution_to_dict,
    member_to_dict,
    vote_to_dict,
    welfare_case_to_dict,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
        )
        self.birthday_index.insert(
            BirthdayMember(
                member_id=str(member.id),
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
        membership_id: str,
        batch: int,
        password: str | None = None,
        role: str = UserRole.MEMBER.value,
        auth_user_id: UUID | None = None,
        email_verified: bool = False,
        actor_id: UUID | None = None,
    ) -> Member:
        member = Member(
            full_name=full_name,
            email=email.lower(),
            phone_number=phone_number,
            date_of_birth=date_of_birth,
            membership_id=membership_id,
            batch=batch,
            status=MemberStatus.PENDING.value,
            role=role,
            email_verified=email_verified,
            auth_user_id=auth_user_id,
            password_hash=pwd_context.hash(password) if password else None,
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

    async def authenticate_local(self, db: AsyncSession, email: str, password: str) -> Member | None:
        result = await db.execute(select(Member).where(Member.email == email.lower()))
        member = result.scalar_one_or_none()
        if not member or not member.password_hash:
            return None
        if not pwd_context.verify(password, member.password_hash):
            return None
        return member

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

    async def create_welfare_case(self, db: AsyncSession, data: dict, actor_id: UUID | None = None) -> dict:
        case = WelfareCase(
            member_id=UUID(data["member_id"]),
            title=data["title"],
            description=data["description"],
            status="created",
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

        case.status = new_status
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

    async def get_welfare_case(self, db: AsyncSession, case_id: UUID) -> dict | None:
        result = await db.execute(select(WelfareCase).where(WelfareCase.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            return None
        data = welfare_case_to_dict(case)
        data["available_transitions"] = registry.welfare_fsm.get_available_transitions(case.status)
        return data

    async def record_contribution(self, db: AsyncSession, data: dict, actor_id: UUID | None = None) -> dict:
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
            reference=data.get("reference", ""),
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
            metadata={"amount": float(contribution.amount)},
        )
        return contribution_to_dict(contribution, registry.ledger.get_balance(data["member_id"]))

    async def get_contribution_summary(self, db: AsyncSession) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)
        return {"total_contributions": registry.ledger.get_total_contributions()}

    async def get_member_balance(self, db: AsyncSession, member_id: UUID) -> dict:
        if not registry._loaded:
            await registry.rebuild(db)
        mid = str(member_id)
        return {
            "balance": registry.ledger.get_balance(mid),
            "reconciliation": registry.ledger.reconcile(mid),
        }

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

    async def get_vote_results(self, db: AsyncSession, vote_id: UUID) -> dict:
        result = await db.execute(
            select(Vote).options(selectinload(Vote.options)).where(Vote.id == vote_id)
        )
        vote = result.scalar_one_or_none()
        if not vote:
            raise ValueError("Vote not found")

        option_ids = [str(o.id) for o in vote.options]
        results = registry.vote_engine.calculate_results(str(vote_id), option_ids)
        winner = registry.vote_engine.get_winner(str(vote_id), option_ids)

        return {
            "results": [
                {"option_id": r.option_id, "count": r.count, "percentage": round(r.percentage, 2)}
                for r in results
            ],
            "winner_option_id": winner,
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
        return [{"member_id": b.member_id, "full_name": b.full_name, "day": b.day} for b in birthdays]


platform_service = PlatformService()
