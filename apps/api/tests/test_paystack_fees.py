"""Paystack fee gross-up tests."""

from v1.core.config import settings
from v1.core.paystack_fees import paystack_charge_for_dues


def test_charge_includes_fee_for_single_month(monkeypatch):
    monkeypatch.setattr(settings, "paystack_pass_fees_to_customer", True)
    monkeypatch.setattr(settings, "paystack_fee_percent", 1.95)
    monkeypatch.setattr(settings, "paystack_fee_cap_ghs", None)

    charge, fee = paystack_charge_for_dues(30.0)
    assert charge > 30.0
    assert fee == round(charge - 30.0, 2)
    # Paystack formula: (30 / 0.9805) + 0.01
    assert charge == 30.61


def test_charge_scales_with_multiple_months(monkeypatch):
    monkeypatch.setattr(settings, "paystack_pass_fees_to_customer", True)
    monkeypatch.setattr(settings, "paystack_fee_percent", 1.95)
    monkeypatch.setattr(settings, "paystack_fee_cap_ghs", None)

    charge, fee = paystack_charge_for_dues(90.0)
    assert charge > 90.0
    assert round(charge - fee, 2) == 90.0


def test_no_markup_when_fees_absorbed(monkeypatch):
    monkeypatch.setattr(settings, "paystack_pass_fees_to_customer", False)

    charge, fee = paystack_charge_for_dues(40.0)
    assert charge == 40.0
    assert fee == 0.0
