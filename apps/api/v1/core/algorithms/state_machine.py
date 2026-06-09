"""Finite state machine for welfare case workflow."""

# Simplified: pending → approved → allocated → resolved
WELFARE_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["approved"],
    "approved": ["allocated", "archived"],
    "allocated": ["resolved", "archived"],
    "resolved": ["archived"],
    "archived": [],
    # Legacy statuses (existing rows) — same forward paths after normalization
    "created": ["approved"],
    "executive_review": ["approved"],
    "support_allocated": ["resolved", "archived"],
}

WELFARE_STATUS_ALIASES: dict[str, str] = {
    "created": "pending",
    "executive_review": "pending",
    "support_allocated": "allocated",
}


def normalize_welfare_status(status: str) -> str:
    return WELFARE_STATUS_ALIASES.get(status, status)


class WelfareStateMachine:
    def __init__(self, transitions: dict[str, list[str]] | None = None) -> None:
        self._transitions = transitions or WELFARE_TRANSITIONS

    def can_transition(self, from_status: str, to_status: str) -> bool:
        return to_status in self._transitions.get(from_status, [])

    def transition(self, current: str, target: str) -> tuple[bool, str | None, str | None]:
        current = normalize_welfare_status(current)
        target = normalize_welfare_status(target)
        if current == target:
            return True, current, None
        if not self.can_transition(current, target):
            return False, None, f"Invalid transition from '{current}' to '{target}'"
        return True, target, None

    def get_available_transitions(self, status: str) -> list[str]:
        status = normalize_welfare_status(status)
        return list(self._transitions.get(status, []))

    def is_terminal(self, status: str) -> bool:
        return len(self._transitions.get(status, [])) == 0
