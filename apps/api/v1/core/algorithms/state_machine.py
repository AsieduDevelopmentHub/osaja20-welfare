"""Finite state machine for welfare case workflow."""

WELFARE_TRANSITIONS: dict[str, list[str]] = {
    "created": ["executive_review", "archived"],
    "executive_review": ["approved", "created", "archived"],
    "approved": ["support_allocated", "executive_review"],
    "support_allocated": ["resolved", "approved"],
    "resolved": ["archived"],
    "archived": [],
}


class WelfareStateMachine:
    def __init__(self, transitions: dict[str, list[str]] | None = None) -> None:
        self._transitions = transitions or WELFARE_TRANSITIONS

    def can_transition(self, from_status: str, to_status: str) -> bool:
        return to_status in self._transitions.get(from_status, [])

    def transition(self, current: str, target: str) -> tuple[bool, str | None, str | None]:
        if current == target:
            return True, current, None
        if not self.can_transition(current, target):
            return False, None, f"Invalid transition from '{current}' to '{target}'"
        return True, target, None

    def get_available_transitions(self, status: str) -> list[str]:
        return list(self._transitions.get(status, []))

    def is_terminal(self, status: str) -> bool:
        return len(self._transitions.get(status, [])) == 0
