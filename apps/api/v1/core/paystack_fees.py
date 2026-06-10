"""Paystack fee gross-up — pass processing fees to the member at checkout.

Uses Paystack's mark-up formula (percentage-only, Ghana GHS):
https://support.paystack.com/en/articles/2130306
"""

from __future__ import annotations

from v1.core.config import settings


def paystack_charge_for_dues(dues_amount: float) -> tuple[float, float]:
    """Return (charge_amount, processing_fee) in GHS.

    `dues_amount` is what the welfare fund should receive (e.g. 30 × months).
    `charge_amount` is what Paystack checkout should collect from the member.
    """
    price = round(float(dues_amount), 2)
    if price <= 0:
        return 0.0, 0.0

    if not settings.paystack_pass_fees_to_customer:
        return price, 0.0

    decimal_fee = settings.paystack_fee_percent / 100.0
    applicable_fees = decimal_fee * price
    fee_cap = settings.paystack_fee_cap_ghs

    if fee_cap is not None and applicable_fees > fee_cap:
        charge = price + fee_cap
    else:
        charge = (price / (1 - decimal_fee)) + 0.01

    charge = round(charge, 2)
    processing_fee = round(charge - price, 2)
    return charge, processing_fee
