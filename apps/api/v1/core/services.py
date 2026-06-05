"""In-memory service layer backed by robust data structure algorithms."""

from datetime import datetime
from uuid import uuid4

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


class PlatformServices:
    """Singleton-style service registry for algorithm-backed operations."""

    def __init__(self) -> None:
        self.member_index = MemberSearchTrie()
        self.vote_engine = VoteEngine()
        self.ledger = ContributionLedger()
        self.welfare_fsm = WelfareStateMachine()
        self.birthday_index = BirthdayIndex()
        self._members: dict[str, dict] = {}
        self._welfare_cases: dict[str, dict] = {}
        self._votes: dict[str, dict] = {}

    def register_member(self, member: dict) -> dict:
        member_id = member.get("id") or str(uuid4())
        member["id"] = member_id
        self._members[member_id] = member

        self.member_index.insert(
            member_id,
            member.get("full_name", ""),
            member.get("email", ""),
            member.get("membership_id", ""),
        )

        dob = member.get("date_of_birth")
        if dob:
            if isinstance(dob, str):
                parts = dob.split("-")
                month, day = int(parts[1]), int(parts[2])
            else:
                month, day = dob.month, dob.day
            self.birthday_index.insert(
                BirthdayMember(
                    member_id=member_id,
                    full_name=member.get("full_name", ""),
                    month=month,
                    day=day,
                )
            )

        return member

    def search_members(self, query: str, limit: int = 20) -> list[dict]:
        ids = self.member_index.search(query, limit)
        return [self._members[mid] for mid in ids if mid in self._members]

    def create_welfare_case(self, data: dict) -> dict:
        case_id = str(uuid4())
        case = {
            "id": case_id,
            "status": "created",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            **data,
        }
        self._welfare_cases[case_id] = case
        return case

    def transition_welfare_case(self, case_id: str, target_status: str) -> dict:
        case = self._welfare_cases.get(case_id)
        if not case:
            raise ValueError("Case not found")

        success, new_status, error = self.welfare_fsm.transition(case["status"], target_status)
        if not success:
            raise ValueError(error)

        case["status"] = new_status
        case["updated_at"] = datetime.utcnow().isoformat()
        return case

    def record_contribution(self, data: dict) -> dict:
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
        ok, error = self.ledger.append(entry)
        if not ok:
            raise ValueError(error)

        return {
            "id": entry.id,
            "member_id": entry.member_id,
            "amount": entry.amount,
            "reference": entry.reference,
            "balance": self.ledger.get_balance(entry.member_id),
            "created_at": entry.created_at.isoformat(),
        }

    def create_vote(self, data: dict) -> dict:
        vote_id = str(uuid4())
        vote = {
            "id": vote_id,
            "status": "draft",
            "options": data.get("options", []),
            **data,
        }
        self._votes[vote_id] = vote
        return vote

    def submit_vote(
        self,
        vote_id: str,
        member_id: str,
        option_id: str,
    ) -> dict:
        vote = self._votes.get(vote_id)
        member = self._members.get(member_id)
        if not vote or not member:
            raise ValueError("Vote or member not found")

        context = VoteContext(
            vote_id=vote_id,
            vote_type=vote.get("vote_type", "election"),
            status=vote.get("status", "open"),
            opens_at=datetime.fromisoformat(vote["opens_at"]),
            closes_at=datetime.fromisoformat(vote["closes_at"]),
            valid_option_ids={o["id"] for o in vote.get("options", [])},
            eligibility=VoteEligibilityRules(
                require_email_verified=vote.get("require_email_verified", True),
                minimum_contribution=vote.get("minimum_contribution"),
                executive_only=vote.get("executive_only", False),
            ),
        )

        contribution_total = self.ledger.get_balance(member_id)
        error = self.vote_engine.validate_submission(
            member, context, option_id, member_contribution_total=contribution_total
        )
        if error:
            raise ValueError(error)

        if not self.vote_engine.submit_vote(vote_id, member_id, option_id):
            raise ValueError("duplicate_vote")

        return {"vote_id": vote_id, "member_id": member_id, "option_id": option_id, "locked": True}

    def get_vote_results(self, vote_id: str) -> list[dict]:
        vote = self._votes.get(vote_id)
        if not vote:
            raise ValueError("Vote not found")

        option_ids = [o["id"] for o in vote.get("options", [])]
        results = self.vote_engine.calculate_results(vote_id, option_ids)
        return [
            {"option_id": r.option_id, "count": r.count, "percentage": round(r.percentage, 2)}
            for r in results
        ]


services = PlatformServices()
