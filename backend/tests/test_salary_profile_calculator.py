from decimal import Decimal

from app.models.enums import PayFrequency
from app.services.salary_profile_calculator import (
    annual_package_from,
    monthly_base_from,
    per_period_amount_from_annual,
)


class TestSalaryProfileCalculator:
    def test_monthly_package(self):
        assert annual_package_from(Decimal("100000"), PayFrequency.MONTHLY) == Decimal("1200000.00")
        assert monthly_base_from(Decimal("100000"), PayFrequency.MONTHLY) == Decimal("100000.00")

    def test_yearly_package(self):
        assert annual_package_from(Decimal("1200000"), PayFrequency.YEARLY) == Decimal("1200000.00")
        assert monthly_base_from(Decimal("1200000"), PayFrequency.YEARLY) == Decimal("100000.00")

    def test_quarterly_package(self):
        assert annual_package_from(Decimal("300000"), PayFrequency.QUARTERLY) == Decimal("1200000.00")
        assert monthly_base_from(Decimal("300000"), PayFrequency.QUARTERLY) == Decimal("100000.00")

    def test_weekly_package(self):
        annual = annual_package_from(Decimal("5000"), PayFrequency.WEEKLY)
        assert annual == Decimal("260000.00")
        assert monthly_base_from(Decimal("5000"), PayFrequency.WEEKLY) == Decimal("21666.67")

    def test_per_period_roundtrip(self):
        annual = Decimal("1200000")
        assert per_period_amount_from_annual(annual, PayFrequency.MONTHLY) == Decimal("100000.00")
        assert per_period_amount_from_annual(annual, PayFrequency.QUARTERLY) == Decimal("300000.00")
