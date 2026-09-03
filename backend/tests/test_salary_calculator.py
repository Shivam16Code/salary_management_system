import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch

from app.models import CalculationMethod, ComponentType
from app.services.currency_service import CurrencyService, CurrencyServiceError
from app.services.salary_calculator import calculate_component_amount, calculate_salary_totals


def _make_component(component_type, method, amount=Decimal("1000"), code="COMP", **kwargs):
    comp = MagicMock()
    comp.amount = amount
    comp.units = kwargs.get("units")
    sc = MagicMock()
    sc.component_type = component_type
    sc.calculation_method = method
    sc.code = code
    comp.salary_component = sc
    return comp


class TestSalaryCalculator:
    def test_fixed_earning(self):
        comp = _make_component(ComponentType.EARNING, CalculationMethod.FIXED, Decimal("1500000"))
        assert calculate_component_amount(comp) == Decimal("1500000")

    def test_percentage_earning(self):
        basic = _make_component(
            ComponentType.EARNING, CalculationMethod.FIXED, Decimal("1000000"), code="BASIC"
        )
        hra = _make_component(
            ComponentType.EARNING, CalculationMethod.PERCENTAGE, Decimal("40"), code="HRA"
        )
        assert calculate_component_amount(hra, [basic, hra]) == Decimal("400000.00")

    def test_per_unit_earning(self):
        comp = _make_component(
            ComponentType.EARNING,
            CalculationMethod.PER_UNIT,
            Decimal("5000"),
            units=Decimal("10"),
        )
        assert calculate_component_amount(comp) == Decimal("50000.00")

    def test_calculate_salary_totals(self):
        components = [
            _make_component(ComponentType.EARNING, CalculationMethod.FIXED, Decimal("1000000")),
            _make_component(ComponentType.EARNING, CalculationMethod.FIXED, Decimal("200000")),
            _make_component(ComponentType.DEDUCTION, CalculationMethod.FIXED, Decimal("20000")),
        ]
        totals = calculate_salary_totals(components)
        assert totals["total_earnings"] == Decimal("1200000")
        assert totals["total_deductions"] == Decimal("20000")
        assert totals["adjusted_compensation"] == Decimal("1180000")

    def test_empty_components(self):
        totals = calculate_salary_totals([])
        assert totals["adjusted_compensation"] == Decimal("0.00")


class TestCurrencyService:
    def test_same_currency_returns_one(self):
        service = CurrencyService()
        assert service.get_rate("USD", "USD") == Decimal("1")

    def test_convert_same_currency(self):
        service = CurrencyService()
        result = service.convert(Decimal("100000"), "USD", "USD")
        assert result == Decimal("100000.00")

    @patch("app.services.currency_service.httpx.get")
    def test_fetch_rate_from_frankfurter(self, mock_get):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "date": "2026-09-01",
            "base": "INR",
            "quote": "USD",
            "rate": 0.01142,
        }
        mock_get.return_value = mock_response

        service = CurrencyService()
        rate = service.get_rate("INR", "USD")

        assert rate == Decimal("0.01142")
        mock_get.assert_called_once_with(
            "https://api.frankfurter.dev/v2/rate/INR/USD",
            timeout=10.0,
        )

    @patch("app.services.currency_service.httpx.get")
    def test_rate_is_cached(self, mock_get):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"rate": 1.27}
        mock_get.return_value = mock_response

        service = CurrencyService()
        service.get_rate("GBP", "USD")
        service.get_rate("GBP", "USD")

        mock_get.assert_called_once()

    @patch("app.services.currency_service.httpx.get")
    def test_fetch_rate_api_failure_raises(self, mock_get):
        import httpx

        mock_get.side_effect = httpx.ConnectError("connection failed")

        service = CurrencyService()
        with pytest.raises(CurrencyServiceError, match="Failed to fetch exchange rate"):
            service.get_rate("EUR", "USD")
