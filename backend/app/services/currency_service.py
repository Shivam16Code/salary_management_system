from decimal import Decimal

import httpx

from app.config import settings


class CurrencyServiceError(Exception):
    """Raised when exchange rate lookup fails."""


class CurrencyService:
    """Fetches live exchange rates from the Frankfurter API with in-memory caching."""

    def __init__(self, base_url: str | None = None):
        self._base_url = (base_url or settings.frankfurter_api_url).rstrip("/")
        self._rate_cache: dict[tuple[str, str], Decimal] = {}

    def get_rate(self, from_code: str, to_code: str) -> Decimal:
        """Get exchange rate between two currencies via Frankfurter. Returns 1.0 for same currency."""
        from_code = from_code.upper()
        to_code = to_code.upper()

        if from_code == to_code:
            return Decimal("1")

        cache_key = (from_code, to_code)
        if cache_key in self._rate_cache:
            return self._rate_cache[cache_key]

        rate = self._fetch_rate(from_code, to_code)
        self._rate_cache[cache_key] = rate
        return rate

    def _fetch_rate(self, from_code: str, to_code: str) -> Decimal:
        url = f"{self._base_url}/rate/{from_code}/{to_code}"
        try:
            response = httpx.get(url, timeout=settings.frankfurter_timeout_seconds)
            response.raise_for_status()
            data = response.json()
            return Decimal(str(data["rate"]))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 422:
                raise CurrencyServiceError(
                    f"Unsupported currency pair: {from_code}/{to_code}"
                ) from exc
            raise CurrencyServiceError(
                f"Frankfurter API error for {from_code}/{to_code}: {exc.response.status_code}"
            ) from exc
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise CurrencyServiceError(
                f"Failed to fetch exchange rate for {from_code}/{to_code}"
            ) from exc

    def convert(self, amount: Decimal, from_code: str, to_code: str) -> Decimal:
        rate = self.get_rate(from_code, to_code)
        return (amount * rate).quantize(Decimal("0.01"))

    def get_rate_detail(self, base: str, target: str) -> dict:
        base = base.upper()
        target = target.upper()
        if base == target:
            from datetime import date

            return {"base": base, "quote": target, "rate": Decimal("1"), "date": date.today()}

        url = f"{self._base_url}/rate/{base}/{target}"
        try:
            response = httpx.get(url, timeout=settings.frankfurter_timeout_seconds)
            response.raise_for_status()
            data = response.json()
            return {
                "base": data["base"],
                "quote": data["quote"],
                "rate": Decimal(str(data["rate"])),
                "date": data.get("date"),
            }
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 422:
                raise CurrencyServiceError(f"Unsupported currency pair: {base}/{target}") from exc
            raise CurrencyServiceError(
                f"Frankfurter API error for {base}/{target}: {exc.response.status_code}"
            ) from exc
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise CurrencyServiceError(f"Failed to fetch exchange rate for {base}/{target}") from exc

    def get_all_rates(self, base: str = "USD", quotes: list[str] | None = None) -> dict:
        base = base.upper()
        params: dict[str, str] = {"base": base}
        if quotes:
            params["quotes"] = ",".join(q.upper() for q in quotes)

        url = f"{self._base_url}/rates"
        try:
            response = httpx.get(url, params=params, timeout=settings.frankfurter_timeout_seconds)
            response.raise_for_status()
            data = response.json()
            items = data if isinstance(data, list) else data.get("rates", [])
            rates = []
            effective_date = None
            for item in items:
                quote = item.get("quote") or item.get("currency")
                rate_val = item.get("rate")
                if quote and rate_val is not None:
                    rates.append({"base": base, "quote": quote, "rate": Decimal(str(rate_val))})
                    effective_date = effective_date or item.get("date")
            return {"base": base, "date": effective_date, "rates": rates}
        except httpx.HTTPError as exc:
            raise CurrencyServiceError(f"Failed to fetch exchange rates for base {base}") from exc

    def clear_cache(self) -> None:
        self._rate_cache.clear()

    def fetch_reference_currencies(self) -> list[dict]:
        """Fetch available currencies from Frankfurter (code, name, symbol)."""
        url = f"{self._base_url}/currencies"
        try:
            response = httpx.get(url, timeout=settings.frankfurter_timeout_seconds)
            response.raise_for_status()
            items = response.json()
        except httpx.HTTPError as exc:
            raise CurrencyServiceError("Failed to fetch currency reference data") from exc

        from app.services.reference_data import infer_decimal_places

        results = []
        for item in items:
            code = item.get("iso_code") or item.get("code")
            name = item.get("name")
            symbol = item.get("symbol") or code
            if not code or not name:
                continue
            results.append(
                {
                    "code": code.upper(),
                    "name": name,
                    "symbol": symbol,
                    "decimal_places": infer_decimal_places(code),
                }
            )
        return sorted(results, key=lambda c: c["code"])
