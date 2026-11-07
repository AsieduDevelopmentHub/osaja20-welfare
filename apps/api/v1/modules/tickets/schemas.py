from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, StringConstraints

PhoneNumber = Annotated[str, StringConstraints(strip_whitespace=True, min_length=7, max_length=30)]
DeviceId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class TicketCategoryView(BaseModel):
    id: UUID
    name: str
    description: str
    price: Decimal
    admissions_per_ticket: int
    inventory_remaining: int | None
    sales_start_at: datetime | None
    sales_end_at: datetime | None


class TicketEventView(BaseModel):
    slug: str
    title: str
    description: str
    venue: str
    starts_at: datetime
    categories: list[TicketCategoryView]
    payment_options: list[dict]


class TicketOrderCreate(BaseModel):
    category_id: UUID
    quantity: int = Field(ge=1, le=10)
    purchaser_name: str = Field(min_length=2, max_length=200)
    purchaser_email: EmailStr
    purchaser_phone: PhoneNumber
    payment_method: Literal["paystack", "momo", "bank"] | None = None


class TicketOrderView(BaseModel):
    reference: str
    status: str
    amount: Decimal
    currency: str
    quantity: int
    authorization_url: str | None = None


class TicketOrderRetrieve(BaseModel):
    purchaser_email: EmailStr


class TicketOrderStatusRequest(BaseModel):
    purchaser_email: EmailStr


class TicketManualPaymentSubmit(BaseModel):
    purchaser_email: EmailStr
    transaction_reference: str = Field(
        min_length=4,
        max_length=100,
        pattern=r"^[A-Za-z0-9._/-]+$",
    )
    sender_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]


class TicketManualPaymentDecision(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class TicketScanRequest(BaseModel):
    token: Annotated[str, StringConstraints(strip_whitespace=True, min_length=12, max_length=200)]
    admission_count: int = Field(default=1, ge=1, le=20)
    gate: str = Field(min_length=1, max_length=100)
    device_id: DeviceId


class TicketCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    admissions_per_ticket: int | None = Field(default=None, ge=1, le=20)
    inventory_limit: int | None = Field(default=None, ge=1)
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None
    is_active: bool | None = None


class TicketCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    admissions_per_ticket: int = Field(default=1, ge=1, le=20)
    inventory_limit: int | None = Field(default=None, ge=1)
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None


class TicketEventCreate(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", min_length=3, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    venue: str = Field(min_length=1, max_length=300)
    starts_at: datetime
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None
    is_active: bool = True


class TicketEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=5000)
    venue: str | None = Field(default=None, min_length=1, max_length=300)
    starts_at: datetime | None = None
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None
    is_active: bool | None = None
