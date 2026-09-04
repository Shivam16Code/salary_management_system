from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import (
    AnalyticsBreakdownItem,
    AnalyticsDistributionResponse,
    AnalyticsFilteredResponse,
    AnalyticsResponse,
    AnalyticsSummary,
    AnalyticsTrendResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _date_filters(
    as_of_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> date:
    """Resolve snapshot date: as_of_date, or date_to from range, or today."""
    if as_of_date:
        return as_of_date
    if date_to:
        return date_to
    return date.today()


def _scope_filters(
    country_ids: list[int] | None = None,
    department_ids: list[int] | None = None,
    job_level_ids: list[int] | None = None,
    payment_statuses: list[str] | None = None,
    employment_statuses: list[str] | None = None,
    record_statuses: list[str] | None = None,
    currency_ids: list[int] | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
) -> dict:
    return {
        "country_ids": country_ids or None,
        "department_ids": department_ids or None,
        "job_level_ids": job_level_ids or None,
        "payment_statuses": payment_statuses or None,
        "employment_statuses": employment_statuses or None,
        "record_statuses": record_statuses or None,
        "currency_ids": currency_ids or None,
        "salary_min": Decimal(str(salary_min)) if salary_min is not None else None,
        "salary_max": Decimal(str(salary_max)) if salary_max is not None else None,
    }


def _range_or_snapshot_kwargs(
    as_of_date: date | None,
    date_from: date | None,
    date_to: date | None,
) -> dict:
    if date_from and date_to:
        return {"date_from": date_from, "date_to": date_to}
    return {"as_of_date": _date_filters(as_of_date, date_from, date_to)}


@router.get("/filtered", response_model=AnalyticsFilteredResponse)
def get_analytics_filtered(
    reporting_currency: str = Query(default="USD"),
    as_of_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    db: Session = Depends(get_db),
):
    """All analytics for the exact filter combination in one response."""
    service = AnalyticsService(db)
    scope = _scope_filters(
        country_ids,
        department_ids,
        job_level_ids,
        payment_statuses,
        employment_statuses,
        record_statuses,
        currency_ids,
        salary_min,
        salary_max,
    )
    if date_from and date_to:
        return service.get_filtered(
            reporting_currency,
            date_from=date_from,
            date_to=date_to,
            **scope,
        )
    return service.get_filtered(
        reporting_currency,
        as_of_date=_date_filters(as_of_date, date_from, date_to),
        **scope,
    )


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(
    reporting_currency: str = Query(default="USD"),
    as_of_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    db: Session = Depends(get_db),
):
    service = AnalyticsService(db)
    scope = _scope_filters(
        country_ids,
        department_ids,
        job_level_ids,
        payment_statuses,
        employment_statuses,
        record_statuses,
        currency_ids,
        salary_min,
        salary_max,
    )
    if date_from and date_to:
        return service.get_summary(
            reporting_currency,
            date_from=date_from,
            date_to=date_to,
            **scope,
        )
    snapshot = _date_filters(as_of_date, date_from, date_to)
    return service.get_summary(
        reporting_currency,
        as_of_date=snapshot,
        **scope,
    )


@router.get("/by-country", response_model=list[AnalyticsBreakdownItem])
def get_analytics_by_country(
    reporting_currency: str = Query(default="USD"),
    as_of_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    db: Session = Depends(get_db),
):
    service = AnalyticsService(db)
    return service.get_by_country(
        reporting_currency,
        **_range_or_snapshot_kwargs(as_of_date, date_from, date_to),
        **_scope_filters(
            country_ids,
            department_ids,
            job_level_ids,
            payment_statuses,
            employment_statuses,
            record_statuses,
            currency_ids,
            salary_min,
            salary_max,
        ),
    )


@router.get("/by-department", response_model=list[AnalyticsBreakdownItem])
def get_analytics_by_department(
    reporting_currency: str = Query(default="USD"),
    as_of_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    db: Session = Depends(get_db),
):
    service = AnalyticsService(db)
    return service.get_by_department(
        reporting_currency,
        **_range_or_snapshot_kwargs(as_of_date, date_from, date_to),
        **_scope_filters(
            country_ids,
            department_ids,
            job_level_ids,
            payment_statuses,
            employment_statuses,
            record_statuses,
            currency_ids,
            salary_min,
            salary_max,
        ),
    )


@router.get("/by-level", response_model=list[AnalyticsBreakdownItem])
def get_analytics_by_level(
    reporting_currency: str = Query(default="USD"),
    as_of_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    db: Session = Depends(get_db),
):
    service = AnalyticsService(db)
    return service.get_by_level(
        reporting_currency,
        **_range_or_snapshot_kwargs(as_of_date, date_from, date_to),
        **_scope_filters(
            country_ids,
            department_ids,
            job_level_ids,
            payment_statuses,
            employment_statuses,
            record_statuses,
            currency_ids,
            salary_min,
            salary_max,
        ),
    )


@router.get("/distribution", response_model=AnalyticsDistributionResponse)
def get_analytics_distribution(
    reporting_currency: str = Query(default="USD"),
    as_of_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    db: Session = Depends(get_db),
):
    service = AnalyticsService(db)
    return service.get_distribution(
        reporting_currency,
        **_range_or_snapshot_kwargs(as_of_date, date_from, date_to),
        **_scope_filters(
            country_ids,
            department_ids,
            job_level_ids,
            payment_statuses,
            employment_statuses,
            record_statuses,
            currency_ids,
            salary_min,
            salary_max,
        ),
    )


@router.get("/trend", response_model=AnalyticsTrendResponse)
def get_analytics_trend(
    reporting_currency: str = Query(default="USD"),
    date_from: date = Query(...),
    date_to: date = Query(...),
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    db: Session = Depends(get_db),
):
    service = AnalyticsService(db)
    return service.get_trend(
        reporting_currency,
        date_from,
        date_to,
        **_scope_filters(
            country_ids,
            department_ids,
            job_level_ids,
            payment_statuses,
            employment_statuses,
            record_statuses,
            currency_ids,
            salary_min,
            salary_max,
        ),
    )


@router.get("", response_model=AnalyticsResponse, include_in_schema=False)
def get_analytics_legacy(
    reporting_currency: str = Query(default="USD"),
    as_of_date: date | None = None,
    country_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    db: Session = Depends(get_db),
):
    service = AnalyticsService(db)
    return service.get_analytics(
        reporting_currency,
        as_of_date,
        **_scope_filters(
            country_ids,
            department_ids,
            job_level_ids,
            payment_statuses,
            employment_statuses,
            record_statuses,
            currency_ids,
        ),
    )
