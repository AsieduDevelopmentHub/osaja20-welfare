from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class MemberCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone_number: str = Field(min_length=10, max_length=20)
    date_of_birth: date
    membership_id: str | None = None
    username: str | None = Field(default=None, min_length=3, max_length=30)
    batch: int = 2020


class MemberRoleUpdate(BaseModel):
    role: Literal["administrator", "executive", "member"]


class MemberResponse(BaseModel):
    id: str
    full_name: str
    username: str
    email: str
    phone_number: str
    date_of_birth: str
    membership_id: str
    batch: int
    status: str
    role: str
    email_verified: bool
    registration_date: str


class AuthRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone_number: str = Field(min_length=10, max_length=20)
    date_of_birth: date
    username: str | None = Field(default=None, min_length=3, max_length=30)
    batch: int = 2020


class AuthLogin(BaseModel):
    identifier: str = Field(min_length=1, max_length=255, description="Email, username, or member ID")
    password: str


class MemberPreferencesUpdate(BaseModel):
    notify_dues: bool | None = None
    notify_votes: bool | None = None
    notify_birthdays: bool | None = None
    notify_announcements: bool | None = None
    notify_welfare: bool | None = None
    notify_celebrations: bool | None = None
    email_digest: bool | None = None
    compact_dashboard: bool | None = None


class AuthProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    phone_number: str | None = Field(default=None, min_length=10, max_length=20)
    username: str | None = Field(default=None, min_length=3, max_length=30)
    date_of_birth: date | None = None
    preferences: MemberPreferencesUpdate | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class WelfareCaseCreate(BaseModel):
    member_id: str
    title: str
    description: str


class WelfareTransition(BaseModel):
    target_status: str


class ContributionCreate(BaseModel):
    member_id: str
    amount: float = Field(gt=0)
    type: Literal["dues", "donation", "welfare", "other"] = "dues"
    reference: str = ""
    period_year: int | None = Field(default=None, ge=2020, le=2100)
    period_month: int | None = Field(default=None, ge=1, le=12)
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
    option_id: str


class NotificationCreate(BaseModel):
    member_id: str
    type: Literal["meeting", "welfare", "announcement", "contribution", "celebration", "voting"] = "announcement"
    title: str
    message: str


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    target_audience: list[str] = Field(default_factory=lambda: ["all"])
    notify_members: bool = True


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    notify_members: bool = False


class MemberStatusUpdate(BaseModel):
    status: Literal["active", "inactive", "archived"]


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PaymentSettingsUpdate(BaseModel):
    monthly_amount: float | None = Field(default=None, gt=0)
    currency: str | None = None
    title: str | None = None
    note: str | None = None
    momo_enabled: bool | None = None
    momo_label: str | None = None
    momo_detail: str | None = None
    momo_number: str | None = None
    momo_account_name: str | None = None
    bank_enabled: bool | None = None
    bank_label: str | None = None
    bank_detail: str | None = None
    bank_name: str | None = None
    bank_account_name: str | None = None
    bank_account_number: str | None = None


class PushSubscribe(BaseModel):
    endpoint: str
    keys: PushKeys
    user_agent: str | None = None


class ApiResponse(BaseModel):
    success: bool
    data: dict | list | None = None
    message: str | None = None
    error: str | None = None
