from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import BadRequestError, NotFoundError
from app.repositories.salary_repository import SalaryRepository
from app.schemas.schemas import (
    SalaryRecordFilterParams,
    SalaryRecordFilterSummary,
    SalaryRecordListItem,
    SalaryRecordListResponse,
    SalaryRecordResponse,
    SalaryRecordUpdate,
)

router = APIRouter(prefix="/salaries", tags=["salaries"])


@router.get("", response_model=SalaryRecordListResponse)
def list_salary_records(
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    currency_ids: list[int] | None = Query(None),
    department_ids: list[int] | None = Query(None),
    job_level_ids: list[int] | None = Query(None),
    payment_statuses: list[str] | None = Query(None),
    employment_statuses: list[str] | None = Query(None),
    record_statuses: list[str] | None = Query(None),
    reporting_currency: str = Query(default="USD"),
    sort_by: str = Query(default="effective_from"),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List salary records filtered by date range, payment status, department, etc."""
    if date_from and date_to and date_from > date_to:
        raise BadRequestError("date_from must be on or before date_to")

    filters = SalaryRecordFilterParams(
        search=search,
        date_from=date_from,
        date_to=date_to,
        currency_ids=currency_ids or None,
        department_ids=department_ids or None,
        job_level_ids=job_level_ids or None,
        payment_statuses=payment_statuses or None,
        employment_statuses=employment_statuses or None,
        record_statuses=record_statuses or None,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    repo = SalaryRepository(db)
    result = repo.list_filtered_records(filters)
    summary = repo.summarize_filtered_records(filters, reporting_currency=reporting_currency)
    return SalaryRecordListResponse(
        items=[
            SalaryRecordListItem(**repo.build_list_item_response(r)) for r in result.items
        ],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
        summary=SalaryRecordFilterSummary(**summary),
    )


@router.put("/{record_id}", response_model=SalaryRecordResponse)
def update_salary(record_id: int, data: SalaryRecordUpdate, db: Session = Depends(get_db)):
    salary_repo = SalaryRepository(db)
    record = salary_repo.update_record(record_id, data)
    if not record:
        raise NotFoundError("Salary record not found")
    return SalaryRecordResponse(**salary_repo.build_record_response(record))


@router.delete("/{record_id}", status_code=200)
def delete_salary(record_id: int, db: Session = Depends(get_db)):
    """Delete a salary record; line components are removed via cascade."""
    return SalaryRepository(db).delete_record(record_id)
