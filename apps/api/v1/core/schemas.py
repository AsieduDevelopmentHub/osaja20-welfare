from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class MemberCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone_number: str = Field(min_length=10, max_length=20)
    date_of_birth: date
    membership_id: str
    batch: int = 2020


class MemberResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone_number: str
    date_of_birth: str
    membership_id: str
    batch: int
    status: str
    email_verified: bool
    registration_date: str


class WelfareCaseCreate(BaseModel):
    member_id: str
    title: str
    description: str


class WelfareTransition(BaseModel):
    target_status: str


class ContributionCreate(BaseModel):
    member_id: str
    amount: float = Field(gt=0)
    reference: str = ""
    created_by: str
    verified_by: str | None = None


class VoteCreate(BaseModel):
    title: str
    description: str = ""
    vote_type: Literal["election", "decision", "multi_choice"] = "election"
    opens_at: datetime
    closes_at: datetime
    options: list[dict]
    require_email_verified: bool = True
    minimum_contribution: float | None = None
    executive_only: bool = False


class VoteSubmit(BaseModel):
    member_id: str
    option_id: str


class ApiResponse(BaseModel):
    success: bool
    data: dict | list | None = None
    message: str | None = None
    error: str | None = None
