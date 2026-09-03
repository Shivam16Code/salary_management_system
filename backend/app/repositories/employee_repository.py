import math
from datetime import date
from decimal import Decimal

from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Country,
    Currency,
    Department,
    Employee,
    EmployeeSalaryProfile,
    EmploymentStatus,
    JobLevel,
    SalaryRecord,
    SalaryRecordComponent,
    SalaryStatus,
)
from app.schemas.schemas import EmployeeFilterParams, PaginatedResponse
from app.services.salary_calculator import calculate_salary_totals
from app.repositories.search import employee_text_search_filter


class EmployeeRepository:
    SORTABLE_FIELDS = {
        "employee_code": Employee.employee_code,
        "first_name": Employee.first_name,
        "last_name": Employee.last_name,
        "hire_date": Employee.hire_date,
        "job_title": Employee.job_title,
        "employment_status": Employee.employment_status,
        "department_name": Department.name,
        "country_name": Country.name,
        "job_level_name": JobLevel.name,
    }

    def __init__(self, db: Session):
        self.db = db

    def _active_salary_subquery(self):
        return (
            self.db.query(
                SalaryRecord.employee_id,
                func.max(SalaryRecord.effective_from).label("max_effective_from"),
            )
            .filter(SalaryRecord.status == SalaryStatus.ACTIVE)
            .group_by(SalaryRecord.employee_id)
            .subquery()
        )

    def _build_filtered_query(self, filters: EmployeeFilterParams):
        query = (
            self.db.query(Employee)
            .join(Country)
            .join(Department)
            .join(JobLevel)
            .options(
                joinedload(Employee.country).joinedload(Country.currency),
                joinedload(Employee.department),
                joinedload(Employee.job_level),
                selectinload(Employee.salary_records).joinedload(SalaryRecord.currency),
                selectinload(Employee.salary_records)
                .selectinload(SalaryRecord.components)
                .joinedload(SalaryRecordComponent.salary_component),
                selectinload(Employee.salary_profiles).joinedload(EmployeeSalaryProfile.currency),
            )
        )

        if filters.search:
            search_filter = employee_text_search_filter(filters.search)
            if search_filter is not None:
                query = query.filter(search_filter)

        if filters.department_ids:
            query = query.filter(Employee.department_id.in_(filters.department_ids))
        if filters.job_level_ids:
            query = query.filter(Employee.job_level_id.in_(filters.job_level_ids))
        if filters.employment_statuses:
            statuses = [EmploymentStatus(s) for s in filters.employment_statuses]
            query = query.filter(Employee.employment_status.in_(statuses))

        if filters.currency_ids:
            query = query.filter(Country.currency_id.in_(filters.currency_ids))

        if filters.salary_min is not None or filters.salary_max is not None:
            active_sq = self._active_salary_subquery()
            query = query.join(
                active_sq,
                Employee.id == active_sq.c.employee_id,
            ).join(
                SalaryRecord,
                (SalaryRecord.employee_id == Employee.id)
                & (SalaryRecord.effective_from == active_sq.c.max_effective_from)
                & (SalaryRecord.status == SalaryStatus.ACTIVE),
            )

        return query

    def list_employees(self, filters: EmployeeFilterParams) -> PaginatedResponse:
        query = self._build_filtered_query(filters)

        sort_col = self.SORTABLE_FIELDS.get(filters.sort_by, Employee.employee_code)
        order_fn = asc if filters.sort_order.lower() == "asc" else desc
        query = query.order_by(order_fn(sort_col))

        # Fetch all matching for salary range filter (applied in Python after calc)
        if filters.salary_min is not None or filters.salary_max is not None:
            all_employees = query.all()
            filtered = []
            for emp in all_employees:
                comp = self._get_current_compensation(emp)
                if comp is None:
                    continue
                if filters.salary_min is not None and comp < filters.salary_min:
                    continue
                if filters.salary_max is not None and comp > filters.salary_max:
                    continue
                filtered.append(emp)
            total = len(filtered)
            offset = (filters.page - 1) * filters.page_size
            items = filtered[offset : offset + filters.page_size]
        else:
            total = query.count()
            offset = (filters.page - 1) * filters.page_size
            items = query.offset(offset).limit(filters.page_size).all()

        total_pages = math.ceil(total / filters.page_size) if filters.page_size else 0
        return PaginatedResponse(
            items=items,
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            total_pages=total_pages,
        )

    def get_by_id(self, employee_id: int) -> Employee | None:
        return (
            self.db.query(Employee)
            .options(
                joinedload(Employee.country).joinedload(Country.currency),
                joinedload(Employee.department),
                joinedload(Employee.job_level),
                selectinload(Employee.salary_records).joinedload(SalaryRecord.currency),
                selectinload(Employee.salary_records)
                .selectinload(SalaryRecord.components)
                .joinedload(SalaryRecordComponent.salary_component),
                selectinload(Employee.salary_profiles).joinedload(EmployeeSalaryProfile.currency),
            )
            .filter(Employee.id == employee_id)
            .first()
        )

    def get_by_code(self, employee_code: str) -> Employee | None:
        return (
            self.db.query(Employee)
            .filter(Employee.employee_code == employee_code)
            .first()
        )

    def get_by_email(self, email: str, *, exclude_id: int | None = None) -> Employee | None:
        query = self.db.query(Employee).filter(func.lower(Employee.email) == email.lower())
        if exclude_id is not None:
            query = query.filter(Employee.id != exclude_id)
        return query.first()

    @staticmethod
    def _get_active_salary_record(employee: Employee) -> SalaryRecord | None:
        active_records = [r for r in employee.salary_records if r.status == SalaryStatus.ACTIVE]
        if not active_records:
            return None
        return max(active_records, key=lambda r: r.effective_from)

    @staticmethod
    def _get_salary_record_as_of(employee: Employee, as_of: date) -> SalaryRecord | None:
        """Return the salary record in effect on a given date."""
        applicable = [
            r
            for r in employee.salary_records
            if r.effective_from <= as_of
            and (r.effective_to is None or r.effective_to >= as_of)
        ]
        if not applicable:
            return None
        return max(applicable, key=lambda r: r.effective_from)

    @staticmethod
    def _get_active_salary_profile(employee: Employee) -> EmployeeSalaryProfile | None:
        active_profiles = [p for p in employee.salary_profiles if p.status == SalaryStatus.ACTIVE]
        if not active_profiles:
            return None
        return max(active_profiles, key=lambda p: p.effective_from)

    def _get_current_compensation(self, employee: Employee) -> Decimal | None:
        record = self._get_active_salary_record(employee)
        if not record or not record.components:
            return None
        totals = calculate_salary_totals(record.components)
        return totals["adjusted_compensation"]

    def get_annual_package_info(self, employee: Employee) -> tuple[Decimal | None, str, str]:
        profile = self._get_active_salary_profile(employee)
        currency = employee.country.currency
        if not profile:
            return None, currency.code, currency.symbol
        return profile.annual_package, profile.currency.code, profile.currency.symbol

    def get_current_salary_info(self, employee: Employee) -> tuple[Decimal | None, str, str]:
        currency = employee.country.currency
        record = self._get_active_salary_record(employee)
        if not record:
            return None, currency.code, currency.symbol
        totals = calculate_salary_totals(record.components)
        return totals["adjusted_compensation"], currency.code, currency.symbol

    def create(self, data) -> Employee:
        from app.models import EmploymentStatus
        from app.schemas.schemas import EmployeeCreate

        payload: EmployeeCreate = data
        employee_code = payload.employee_code
        if not employee_code:
            max_id = self.db.query(func.max(Employee.id)).scalar() or 0
            employee_code = f"EMP{max_id + 1:05d}"

        from app.exceptions import ConflictError

        if self.get_by_code(employee_code):
            raise ConflictError(
                "An employee with this employee code already exists.",
                details=[{"field": "employee_code", "message": "An employee with this employee code already exists."}],
            )
        if self.get_by_email(payload.email):
            raise ConflictError(
                "An employee with this email already exists.",
                details=[{"field": "email", "message": "An employee with this email already exists."}],
            )

        employee = Employee(
            employee_code=employee_code,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            country_id=payload.country_id,
            department_id=payload.department_id,
            job_level_id=payload.job_level_id,
            job_title=payload.job_title,
            employment_status=EmploymentStatus(payload.employment_status),
            hire_date=payload.hire_date,
        )
        self.db.add(employee)
        self.db.commit()
        return self.get_by_id(employee.id)  # type: ignore[return-value]

    def update(self, employee_id: int, data) -> Employee | None:
        from app.models import EmploymentStatus
        from app.schemas.schemas import EmployeeUpdate

        employee = self.get_by_id(employee_id)
        if not employee:
            return None

        from app.exceptions import ConflictError

        payload: EmployeeUpdate = data
        updates = payload.model_dump(exclude_unset=True)
        if "employment_status" in updates and updates["employment_status"]:
            updates["employment_status"] = EmploymentStatus(updates["employment_status"])
        if "email" in updates and updates["email"] and self.get_by_email(updates["email"], exclude_id=employee_id):
            raise ConflictError(
                "An employee with this email already exists.",
                details=[{"field": "email", "message": "An employee with this email already exists."}],
            )

        country_changed = "country_id" in updates and updates["country_id"] != employee.country_id

        for field, value in updates.items():
            setattr(employee, field, value)

        if country_changed:
            employee = self.get_by_id(employee_id)
            if employee:
                new_currency_id = employee.country.currency_id
                for record in employee.salary_records:
                    if record.status == SalaryStatus.ACTIVE:
                        record.currency_id = new_currency_id

        self.db.commit()
        return self.get_by_id(employee_id)

    def delete(self, employee_id: int) -> dict:
        """Delete employee and cascade salary records, components, and profiles."""
        from app.exceptions import NotFoundError

        employee = self.get_by_id(employee_id)
        if not employee:
            raise NotFoundError("Employee not found")

        code = employee.employee_code
        records = len(employee.salary_records)
        profiles = len(employee.salary_profiles)
        self.db.delete(employee)
        self.db.commit()
        return {
            "deleted": True,
            "employee_id": employee_id,
            "employee_code": code,
            "cascaded": {
                "salary_records": records,
                "salary_profiles": profiles,
            },
        }
