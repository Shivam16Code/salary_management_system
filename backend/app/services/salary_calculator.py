from decimal import Decimal

from app.models import CalculationMethod, ComponentType, SalaryRecordComponent


def _find_basic_amount(components: list[SalaryRecordComponent]) -> Decimal:
    for comp in components:
        if comp.salary_component.code == "BASIC":
            return Decimal(comp.amount)
    return Decimal("0")


def calculate_component_amount(
    component: SalaryRecordComponent,
    all_components: list[SalaryRecordComponent] | None = None,
) -> Decimal:
    """Calculate the effective amount for a salary record component."""
    sc = component.salary_component
    method = sc.calculation_method
    siblings = all_components or [component]

    if method == CalculationMethod.FIXED:
        return Decimal(component.amount)

    if method == CalculationMethod.PERCENTAGE:
        base = _find_basic_amount(siblings)
        return (base * Decimal(component.amount) / Decimal("100")).quantize(Decimal("0.01"))

    if method == CalculationMethod.PER_UNIT:
        units = component.units or Decimal("0")
        rate = Decimal(component.amount)
        return (units * rate).quantize(Decimal("0.01"))

    return Decimal("0")


def calculate_salary_totals(components: list[SalaryRecordComponent]) -> dict[str, Decimal]:
    """Calculate total earnings, deductions, and adjusted compensation."""
    total_earnings = Decimal("0")
    total_deductions = Decimal("0")

    for comp in components:
        amount = calculate_component_amount(comp, components)
        if comp.salary_component.component_type == ComponentType.EARNING:
            total_earnings += amount
        else:
            total_deductions += amount

    adjusted = total_earnings - total_deductions
    return {
        "total_earnings": total_earnings.quantize(Decimal("0.01")),
        "total_deductions": total_deductions.quantize(Decimal("0.01")),
        "adjusted_compensation": adjusted.quantize(Decimal("0.01")),
    }
