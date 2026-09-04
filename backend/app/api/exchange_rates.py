from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Currency
from app.schemas.schemas import ExchangeRatePairResponse, ExchangeRatesListResponse
from app.services.currency_service import CurrencyService

router = APIRouter(prefix="/exchange-rates", tags=["exchange-rates"])


@router.get("", response_model=ExchangeRatesListResponse)
def list_exchange_rates(
    base: str = Query(default="USD"),
    db: Session = Depends(get_db),
):
    service = CurrencyService()
    currency_codes = [c.code for c in db.query(Currency).order_by(Currency.code).all()]
    quotes = [c for c in currency_codes if c != base.upper()]
    result = service.get_all_rates(base=base, quotes=quotes)
    effective_date = result.get("date")
    if isinstance(effective_date, str):
        effective_date = date.fromisoformat(effective_date)

    return ExchangeRatesListResponse(
        base=result["base"],
        effective_date=effective_date,
        rates=[
            ExchangeRatePairResponse(
                base=r["base"],
                quote=r["quote"],
                rate=r["rate"],
                effective_date=effective_date,
            )
            for r in result["rates"]
        ],
    )


@router.get("/{base}/{target}", response_model=ExchangeRatePairResponse)
def get_exchange_rate(base: str, target: str):
    service = CurrencyService()
    result = service.get_rate_detail(base, target)
    effective_date = result.get("date")
    if isinstance(effective_date, str):
        effective_date = date.fromisoformat(effective_date)
    return ExchangeRatePairResponse(
        base=result["base"],
        quote=result["quote"],
        rate=result["rate"],
        effective_date=effective_date,
    )
