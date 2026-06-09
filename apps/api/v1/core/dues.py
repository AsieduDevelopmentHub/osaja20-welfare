"""Monthly dues calculation — mirrors packages/utils/src/dues.ts"""

from datetime import date, datetime, timezone

MONTHLY_DUES_AMOUNT = 30.0
DUES_CURRENCY = "GHS"
DUES_EFFECTIVE_FROM = (2025, 1)
DUES_REMINDER_DAYS_BEFORE_MONTH_END = 3

MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


def period_label(year: int, month: int) -> str:
    return f"{MONTH_NAMES[month - 1]} {year}"


def _period_key(year: int, month: int) -> str:
    return f"{year}-{month:02d}"


def _compare_period(a: tuple[int, int], b: tuple[int, int]) -> int:
    if a[0] != b[0]:
        return a[0] - b[0]
    return a[1] - b[1]


def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    d = date(year, month, 1)
    m = month - 1 + delta
    y = year + m // 12
    m = m % 12 + 1
    return y, m


def _iter_due_periods(member_since: tuple[int, int], as_of: tuple[int, int]) -> list[tuple[int, int]]:
    start = member_since if _compare_period(member_since, DUES_EFFECTIVE_FROM) > 0 else DUES_EFFECTIVE_FROM
    periods: list[tuple[int, int]] = []
    cur = start
    while _compare_period(cur, as_of) <= 0:
        periods.append(cur)
        cur = _add_months(cur[0], cur[1], 1)
    return periods


def compute_dues_summary(
    member_since: date | datetime,
    paid_periods: list[dict],
    as_of: datetime | None = None,
    monthly_amount: float | None = None,
) -> dict:
    if as_of is None:
        as_of = datetime.now(timezone.utc)

    monthly = float(monthly_amount if monthly_amount is not None else MONTHLY_DUES_AMOUNT)

    if isinstance(member_since, datetime):
        member_since = member_since.date()

    member_start = (member_since.year, member_since.month)
    current = (as_of.year, as_of.month)

    paid_map: dict[str, float] = {}
    for p in paid_periods:
        year = int(p["year"])
        month = int(p["month"])
        key = _period_key(year, month)
        paid_map[key] = paid_map.get(key, 0.0) + float(p["amount"])

    due_periods = _iter_due_periods(member_start, current)

    arrears_count = 0
    total_owed = 0.0
    total_paid_months = 0
    periods: list[dict] = []

    for year, month in due_periods:
        paid_amount = paid_map.get(_period_key(year, month), 0.0)
        is_paid = paid_amount >= monthly
        is_current = year == current[0] and month == current[1]
        is_future = _compare_period((year, month), current) > 0
        is_past = _compare_period((year, month), current) < 0

        if is_paid:
            status = "paid"
            total_paid_months += 1
        elif is_future:
            status = "upcoming"
        elif is_current:
            status = "due"
        else:
            status = "overdue"
            if is_past:
                arrears_count += 1
                total_owed += monthly - paid_amount

        periods.append(
            {
                "year": year,
                "month": month,
                "label": period_label(year, month),
                "amount": monthly,
                "status": status,
                "paid_amount": round(paid_amount, 2),
            }
        )

    current_period = next((p for p in periods if p["year"] == current[0] and p["month"] == current[1]), None)
    current_status = "due"
    if current_period:
        if current_period["status"] == "paid":
            current_status = "paid"
        elif current_period["status"] == "overdue":
            current_status = "overdue"

    return {
        "monthly_amount": monthly,
        "currency": DUES_CURRENCY,
        "current_month": {
            "year": current[0],
            "month": current[1],
            "label": period_label(current[0], current[1]),
        },
        "current_status": current_status,
        "arrears_count": arrears_count,
        "total_owed": round(total_owed, 2),
        "total_paid_months": total_paid_months,
        "periods": periods,
    }
