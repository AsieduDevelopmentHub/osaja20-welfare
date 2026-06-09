from decimal import Decimal
from uuid import UUID

from v1.core.member_preferences import merge_preferences
from v1.core.models import Contribution, Member, Vote, VoteOption, WelfareCase


def member_to_dict(member: Member, *, include_internal: bool = False) -> dict:
    data = {
        "id": str(member.id),
        "full_name": member.full_name,
        "username": member.username,
        "email": member.email,
        "phone_number": member.phone_number,
        "date_of_birth": member.date_of_birth.isoformat(),
        "membership_id": member.membership_id,
        "batch": member.batch,
        "status": member.status,
        "role": member.role,
        "email_verified": member.email_verified,
        "registration_date": member.registration_date.isoformat() if member.registration_date else None,
        "avatar_url": member.avatar_url,
        "preferences": merge_preferences(member.preferences_json),
    }
    if include_internal and member.auth_user_id:
        data["auth_user_id"] = str(member.auth_user_id)
    return data


def welfare_case_to_dict(case: WelfareCase) -> dict:
    from v1.core.algorithms.state_machine import normalize_welfare_status

    return {
        "id": str(case.id),
        "member_id": str(case.member_id),
        "title": case.title,
        "description": case.description,
        "status": normalize_welfare_status(case.status),
        "created_at": case.created_at.isoformat(),
        "updated_at": case.updated_at.isoformat(),
    }


def vote_to_dict(vote: Vote, options: list[VoteOption] | None = None) -> dict:
    opts = options if options is not None else vote.options
    return {
        "id": str(vote.id),
        "title": vote.title,
        "description": vote.description,
        "vote_type": vote.vote_type,
        "status": vote.status,
        "opens_at": vote.opens_at.isoformat(),
        "closes_at": vote.closes_at.isoformat(),
        "require_email_verified": vote.require_email_verified,
        "minimum_contribution": float(vote.minimum_contribution) if vote.minimum_contribution else None,
        "executive_only": vote.executive_only,
        "results_published": vote.results_published,
        "results_published_at": vote.results_published_at.isoformat() if vote.results_published_at else None,
        "options": [
            {"id": str(o.id), "label": o.label, "sort_order": o.sort_order} for o in opts
        ],
    }


def contribution_to_dict(
    contribution: Contribution,
    balance: float,
) -> dict:
    return {
        "id": str(contribution.id),
        "member_id": str(contribution.member_id),
        "amount": float(contribution.amount),
        "type": contribution.type,
        "reference": contribution.reference,
        "period_year": contribution.period_year,
        "period_month": contribution.period_month,
        "created_by": str(contribution.created_by),
        "verified_by": str(contribution.verified_by) if contribution.verified_by else None,
        "created_at": contribution.created_at.isoformat(),
        "balance": balance,
    }


def uuid_str(value: UUID | str) -> str:
    return str(value)


def to_decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value))
