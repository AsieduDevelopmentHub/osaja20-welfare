from datetime import datetime, timedelta

from v1.core.algorithms import (
    BirthdayIndex,
    BirthdayMember,
    ContributionLedger,
    LedgerEntry,
    MemberSearchTrie,
    VoteContext,
    VoteEngine,
    WelfareStateMachine,
)


def test_trie_search():
    trie = MemberSearchTrie()
    trie.insert("m1", "Kwame Asante", "kwame@email.com", "OSA-001")
    trie.insert("m2", "Ama Mensah", "ama@email.com", "OSA-002")

    assert "m1" in trie.search("kwa")
    assert "m2" in trie.search("ama")
    assert trie.search("zzz") == []


def test_vote_engine_duplicate_protection():
    engine = VoteEngine()
    member = {"id": "m1", "status": "active", "email_verified": True}
    now = datetime.utcnow()
    context = VoteContext(
        vote_id="v1",
        vote_type="election",
        status="open",
        opens_at=now - timedelta(hours=1),
        closes_at=now + timedelta(hours=1),
        valid_option_ids={"opt1", "opt2"},
    )

    assert engine.validate_submission(member, context, "opt1") is None
    assert engine.submit_vote("v1", "m1", "opt1") is True
    assert engine.validate_submission(member, context, "opt2") == "duplicate_vote"


def test_ledger_balance():
    ledger = ContributionLedger()
    entry = LedgerEntry(
        id="e1",
        member_id="m1",
        amount=100.0,
        type="credit",
        reference="REF-001",
        created_at=datetime.utcnow(),
        created_by="admin",
    )
    ok, _ = ledger.append(entry)
    assert ok
    assert ledger.get_balance("m1") == 100.0
    assert ledger.reconcile("m1")["valid"] is True


def test_welfare_state_machine():
    fsm = WelfareStateMachine()
    assert fsm.can_transition("created", "executive_review")
    assert not fsm.can_transition("created", "resolved")
    success, status, _ = fsm.transition("created", "executive_review")
    assert success and status == "executive_review"


def test_birthday_index():
    index = BirthdayIndex()
    index.insert(BirthdayMember("m1", "Kwame", 6, 5))
    assert len(index.get_birthdays_for_date(6, 5)) == 1
    assert len(index.get_birthdays_for_month(6)) == 1
