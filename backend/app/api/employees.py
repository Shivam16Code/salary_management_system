from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import BadRequestError, ConflictError, NotFoundError
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.salary_profile_repository import SalaryProfileRepository
from app.repositories.salary_repository import SalaryRepository
from app.schemas.schemas import (
    EmployeeCreate,
    EmployeeDetailResponse,
    EmployeeFilterParams,
    EmployeeSalaryProfileResponse,
    EmployeeSummaryResponse,
    EmployeeUpdate,
    PaginatedResponse,
    SalaryRecordCreate,
    SalaryRecordResponse,
)

router = APIRouter(prefix="/employees", tags=["employees"])


def _build_summary(employee, repo: EmployeeRepository) -> EmployeeSummaryResponse:
    salary, _, _ = repo.get_current_salary_info(employee)
    annual_package, currency_code, currency_symbol = repo.get_annual_package_info(employee)
    return EmployeeSummaryResponse(
        id=employee.id,
        employee_code=employee.employee_code,
        first_name=employee.first_name,
        last_name=employee.last_name,
        full_name=employee.full_name,
        email=employee.email,
        country_code=employee.country.iso_code,
        country_name=employee.country.name,
        country_currency_code=employee.country.currency_code,
        country_currency_symbol=employee.country.currency.symbol,
        department_code=employee.department.code,
        department_name=employee.department.name,
        job_level_code=employee.job_level.code,
        job_level_name=employee.job_level.name,
        job_title=employee.job_title,
        employment_status=employee.employment_status.value,
        hire_date=employee.hire_date,
        current_salary=salary,
        annual_package=annual_package,
        currency_code=currency_code,
        currency_symbol=currency_symbol,
    )


@router.get("", response_model=PaginatedResponse[EmployeeSummaryResponse])
def list_employees(
    search: str | None = None,
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    currency_ids: list[int] | None = Query(None),
    salary_min: float | None = None,
    salary_max: float | None = None,
    sort_by: str = Query(default="employee_code"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = EmployeeFilterParams(
        search=search,
        department_ids=department_ids or None,
        job_level_ids=job_level_ids or None,
        employment_statuses=employment_statuses or None,
        currency_ids=currency_ids or None,
        salary_min=Decimal(str(salary_min)) if salary_min is not None else None,
        salary_max=Decimal(str(salary_max)) if salary_max is not None else None,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    repo = EmployeeRepository(db)
    result = repo.list_employees(filters)
    return PaginatedResponse(
        items=[_build_summary(emp, repo) for emp in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.post("", response_model=EmployeeDetailResponse, status_code=201)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    repo = EmployeeRepository(db)
    try:
        employee = repo.create(data)
    except ValueError as exc:
        raise ConflictError(str(exc)) from exc
    if not employee:
        raise BadRequestError("Failed to create employee")
    return EmployeeDetailResponse(**_build_summary(employee, repo).model_dump(), salary_records=[])


@router.get("/{employee_id}/salaries/current", response_model=SalaryRecordResponse)
def get_current_salary(employee_id: int, db: Session = Depends(get_db)):
    emp_repo = EmployeeRepository(db)
    if not emp_repo.get_by_id(employee_id):
        raise NotFoundError("Employee not found")

    salary_repo = SalaryRepository(db)
    record = salary_repo.get_current_record(employee_id)
    if not record:
        raise NotFoundError("No active salary record found")
    return SalaryRecordResponse(**salary_repo.build_record_response(record))


@router.get("/{employee_id}/salaries", response_model=list[SalaryRecordResponse])
def list_employee_salaries(employee_id: int, db: Session = Depends(get_db)):
    emp_repo = EmployeeRepository(db)
    if not emp_repo.get_by_id(employee_id):
        raise NotFoundError("Employee not found")

    salary_repo = SalaryRepository(db)
    records = salary_repo.get_employee_records(employee_id)
    return [SalaryRecordResponse(**salary_repo.build_record_response(r)) for r in records]


@router.post("/{employee_id}/salaries", response_model=SalaryRecordResponse, status_code=201)
def create_employee_salary(
    employee_id: int, data: SalaryRecordCreate, db: Session = Depends(get_db)
):
    emp_repo = EmployeeRepository(db)
    if not emp_repo.get_by_id(employee_id):
        raise NotFoundError("Employee not found")

    salary_repo = SalaryRepository(db)
    record = salary_repo.create_record(employee_id, data)
    return SalaryRecordResponse(**salary_repo.build_record_response(record))


@router.get("/{employee_id}", response_model=EmployeeDetailResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    repo = EmployeeRepository(db)
    salary_repo = SalaryRepository(db)
    profile_repo = SalaryProfileRepository(db)
    employee = repo.get_by_id(employee_id)
    if not employee:
        raise NotFoundError("Employee not found")

    summary = _build_summary(employee, repo)
    records = [
        SalaryRecordResponse(**salary_repo.build_record_response(r))
        for r in sorted(employee.salary_records, key=lambda x: x.effective_from, reverse=True)
    ]
    active_profile = profile_repo.get_active_profile(employee_id)
    profile_response = (
        EmployeeSalaryProfileResponse(**profile_repo.build_profile_response(active_profile))
        if active_profile
        else None
    )
    return EmployeeDetailResponse(
        **summary.model_dump(),
        salary_records=records,
        salary_profile=profile_response,
    )


@router.put("/{employee_id}", response_model=EmployeeDetailResponse)
def update_employee(employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    repo = EmployeeRepository(db)
    salary_repo = SalaryRepository(db)
    employee = repo.update(employee_id, data)
    if not employee:
        raise NotFoundError("Employee not found")

    summary = _build_summary(employee, repo)
    records = [
        SalaryRecordResponse(**salary_repo.build_record_response(r))
        for r in sorted(employee.salary_records, key=lambda x: x.effective_from, reverse=True)
    ]
    return EmployeeDetailResponse(**summary.model_dump(), salary_records=records)


@router.delete("/{employee_id}", status_code=200)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    """Delete employee and cascade salary records, components, and salary profiles."""
    return EmployeeRepository(db).delete(employee_id)
