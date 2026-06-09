"""Default member notification & UI preferences."""

DEFAULT_MEMBER_PREFERENCES: dict[str, bool] = {
    "notify_dues": True,
    "notify_votes": True,
    "notify_birthdays": True,
    "notify_announcements": True,
    "notify_welfare": True,
    "notify_celebrations": True,
    "notify_support": True,
    "notify_payments": True,
    "email_digest": False,
    "compact_dashboard": False,
}

PREFERENCE_KEYS = frozenset(DEFAULT_MEMBER_PREFERENCES.keys())


def merge_preferences(stored: dict | None) -> dict[str, bool]:
    merged = dict(DEFAULT_MEMBER_PREFERENCES)
    if stored:
        for key in PREFERENCE_KEYS:
            if key in stored:
                merged[key] = bool(stored[key])
    return merged
