from datetime import date, datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class CountryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    iso_code: str
    name: str
    currency_id: int
    currency_code: str
    is_active: bool


class CurrencyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    symbol: str
    decimal_places: int
    is_active: bool


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    is_active: bool


class JobLevelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str | None
    is_active: bool


class CurrencyReferenceItem(BaseModel):
    code: str
    name: str
    symbol: str
    decimal_places: int


class CountryReferenceItem(BaseModel):
    iso_code: str
    name: str
    currency_code: str


class CurrencyCreate(BaseModel):
    code: str = Field(min_length=3, max_length=3)
    name: str = Field(min_length=1, max_length=100)
    symbol: str = Field(min_length=1, max_length=10)
    decimal_places: int = Field(default=2, ge=0, le=4)
    is_active: bool = True


class CurrencyCreateFromReference(BaseModel):
    code: str = Field(min_length=3, max_length=3)


class CurrencyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    symbol: str | None = Field(default=None, min_length=1, max_length=10)
    decimal_places: int | None = Field(default=None, ge=0, le=4)
    is_active: bool | None = None


class CountryCreate(BaseModel):
    iso_code: str = Field(min_length=2, max_length=3)
    is_active: bool = True


class CountryUpdate(BaseModel):
    is_active: bool | None = None


class DepartmentCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    is_active: bool = True


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class JobLevelCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    is_active: bool = True


class JobLevelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None


class SalaryComponentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    component_type: str
    calculation_method: str
    is_taxable: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SalaryRecordComponentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    salary_component_id: int
    component_code: str
    component_name: str
    component_type: str
    calculation_method: str
    amount: Decimal
    units: Decimal | None
    calculated_amount: Decimal


class SalaryRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    currency_code: str
    currency_symbol: str
    effective_from: date
    effective_to: date | None
    status: str
    payment_status: str
    total_earnings: Decimal
    total_deductions: Decimal
    adjusted_compensation: Decimal
    components: list[SalaryRecordComponentResponse]
    created_at: datetime
    updated_at: datetime


class EmployeeSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    country_code: str
    country_name: str
    country_currency_code: str
    country_currency_symbol: str
    department_code: str
    department_name: str
    job_level_code: str
    job_level_name: str
    job_title: str
    employment_status: str
    hire_date: date
    current_salary: Decimal | None = None
    annual_package: Decimal | None = None
    currency_code: str | None = None
    currency_symbol: str | None = None


class EmployeeDetailResponse(EmployeeSummaryResponse):
    salary_records: list[SalaryRecordResponse] = []
    salary_profile: "EmployeeSalaryProfileResponse | None" = None


class EmployeeSalaryProfileCreate(BaseModel):
    package_amount: Decimal = Field(gt=0)
    pay_frequency: str = Field(pattern="^(WEEKLY|MONTHLY|QUARTERLY|YEARLY)$")
    effective_from: date
    change_reason: str | None = Field(default=None, max_length=500)


class EmployeeSalaryProfileUpdate(BaseModel):
    package_amount: Decimal = Field(gt=0)
    pay_frequency: str | None = Field(default=None, pattern="^(WEEKLY|MONTHLY|QUARTERLY|YEARLY)$")
    effective_from: date
    change_reason: str | None = Field(default=None, max_length=500)


class EmployeeSalaryProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    package_amount: Decimal
    pay_frequency: str
    annual_package: Decimal
    base_salary: Decimal
    per_period_amount: Decimal
    currency_code: str
    currency_symbol: str
    effective_from: date
    effective_to: date | None
    status: str
    change_reason: str | None
    created_at: datetime
    updated_at: datetime


class SalaryProfilePreview(BaseModel):
    package_amount: Decimal
    pay_frequency: str
    annual_package: Decimal
    base_salary: Decimal
    per_period_amount: Decimal


class EmployeeFilterParams(BaseModel):
    search: str | None = None
    department_ids: list[int] | None = None
    job_level_ids: list[int] | None = None
    employment_statuses: list[str] | None = None
    currency_ids: list[int] | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    sort_by: str = "employee_code"
    sort_order: str = "asc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)


class SalaryRecordComponentCreate(BaseModel):
    salary_component_id: int
    amount: Decimal = Field(default=Decimal("0"), ge=0)
    units: Decimal | None = Field(default=None, ge=0)


class SalaryRecordCreate(BaseModel):
    effective_from: date
    effective_to: date | None = None
    status: str = "ACTIVE"
    payment_status: str = "NOT_PAID"
    components: list[SalaryRecordComponentCreate]


class SalaryRecordUpdate(BaseModel):
    effective_to: date | None = None
    status: str | None = None
    payment_status: str | None = None
    components: list[SalaryRecordComponentCreate] | None = None


class SalaryRecordFilterParams(BaseModel):
    search: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    currency_ids: list[int] | None = None
    department_ids: list[int] | None = None
    job_level_ids: list[int] | None = None
    payment_statuses: list[str] | None = None
    employment_statuses: list[str] | None = None
    record_statuses: list[str] | None = None
    sort_by: str = "effective_from"
    sort_order: str = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)


class SalaryRecordListItem(SalaryRecordResponse):
    employee_code: str
    employee_name: str
    job_title: str
    employment_status: str
    department_code: str
    department_name: str
    job_level_code: str
    job_level_name: str
    country_code: str
    country_name: str


class SalaryRecordFilterSummary(BaseModel):
    total_records: int
    employee_count: int
    paid_count: int
    not_paid_count: int
    total_paid_amount: Decimal
    total_not_paid_amount: Decimal
    reporting_currency: str


class SalaryRecordListResponse(BaseModel):
    items: list[SalaryRecordListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    summary: SalaryRecordFilterSummary


class AnalyticsSummary(BaseModel):
    employee_count: int
    average_compensation: Decimal
    median_compensation: Decimal
    min_compensation: Decimal
    max_compensation: Decimal
    total_compensation: Decimal
    reporting_currency: str
    as_of_date: date | None = None


class AnalyticsTrendPoint(BaseModel):
    period_label: str
    period_date: date
    employee_count: int
    average_compensation: Decimal
    total_compensation: Decimal


class AnalyticsTrendResponse(BaseModel):
    reporting_currency: str
    date_from: date
    date_to: date
    points: list[AnalyticsTrendPoint]


class AnalyticsBreakdownItem(BaseModel):
    group_key: str
    group_label: str
    employee_count: int
    average_compensation: Decimal
    total_compensation: Decimal


class AnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    by_country: list[AnalyticsBreakdownItem]
    by_department: list[AnalyticsBreakdownItem]
    by_job_level: list[AnalyticsBreakdownItem]


class AnalyticsFiltersApplied(BaseModel):
    as_of_date: date | None = None
    date_from: date | None = None
    date_to: date | None = None
    country_ids: list[int] | None = None
    department_ids: list[int] | None = None
    job_level_ids: list[int] | None = None
    payment_statuses: list[str] | None = None
    employment_statuses: list[str] | None = None
    record_statuses: list[str] | None = None
    currency_ids: list[int] | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None


class AnalyticsPaymentSummary(BaseModel):
    total_records: int
    employee_count: int
    paid_count: int
    not_paid_count: int
    total_paid_amount: Decimal
    total_not_paid_amount: Decimal
    reporting_currency: str


class EmployeeCreate(BaseModel):
    employee_code: str | None = None
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    country_id: int
    department_id: int
    job_level_id: int
    job_title: str = Field(min_length=1, max_length=150)
    employment_status: str = "ACTIVE"
    hire_date: date


class EmployeeUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, min_length=5, max_length=255)
    country_id: int | None = None
    department_id: int | None = None
    job_level_id: int | None = None
    job_title: str | None = Field(default=None, min_length=1, max_length=150)
    employment_status: str | None = None
    hire_date: date | None = None


class SalaryComponentCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    component_type: str
    calculation_method: str
    is_taxable: bool = True
    is_active: bool = True


class SalaryComponentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    component_type: str | None = None
    calculation_method: str | None = None
    is_taxable: bool | None = None
    is_active: bool | None = None


class ExchangeRatePairResponse(BaseModel):
    base: str
    quote: str
    rate: Decimal
    effective_date: date | None = None


class ExchangeRatesListResponse(BaseModel):
    base: str
    effective_date: date | None = None
    rates: list[ExchangeRatePairResponse]


class DistributionBucket(BaseModel):
    range_label: str
    min_value: Decimal
    max_value: Decimal | None
    employee_count: int
    percentage: Decimal


class AnalyticsDistributionResponse(BaseModel):
    reporting_currency: str
    total_employees: int
    buckets: list[DistributionBucket]


class AnalyticsFilteredResponse(BaseModel):
    reporting_currency: str
    mode: str
    filters: AnalyticsFiltersApplied
    summary: AnalyticsSummary
    payment_summary: AnalyticsPaymentSummary
    range_start_summary: AnalyticsSummary | None = None
    range_end_summary: AnalyticsSummary | None = None
    by_country: list[AnalyticsBreakdownItem]
    by_department: list[AnalyticsBreakdownItem]
    by_job_level: list[AnalyticsBreakdownItem]
    distribution: AnalyticsDistributionResponse
    trend: AnalyticsTrendResponse | None = None
