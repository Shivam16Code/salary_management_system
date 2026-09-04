import statistics
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import exists, func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Country,
    Employee,
    EmploymentStatus,
    PaymentStatus,
    SalaryRecord,
    SalaryRecordComponent,
    SalaryStatus,
)
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.schemas import (
    AnalyticsBreakdownItem,
    AnalyticsDistributionResponse,
    AnalyticsResponse,
    AnalyticsSummary,
    AnalyticsTrendPoint,
    AnalyticsTrendResponse,
    DistributionBucket,
)
from app.repositories.salary_repository import SalaryRepository
from app.schemas.schemas import AnalyticsPaymentSummary, SalaryRecordFilterParams
from app.services.currency_service import CurrencyService
from app.services.salary_calculator import calculate_salary_totals


class AnalyticsService:
    MAX_TREND_POINTS = 31

    def __init__(self, db: Session):
        self.db = db
        self.currency_service = CurrencyService()
        self.employee_repo = EmployeeRepository(db)

    def _resolve_as_of_date(self, as_of_date: date | None) -> date:
        return as_of_date or date.today()

    @staticmethod
    def _record_period_end(record: SalaryRecord) -> date:
        return record.effective_to if record.effective_to is not None else record.effective_from

    @staticmethod
    def _record_overlaps(record: SalaryRecord, date_from: date, date_to: date) -> bool:
        """Record is active on at least one day in [date_from, date_to] (snapshot use)."""
        period_end = AnalyticsService._record_period_end(record)
        return record.effective_from <= date_to and period_end >= date_from

    @staticmethod
    def _record_starts_in_range(record: SalaryRecord, date_from: date, date_to: date) -> bool:
        """Pay period start falls inside the selected filter range."""
        return date_from <= record.effective_from <= date_to

    def _get_salary_record_overlapping(
        self,
        emp: Employee,
        date_from: date,
        date_to: date,
        payment_statuses: list[PaymentStatus] | None,
        record_statuses: list[SalaryStatus] | None,
    ) -> SalaryRecord | None:
        applicable = [
            r
            for r in emp.salary_records
            if self._record_overlaps(r, date_from, date_to) and r.components
        ]
        if record_statuses:
            applicable = [r for r in applicable if r.status in record_statuses]
        if payment_statuses:
            applicable = [r for r in applicable if r.payment_status in payment_statuses]
        if not applicable:
            return None
        return max(applicable, key=lambda r: r.effective_from)

    @staticmethod
    def _parse_payment_statuses(payment_statuses: list[str] | None) -> list[PaymentStatus] | None:
        if not payment_statuses:
            return None
        return [PaymentStatus(s) for s in payment_statuses]

    @staticmethod
    def _parse_record_statuses(record_statuses: list[str] | None) -> list[SalaryStatus] | None:
        if not record_statuses:
            return None
        return [SalaryStatus(s) for s in record_statuses]

    def _compensation_from_record(
        self, record: SalaryRecord, reporting_currency: str
    ) -> Decimal:
        totals = calculate_salary_totals(record.components)
        return self.currency_service.convert(
            totals["adjusted_compensation"], record.currency.code, reporting_currency
        )

    def _employee_compensation_on_date(
        self,
        emp: Employee,
        as_of: date,
        reporting_currency: str,
        payment_statuses: list[PaymentStatus] | None,
        record_statuses: list[SalaryStatus] | None,
    ) -> Decimal | None:
        record = self._get_salary_record_overlapping(
            emp, as_of, as_of, payment_statuses, record_statuses
        )
        if not record:
            return None
        return self._compensation_from_record(record, reporting_currency)

    def _fetch_best_overlapping_records(
        self,
        period_from: date,
        period_to: date,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[PaymentStatus] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[SalaryStatus] | None = None,
        currency_ids: list[int] | None = None,
        *,
        start_in_range: bool = False,
    ) -> list[SalaryRecord]:
        """One best-matching salary record per employee for the period (SQL window query).

        start_in_range=False (snapshot): record must overlap the day/period.
        start_in_range=True (date-range reports): period start must fall in [from, to].
        """
        period_end = func.coalesce(SalaryRecord.effective_to, SalaryRecord.effective_from)
        has_components = exists().where(
            SalaryRecordComponent.salary_record_id == SalaryRecord.id
        )

        ranked_ids = (
            self.db.query(
                SalaryRecord.id.label("record_id"),
                func.row_number()
                .over(
                    partition_by=SalaryRecord.employee_id,
                    order_by=SalaryRecord.effective_from.desc(),
                )
                .label("rn"),
            )
            .join(Employee, SalaryRecord.employee_id == Employee.id)
            .join(Country, Employee.country_id == Country.id)
            .filter(Employee.hire_date <= period_to)
            .filter(has_components)
        )
        if start_in_range:
            ranked_ids = ranked_ids.filter(
                SalaryRecord.effective_from >= period_from,
                SalaryRecord.effective_from <= period_to,
            )
        else:
            ranked_ids = ranked_ids.filter(
                SalaryRecord.effective_from <= period_to,
                period_end >= period_from,
            )

        today = date.today()
        if employment_statuses:
            statuses = [EmploymentStatus(s) for s in employment_statuses]
            ranked_ids = ranked_ids.filter(Employee.employment_status.in_(statuses))
        elif period_to >= today:
            ranked_ids = ranked_ids.filter(Employee.employment_status == EmploymentStatus.ACTIVE)
        if country_ids:
            ranked_ids = ranked_ids.filter(Employee.country_id.in_(country_ids))
        if department_ids:
            ranked_ids = ranked_ids.filter(Employee.department_id.in_(department_ids))
        if job_level_ids:
            ranked_ids = ranked_ids.filter(Employee.job_level_id.in_(job_level_ids))
        if currency_ids:
            ranked_ids = ranked_ids.filter(Country.currency_id.in_(currency_ids))
        if payment_statuses:
            ranked_ids = ranked_ids.filter(SalaryRecord.payment_status.in_(payment_statuses))
        if record_statuses:
            ranked_ids = ranked_ids.filter(SalaryRecord.status.in_(record_statuses))

        ranked_subq = ranked_ids.subquery()
        return (
            self.db.query(SalaryRecord)
            .join(ranked_subq, SalaryRecord.id == ranked_subq.c.record_id)
            .filter(ranked_subq.c.rn == 1)
            .options(
                joinedload(SalaryRecord.currency),
                selectinload(SalaryRecord.components).joinedload(
                    SalaryRecordComponent.salary_component
                ),
                joinedload(SalaryRecord.employee).joinedload(Employee.country),
                joinedload(SalaryRecord.employee).joinedload(Employee.department),
                joinedload(SalaryRecord.employee).joinedload(Employee.job_level),
            )
            .all()
        )

    def _records_to_compensation_data(
        self,
        records: list[SalaryRecord],
        reporting_currency: str,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> list[dict]:
        results: list[dict] = []
        for record in records:
            converted = self._compensation_from_record(record, reporting_currency)
            if salary_min is not None and converted < salary_min:
                continue
            if salary_max is not None and converted > salary_max:
                continue
            emp = record.employee
            results.append(
                {
                    "employee_id": emp.id,
                    "compensation": converted,
                    "country_code": emp.country.iso_code,
                    "country_name": emp.country.name,
                    "department_code": emp.department.code,
                    "department_name": emp.department.name,
                    "job_level_code": emp.job_level.code,
                    "job_level_name": emp.job_level.name,
                }
            )
        return results

    def _get_employee_compensations(
        self,
        reporting_currency: str,
        as_of_date: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> list[dict]:
        as_of = self._resolve_as_of_date(as_of_date)
        records = self._fetch_best_overlapping_records(
            as_of,
            as_of,
            country_ids,
            department_ids,
            job_level_ids,
            self._parse_payment_statuses(payment_statuses),
            employment_statuses,
            self._parse_record_statuses(record_statuses),
            currency_ids,
        )
        return self._records_to_compensation_data(
            records, reporting_currency, salary_min, salary_max
        )

    def _get_employee_compensations_for_range(
        self,
        reporting_currency: str,
        date_from: date,
        date_to: date,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> list[dict]:
        records = self._fetch_best_overlapping_records(
            date_from,
            date_to,
            country_ids,
            department_ids,
            job_level_ids,
            self._parse_payment_statuses(payment_statuses),
            employment_statuses,
            self._parse_record_statuses(record_statuses),
            currency_ids,
            start_in_range=True,
        )
        return self._records_to_compensation_data(
            records, reporting_currency, salary_min, salary_max
        )

    @staticmethod
    def _downsample_periods(periods: list[date], max_points: int) -> list[date]:
        if len(periods) <= max_points:
            return periods
        step = max(1, (len(periods) - 1) // (max_points - 1))
        sampled = periods[::step]
        if sampled[-1] != periods[-1]:
            sampled.append(periods[-1])
        return sampled[:max_points]

    def _trend_period_dates(self, date_from: date, date_to: date) -> list[date]:
        """Daily for short ranges, weekly/monthly for longer — capped at MAX_TREND_POINTS."""
        span_days = (date_to - date_from).days + 1
        if span_days <= 14:
            periods = [date_from + timedelta(days=i) for i in range(span_days)]
        elif span_days <= 90:
            periods = []
            current = date_from
            while current <= date_to:
                periods.append(current)
                current += timedelta(days=7)
            if periods[-1] != date_to:
                periods.append(date_to)
        else:
            periods = self._monthly_period_dates(date_from, date_to)
        return self._downsample_periods(periods, self.MAX_TREND_POINTS)

    @staticmethod
    def _compute_summary(
        compensations: list[Decimal], reporting_currency: str, as_of_date: date | None = None
    ) -> AnalyticsSummary:
        if not compensations:
            return AnalyticsSummary(
                employee_count=0,
                average_compensation=Decimal("0"),
                median_compensation=Decimal("0"),
                min_compensation=Decimal("0"),
                max_compensation=Decimal("0"),
                total_compensation=Decimal("0"),
                reporting_currency=reporting_currency,
                as_of_date=as_of_date,
            )

        sorted_vals = sorted(compensations)
        median = Decimal(str(statistics.median([float(v) for v in sorted_vals]))).quantize(
            Decimal("0.01")
        )
        return AnalyticsSummary(
            employee_count=len(compensations),
            average_compensation=(sum(compensations) / len(compensations)).quantize(Decimal("0.01")),
            median_compensation=median,
            min_compensation=min(compensations),
            max_compensation=max(compensations),
            total_compensation=sum(compensations).quantize(Decimal("0.01")),
            reporting_currency=reporting_currency,
            as_of_date=as_of_date,
        )

    @staticmethod
    def _group_breakdown(
        data: list[dict], key_field: str, label_field: str
    ) -> list[AnalyticsBreakdownItem]:
        groups: dict[str, dict] = {}
        for item in data:
            key = item[key_field]
            if key not in groups:
                groups[key] = {
                    "label": item[label_field],
                    "compensations": [],
                }
            groups[key]["compensations"].append(item["compensation"])

        breakdown = []
        for key, group in sorted(groups.items()):
            comps = group["compensations"]
            breakdown.append(
                AnalyticsBreakdownItem(
                    group_key=key,
                    group_label=group["label"],
                    employee_count=len(comps),
                    average_compensation=(sum(comps) / len(comps)).quantize(Decimal("0.01")),
                    total_compensation=sum(comps).quantize(Decimal("0.01")),
                )
            )
        return breakdown

    def _scope_kwargs(
        self,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> dict:
        return {
            "country_ids": country_ids,
            "department_ids": department_ids,
            "job_level_ids": job_level_ids,
            "payment_statuses": payment_statuses,
            "employment_statuses": employment_statuses,
            "record_statuses": record_statuses,
            "currency_ids": currency_ids,
            "salary_min": salary_min,
            "salary_max": salary_max,
        }

    def _data_for_mode(
        self,
        reporting_currency: str,
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        **scope,
    ) -> list[dict]:
        if date_from is not None and date_to is not None:
            return self._get_employee_compensations_for_range(
                reporting_currency, date_from, date_to, **scope
            )
        return self._get_employee_compensations(
            reporting_currency, as_of_date, **scope
        )

    def get_analytics(
        self,
        reporting_currency: str = "USD",
        as_of_date: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> AnalyticsResponse:
        as_of = self._resolve_as_of_date(as_of_date)
        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )
        data = self._get_employee_compensations(reporting_currency, as_of, **scope)
        compensations = [d["compensation"] for d in data]

        return AnalyticsResponse(
            summary=self._compute_summary(compensations, reporting_currency, as_of),
            by_country=self._group_breakdown(data, "country_code", "country_name"),
            by_department=self._group_breakdown(data, "department_code", "department_name"),
            by_job_level=self._group_breakdown(data, "job_level_code", "job_level_name"),
        )

    def get_summary(
        self,
        reporting_currency: str = "USD",
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> AnalyticsSummary:
        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )
        if date_from is not None and date_to is not None:
            data = self._get_employee_compensations_for_range(
                reporting_currency, date_from, date_to, **scope
            )
            compensations = [d["compensation"] for d in data]
            return self._compute_summary(compensations, reporting_currency, date_to)
        as_of = self._resolve_as_of_date(as_of_date)
        data = self._get_employee_compensations(reporting_currency, as_of, **scope)
        compensations = [d["compensation"] for d in data]
        return self._compute_summary(compensations, reporting_currency, as_of)

    def get_by_country(
        self,
        reporting_currency: str = "USD",
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> list[AnalyticsBreakdownItem]:
        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )
        data = self._data_for_mode(
            reporting_currency, as_of_date, date_from, date_to, **scope
        )
        return self._group_breakdown(data, "country_code", "country_name")

    def get_by_department(
        self,
        reporting_currency: str = "USD",
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> list[AnalyticsBreakdownItem]:
        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )
        data = self._data_for_mode(
            reporting_currency, as_of_date, date_from, date_to, **scope
        )
        return self._group_breakdown(data, "department_code", "department_name")

    def get_by_level(
        self,
        reporting_currency: str = "USD",
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> list[AnalyticsBreakdownItem]:
        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )
        data = self._data_for_mode(
            reporting_currency, as_of_date, date_from, date_to, **scope
        )
        return self._group_breakdown(data, "job_level_code", "job_level_name")

    def _distribution_from_data(
        self, data: list[dict], reporting_currency: str
    ) -> AnalyticsDistributionResponse:
        compensations = [d["compensation"] for d in data]
        total = len(compensations)

        if total == 0:
            return AnalyticsDistributionResponse(
                reporting_currency=reporting_currency, total_employees=0, buckets=[]
            )

        bucket_defs = [
            ("0 - 50K", Decimal("0"), Decimal("50000")),
            ("50K - 100K", Decimal("50000"), Decimal("100000")),
            ("100K - 200K", Decimal("100000"), Decimal("200000")),
            ("200K - 500K", Decimal("200000"), Decimal("500000")),
            ("500K+", Decimal("500000"), None),
        ]

        buckets = []
        for label, min_val, max_val in bucket_defs:
            if max_val is None:
                count = sum(1 for c in compensations if c >= min_val)
            else:
                count = sum(1 for c in compensations if min_val <= c < max_val)
            buckets.append(
                DistributionBucket(
                    range_label=label,
                    min_value=min_val,
                    max_value=max_val,
                    employee_count=count,
                    percentage=(Decimal(count) / Decimal(total) * 100).quantize(Decimal("0.01")),
                )
            )

        return AnalyticsDistributionResponse(
            reporting_currency=reporting_currency,
            total_employees=total,
            buckets=buckets,
        )

    def _aggregations_from_data(
        self, data: list[dict], reporting_currency: str, as_of_date: date | None = None
    ) -> tuple[AnalyticsSummary, list, list, list, AnalyticsDistributionResponse]:
        compensations = [d["compensation"] for d in data]
        summary = self._compute_summary(compensations, reporting_currency, as_of_date)
        return (
            summary,
            self._group_breakdown(data, "country_code", "country_name"),
            self._group_breakdown(data, "department_code", "department_name"),
            self._group_breakdown(data, "job_level_code", "job_level_name"),
            self._distribution_from_data(data, reporting_currency),
        )

    def get_distribution(
        self,
        reporting_currency: str = "USD",
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> AnalyticsDistributionResponse:
        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )
        data = self._data_for_mode(
            reporting_currency, as_of_date, date_from, date_to, **scope
        )
        return self._distribution_from_data(data, reporting_currency)

    @staticmethod
    def _month_end(d: date) -> date:
        if d.month == 12:
            return date(d.year, 12, 31)
        return date(d.year, d.month + 1, 1) - timedelta(days=1)

    def _monthly_period_dates(self, date_from: date, date_to: date) -> list[date]:
        """Return month-end dates within the range for trend snapshots."""
        periods: list[date] = []
        current = date(date_from.year, date_from.month, 1)
        while current <= date_to:
            period_end = self._month_end(current)
            snapshot = min(period_end, date_to)
            if snapshot >= date_from:
                periods.append(snapshot)
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)
        if not periods:
            periods.append(date_to)
        return periods

    @staticmethod
    def _trend_period_label(period_date: date, date_from: date, date_to: date) -> str:
        span_days = (date_to - date_from).days + 1
        if span_days <= 14:
            return period_date.strftime("%b %d, %Y")
        if span_days <= 90:
            return period_date.strftime("%b %d, %Y")
        return period_date.strftime("%b %Y")

    def _build_payment_summary(
        self,
        reporting_currency: str,
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
    ) -> AnalyticsPaymentSummary:
        period_from = date_from
        period_to = date_to
        if period_from is None and period_to is None:
            snapshot = self._resolve_as_of_date(as_of_date)
            period_from = period_to = snapshot

        filters = SalaryRecordFilterParams(
            date_from=period_from,
            date_to=period_to,
            country_ids=country_ids,
            department_ids=department_ids,
            job_level_ids=job_level_ids,
            payment_statuses=payment_statuses,
            employment_statuses=employment_statuses,
            record_statuses=record_statuses,
            currency_ids=currency_ids,
        )
        raw = SalaryRepository(self.db).summarize_filtered_records(
            filters, reporting_currency=reporting_currency
        )
        return AnalyticsPaymentSummary(**raw)

    def get_trend(
        self,
        reporting_currency: str,
        date_from: date,
        date_to: date,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ) -> AnalyticsTrendResponse:
        if date_from > date_to:
            raise ValueError("date_from must be on or before date_to")

        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )
        points: list[AnalyticsTrendPoint] = []
        for period_date in self._trend_period_dates(date_from, date_to):
            summary = self.get_summary(
                reporting_currency,
                as_of_date=period_date,
                **scope,
            )
            points.append(
                AnalyticsTrendPoint(
                    period_label=self._trend_period_label(period_date, date_from, date_to),
                    period_date=period_date,
                    employee_count=summary.employee_count,
                    average_compensation=summary.average_compensation,
                    total_compensation=summary.total_compensation,
                )
            )

        return AnalyticsTrendResponse(
            reporting_currency=reporting_currency,
            date_from=date_from,
            date_to=date_to,
            points=points,
        )

    def get_filtered(
        self,
        reporting_currency: str = "USD",
        as_of_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        country_ids: list[int] | None = None,
        department_ids: list[int] | None = None,
        job_level_ids: list[int] | None = None,
        payment_statuses: list[str] | None = None,
        employment_statuses: list[str] | None = None,
        record_statuses: list[str] | None = None,
        currency_ids: list[int] | None = None,
        salary_min: Decimal | None = None,
        salary_max: Decimal | None = None,
    ):
        from app.schemas.schemas import AnalyticsFilteredResponse, AnalyticsFiltersApplied

        scope = self._scope_kwargs(
            country_ids, department_ids, job_level_ids, payment_statuses,
            employment_statuses, record_statuses, currency_ids, salary_min, salary_max
        )

        is_range = date_from is not None and date_to is not None
        if is_range:
            mode = "range"
        else:
            mode = "snapshot"

        range_start_summary = None
        range_end_summary = None
        trend = None
        snapshot_date = self._resolve_as_of_date(as_of_date)

        if is_range and date_from <= date_to:
            data = self._data_for_mode(
                reporting_currency, date_from=date_from, date_to=date_to, **scope
            )
            summary, by_country, by_department, by_job_level, distribution = (
                self._aggregations_from_data(data, reporting_currency, date_to)
            )
            range_start_data = self._data_for_mode(
                reporting_currency, as_of_date=date_from, **scope
            )
            range_end_data = self._data_for_mode(
                reporting_currency, as_of_date=date_to, **scope
            )
            range_start_summary = self._compute_summary(
                [d["compensation"] for d in range_start_data],
                reporting_currency,
                date_from,
            )
            range_end_summary = self._compute_summary(
                [d["compensation"] for d in range_end_data],
                reporting_currency,
                date_to,
            )
            trend = self.get_trend(reporting_currency, date_from, date_to, **scope)
        else:
            data = self._data_for_mode(
                reporting_currency, as_of_date=snapshot_date, **scope
            )
            summary, by_country, by_department, by_job_level, distribution = (
                self._aggregations_from_data(data, reporting_currency, snapshot_date)
            )

        payment_summary = self._build_payment_summary(
            reporting_currency,
            as_of_date=snapshot_date if not is_range else None,
            date_from=date_from if is_range else None,
            date_to=date_to if is_range else None,
            country_ids=country_ids,
            department_ids=department_ids,
            job_level_ids=job_level_ids,
            payment_statuses=payment_statuses,
            employment_statuses=employment_statuses,
            record_statuses=record_statuses,
            currency_ids=currency_ids,
        )

        return AnalyticsFilteredResponse(
            reporting_currency=reporting_currency,
            mode=mode,
            filters=AnalyticsFiltersApplied(
                as_of_date=as_of_date if not is_range else None,
                date_from=date_from if is_range else None,
                date_to=date_to if is_range else None,
                country_ids=country_ids,
                department_ids=department_ids,
                job_level_ids=job_level_ids,
                payment_statuses=payment_statuses,
                employment_statuses=employment_statuses,
                record_statuses=record_statuses,
                currency_ids=currency_ids,
                salary_min=salary_min,
                salary_max=salary_max,
            ),
            summary=summary,
            payment_summary=payment_summary,
            range_start_summary=range_start_summary,
            range_end_summary=range_end_summary,
            by_country=by_country,
            by_department=by_department,
            by_job_level=by_job_level,
            distribution=distribution,
            trend=trend,
        )
