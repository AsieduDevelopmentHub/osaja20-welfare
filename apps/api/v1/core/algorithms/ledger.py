"""Append-only contribution ledger with running balance validation."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

LedgerEntryType = Literal["credit", "debit"]


@dataclass
class LedgerEntry:
    id: str
    member_id: str
    amount: float
    type: LedgerEntryType
    reference: str
    created_at: datetime
    created_by: str
    verified_by: str | None = None


class ContributionLedger:
    def __init__(self) -> None:
        self._entries: list[LedgerEntry] = []
        self._balances: dict[str, float] = {}
        self._member_entries: dict[str, list[LedgerEntry]] = {}

    @staticmethod
    def _round(amount: float) -> float:
        return round(amount, 2)

    def get_balance(self, member_id: str) -> float:
        return self._balances.get(member_id, 0.0)

    def get_entries(self, member_id: str) -> list[LedgerEntry]:
        return list(self._member_entries.get(member_id, []))

    def append(self, entry: LedgerEntry) -> tuple[bool, str | None]:
        if entry.amount <= 0:
            return False, "Amount must be positive"

        signed = entry.amount if entry.type == "credit" else -entry.amount
        new_balance = self._round(self.get_balance(entry.member_id) + signed)

        if entry.type == "debit" and new_balance < 0:
            return False, "Insufficient balance"

        self._entries.append(entry)
        self._balances[entry.member_id] = new_balance
        self._member_entries.setdefault(entry.member_id, []).append(entry)
        return True, None

    def reconcile(self, member_id: str) -> dict:
        entries = self._member_entries.get(member_id, [])
        computed = self._round(
            sum(e.amount if e.type == "credit" else -e.amount for e in entries)
        )
        stored = self.get_balance(member_id)
        return {"valid": computed == stored, "computed": computed, "stored": stored}

    def get_total_contributions(self) -> float:
        return self._round(sum(max(0, b) for b in self._balances.values()))
