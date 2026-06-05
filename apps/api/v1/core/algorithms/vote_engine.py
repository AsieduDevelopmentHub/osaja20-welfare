"""Vote processing engine with hash-based duplicate detection."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

VoteValidationError = Literal[
    "member_inactive",
    "email_not_verified",
    "duplicate_vote",
    "vote_closed",
    "vote_not_open",
    "invalid_option",
    "insufficient_contribution",
    "executive_only",
]


@dataclass
class VoteEligibilityRules:
    require_email_verified: bool = True
    minimum_contribution: float | None = None
    executive_only: bool = False


@dataclass
class VoteContext:
    vote_id: str
    vote_type: str
    status: str
    opens_at: datetime
    closes_at: datetime
    valid_option_ids: set[str]
    eligibility: VoteEligibilityRules = field(default_factory=VoteEligibilityRules)


@dataclass
class VoteResult:
    option_id: str
    count: int
    percentage: float


class VoteEngine:
    def __init__(self) -> None:
        self._submissions: dict[str, set[str]] = {}
        self._tallies: dict[str, dict[str, int]] = {}

    def validate_submission(
        self,
        member: dict,
        context: VoteContext,
        option_id: str,
        now: datetime | None = None,
        member_contribution_total: float = 0.0,
        is_executive: bool = False,
    ) -> VoteValidationError | None:
        now = now or datetime.utcnow()
        rules = context.eligibility

        if member.get("status") != "active":
            return "member_inactive"

        if rules.require_email_verified and not member.get("email_verified"):
            return "email_not_verified"

        if rules.executive_only and not is_executive:
            return "executive_only"

        if (
            rules.minimum_contribution is not None
            and member_contribution_total < rules.minimum_contribution
        ):
            return "insufficient_contribution"

        if context.status != "open":
            return "vote_not_open"
        if now < context.opens_at:
            return "vote_not_open"
        if now > context.closes_at:
            return "vote_closed"
        if option_id not in context.valid_option_ids:
            return "invalid_option"

        if member["id"] in self._submissions.get(context.vote_id, set()):
            return "duplicate_vote"

        return None

    def submit_vote(self, vote_id: str, member_id: str, option_id: str) -> bool:
        if member_id in self._submissions.get(vote_id, set()):
            return False

        self._submissions.setdefault(vote_id, set()).add(member_id)
        tally = self._tallies.setdefault(vote_id, {})
        tally[option_id] = tally.get(option_id, 0) + 1
        return True

    def has_voted(self, vote_id: str, member_id: str) -> bool:
        return member_id in self._submissions.get(vote_id, set())

    def calculate_results(self, vote_id: str, option_ids: list[str]) -> list[VoteResult]:
        tally = self._tallies.get(vote_id, {})
        total = sum(tally.values())
        results = [
            VoteResult(
                option_id=oid,
                count=tally.get(oid, 0),
                percentage=(tally.get(oid, 0) / total * 100) if total > 0 else 0.0,
            )
            for oid in option_ids
        ]
        return sorted(results, key=lambda r: r.count, reverse=True)

    def get_winner(self, vote_id: str, option_ids: list[str]) -> str | None:
        results = self.calculate_results(vote_id, option_ids)
        if not results or results[0].count == 0:
            return None
        top = results[0].count
        tied = [r for r in results if r.count == top]
        return results[0].option_id if len(tied) == 1 else None

    def get_total_votes(self, vote_id: str) -> int:
        return len(self._submissions.get(vote_id, set()))

    def reset(self, vote_id: str) -> None:
        self._submissions.pop(vote_id, None)
        self._tallies.pop(vote_id, None)
