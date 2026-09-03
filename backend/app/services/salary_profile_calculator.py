from decimal import Decimal, ROUND_HALF_UP

from app.models.enums import PayFrequency

_TWOPLACES = Decimal("0.01")


def annual_package_from(package_amount: Decimal, frequency: PayFrequency) -> Decimal:
    amount = Decimal(package_amount)
    if frequency == PayFrequency.YEARLY:
        annual = amount
    elif frequency == PayFrequency.MONTHLY:
        annual = amount * Decimal("12")
    elif frequency == PayFrequency.QUARTERLY:
        annual = amount * Decimal("4")
    elif frequency == PayFrequency.WEEKLY:
        annual = amount * Decimal("52")
    else:
        annual = amount
    return annual.quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def monthly_base_from(package_amount: Decimal, frequency: PayFrequency) -> Decimal:
    """Monthly basic salary used for payroll records and percentage components."""
    annual = annual_package_from(package_amount, frequency)
    return (annual / Decimal("12")).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def per_period_amount_from_annual(annual_package: Decimal, frequency: PayFrequency) -> Decimal:
    annual = Decimal(annual_package)
    if frequency == PayFrequency.YEARLY:
        return annual.quantize(_TWOPLACES, rounding=ROUND_HALF_UP)
    if frequency == PayFrequency.MONTHLY:
        return (annual / Decimal("12")).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)
    if frequency == PayFrequency.QUARTERLY:
        return (annual / Decimal("4")).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)
    if frequency == PayFrequency.WEEKLY:
        return (annual / Decimal("52")).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)
    return annual.quantize(_TWOPLACES, rounding=ROUND_HALF_UP)
