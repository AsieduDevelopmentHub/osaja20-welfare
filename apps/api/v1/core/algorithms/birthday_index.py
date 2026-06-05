"""Birthday index using day-bucket arrays for O(1) birthday lookups."""

from dataclasses import dataclass


@dataclass
class BirthdayMember:
    member_id: str
    full_name: str
    month: int
    day: int


class BirthdayIndex:
    def __init__(self) -> None:
        self._buckets: dict[int, list[BirthdayMember]] = {}

    @staticmethod
    def _day_key(month: int, day: int) -> int:
        return month * 100 + day

    def insert(self, member: BirthdayMember) -> None:
        key = self._day_key(member.month, member.day)
        bucket = self._buckets.setdefault(key, [])
        for i, existing in enumerate(bucket):
            if existing.member_id == member.member_id:
                bucket[i] = member
                return
        bucket.append(member)

    def remove(self, member_id: str, month: int, day: int) -> None:
        key = self._day_key(month, day)
        bucket = self._buckets.get(key)
        if not bucket:
            return
        filtered = [m for m in bucket if m.member_id != member_id]
        if filtered:
            self._buckets[key] = filtered
        else:
            del self._buckets[key]

    def get_birthdays_for_date(self, month: int, day: int) -> list[BirthdayMember]:
        return list(self._buckets.get(self._day_key(month, day), []))

    def get_birthdays_for_month(self, month: int) -> list[BirthdayMember]:
        results: list[BirthdayMember] = []
        for key, members in self._buckets.items():
            if key // 100 == month:
                results.extend(members)
        return sorted(results, key=lambda m: m.day)

    def get_upcoming(self, days: int, from_date=None) -> list[BirthdayMember]:
        from datetime import date, timedelta

        start = from_date or date.today()
        results: list[BirthdayMember] = []
        for i in range(days):
            current = start + timedelta(days=i)
            results.extend(self.get_birthdays_for_date(current.month, current.day))
        return results
