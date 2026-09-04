import math
from datetime import date
from decimal import Decimal

from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Country,
    Department,
    Employee,
    EmploymentStatus,
    JobLevel,
    PaymentStatus,
    SalaryComponent,
    SalaryRecord,
    SalaryRecordComponent,
    SalaryStatus,
)
from app.schemas.schemas import PaginatedResponse, SalaryRecordCreate, SalaryRecordFilterParams, SalaryRecordUpdate
from app.services.currency_service import CurrencyService
from app.services.salary_calculator import calculate_salary_totals
from app.repositories.search import employee_text_search_filter


class SalaryRepository:
    SORTABLE_FIELDS = {
        "effective_from": SalaryRecord.effective_from,
        "payment_status": SalaryRecord.payment_status,
        "employee_code": Employee.employee_code,
        "employee_name": Employee.last_name,
        "job_title": Employee.job_title,
        "department_name": Department.name,
        "job_level_name": JobLevel.name,
        "country_name": Country.name,
        "employment_status": Employee.employment_status,
        "payment_status": SalaryRecord.payment_status,
    }

    def __init__(self, db: Session):
        self.db = db
        self.currency_service = CurrencyService()

    def get_record_by_id(self, record_id: int) -> SalaryRecord | None:
        return (
            self.db.query(SalaryRecord)
            .options(
                joinedload(SalaryRecord.currency),
                selectinload(SalaryRecord.components).joinedload(
                    SalaryRecordComponent.salary_component
                ),
            )
            .filter(SalaryRecord.id == record_id)
            .first()
        )

    def get_employee_records(self, employee_id: int) -> list[SalaryRecord]:
        return (
            self.db.query(SalaryRecord)
            .options(
                joinedload(SalaryRecord.currency),
                selectinload(SalaryRecord.components).joinedload(
                    SalaryRecordComponent.salary_component
                ),
            )
            .filter(SalaryRecord.employee_id == employee_id)
            .order_by(SalaryRecord.effective_from.desc())
            .all()
        )

    def _record_query_with_employee(self):
        return (
            self.db.query(SalaryRecord)
            .join(Employee, SalaryRecord.employee_id == Employee.id)
            .join(Department, Employee.department_id == Department.id)
            .join(JobLevel, Employee.job_level_id == JobLevel.id)
            .join(Country, Employee.country_id == Country.id)
            .options(
                joinedload(SalaryRecord.currency),
                selectinload(SalaryRecord.components).joinedload(
                    SalaryRecordComponent.salary_component
                ),
                joinedload(SalaryRecord.employee).joinedload(Employee.department),
                joinedload(SalaryRecord.employee).joinedload(Employee.job_level),
                joinedload(SalaryRecord.employee).joinedload(Employee.country),
            )
        )

    @staticmethod
    def _record_period_end(record: SalaryRecord) -> date:
        """Missing effective_to means a single-day salary period."""
        return record.effective_to if record.effective_to is not None else record.effective_from

    @staticmethod
    def record_starts_in_range(record: SalaryRecord, date_from: date, date_to: date) -> bool:
        """True when the pay period start falls inside [date_from, date_to]."""
        return date_from <= record.effective_from <= date_to

    def _apply_record_filters(self, query, filters: SalaryRecordFilterParams):
        # Date filters match period START (effective_from), not period overlap.
        # Overlap pulled in long-running periods that began months earlier.
        if filters.date_from and filters.date_to:
            query = query.filter(
                SalaryRecord.effective_from >= filters.date_from,
                SalaryRecord.effective_from <= filters.date_to,
            )
        elif filters.date_from:
            query = query.filter(SalaryRecord.effective_from >= filters.date_from)
        elif filters.date_to:
            query = query.filter(SalaryRecord.effective_from <= filters.date_to)

        if filters.currency_ids:
            query = query.filter(SalaryRecord.currency_id.in_(filters.currency_ids))
        if filters.department_ids:
            query = query.filter(Employee.department_id.in_(filters.department_ids))
        if filters.job_level_ids:
            query = query.filter(Employee.job_level_id.in_(filters.job_level_ids))
        if filters.employment_statuses:
            statuses = [EmploymentStatus(s) for s in filters.employment_statuses]
            query = query.filter(Employee.employment_status.in_(statuses))
        if filters.payment_statuses:
            payment_values = [PaymentStatus(s) for s in filters.payment_statuses]
            query = query.filter(SalaryRecord.payment_status.in_(payment_values))
        if filters.record_statuses:
            status_values = [SalaryStatus(s) for s in filters.record_statuses]
            query = query.filter(SalaryRecord.status.in_(status_values))
        if filters.search:
            search_filter = employee_text_search_filter(filters.search, include_job_title=True)
            if search_filter is not None:
                query = query.filter(search_filter)
        return query

    def list_filtered_records(self, filters: SalaryRecordFilterParams) -> PaginatedResponse:
        query = self._apply_record_filters(self._record_query_with_employee(), filters)
        sort_col = self.SORTABLE_FIELDS.get(filters.sort_by, SalaryRecord.effective_from)
        order_fn = asc if filters.sort_order.lower() == "asc" else desc
        query = query.order_by(order_fn(sort_col), desc(SalaryRecord.id))

        total = query.count()
        offset = (filters.page - 1) * filters.page_size
        records = query.offset(offset).limit(filters.page_size).all()
        total_pages = math.ceil(total / filters.page_size) if filters.page_size else 0
        return PaginatedResponse(
            items=records,
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            total_pages=total_pages,
        )

    def _record_query_for_summary(self):
        """Lightweight query for payment summaries — no eager-loaded employee relations."""
        return (
            self.db.query(SalaryRecord)
            .join(Employee, SalaryRecord.employee_id == Employee.id)
            .join(Country, Employee.country_id == Country.id)
        )

    def summarize_filtered_records(
        self, filters: SalaryRecordFilterParams, reporting_currency: str = "USD"
    ) -> dict:
        filtered_query = self._apply_record_filters(self._record_query_for_summary(), filters)
        reporting_currency = reporting_currency.upper()
        total_records = filtered_query.count()
        employee_count = filtered_query.with_entities(
            func.count(func.distinct(SalaryRecord.employee_id))
        ).scalar() or 0
        paid_count = filtered_query.filter(
            SalaryRecord.payment_status == PaymentStatus.PAID
        ).count()
        not_paid_count = filtered_query.filter(
            SalaryRecord.payment_status == PaymentStatus.NOT_PAID
        ).count()

        total_paid = Decimal("0")
        total_not_paid = Decimal("0")
        rate_cache: dict[str, Decimal] = {}
        stream_query = filtered_query.options(
            joinedload(SalaryRecord.currency),
            selectinload(SalaryRecord.components).joinedload(
                SalaryRecordComponent.salary_component
            ),
        )
        for record in stream_query.yield_per(1000):
            currency_code = record.currency.code
            if currency_code not in rate_cache:
                rate_cache[currency_code] = (
                    Decimal("1")
                    if currency_code == reporting_currency
                    else self.currency_service.get_rate(currency_code, reporting_currency)
                )
            raw_amount = calculate_salary_totals(record.components)["adjusted_compensation"]
            amount = (raw_amount * rate_cache[currency_code]).quantize(Decimal("0.01"))
            if record.payment_status == PaymentStatus.PAID:
                total_paid += amount
            else:
                total_not_paid += amount
        return {
            "total_records": total_records,
            "employee_count": employee_count,
            "paid_count": paid_count,
            "not_paid_count": not_paid_count,
            "total_paid_amount": total_paid.quantize(Decimal("0.01")),
            "total_not_paid_amount": total_not_paid.quantize(Decimal("0.01")),
            "reporting_currency": reporting_currency,
        }

    def get_current_record(self, employee_id: int) -> SalaryRecord | None:
        from app.repositories.employee_repository import EmployeeRepository

        emp_repo = EmployeeRepository(self.db)
        employee = emp_repo.get_by_id(employee_id)
        if not employee:
            return None
        return emp_repo._get_active_salary_record(employee)

    def create_record(self, employee_id: int, data: SalaryRecordCreate) -> SalaryRecord:
        from app.repositories.employee_repository import EmployeeRepository

        employee = EmployeeRepository(self.db).get_by_id(employee_id)
        if not employee:
            raise ValueError("Employee not found")

        currency_id = employee.country.currency_id
        components = self._apply_profile_base(employee_id, list(data.components))
        self._validate_components(components)

        if data.status == "ACTIVE":
            self._deactivate_existing(employee_id, data.effective_from)

        record = SalaryRecord(
            employee_id=employee_id,
            currency_id=currency_id,
            effective_from=data.effective_from,
            effective_to=data.effective_to,
            status=SalaryStatus(data.status),
            payment_status=PaymentStatus(data.payment_status),
        )
        self.db.add(record)
        self.db.flush()

        for comp_data in components:
            component = SalaryRecordComponent(
                salary_record_id=record.id,
                salary_component_id=comp_data.salary_component_id,
                amount=comp_data.amount,
                units=comp_data.units,
            )
            self.db.add(component)

        self.db.commit()
        self.db.refresh(record)
        return self.get_record_by_id(record.id)  # type: ignore[return-value]

    def update_record(self, record_id: int, data: SalaryRecordUpdate) -> SalaryRecord | None:
        record = self.get_record_by_id(record_id)
        if not record:
            return None

        if data.effective_to is not None:
            record.effective_to = data.effective_to
        if data.status is not None:
            record.status = SalaryStatus(data.status)
        if data.payment_status is not None:
            record.payment_status = PaymentStatus(data.payment_status)

        if data.components is not None:
            components = self._apply_profile_base(record.employee_id, list(data.components))
            self._validate_components(components)
            self.db.query(SalaryRecordComponent).filter(
                SalaryRecordComponent.salary_record_id == record_id
            ).delete()
            for comp_data in components:
                component = SalaryRecordComponent(
                    salary_record_id=record.id,
                    salary_component_id=comp_data.salary_component_id,
                    amount=comp_data.amount,
                    units=comp_data.units,
                )
                self.db.add(component)

        self.db.commit()
        return self.get_record_by_id(record_id)

    def delete_record(self, record_id: int) -> dict:
        """Delete a salary record; components cascade via ORM/FK."""
        from app.exceptions import NotFoundError

        record = self.get_record_by_id(record_id)
        if not record:
            raise NotFoundError("Salary record not found")

        employee_id = record.employee_id
        component_count = len(record.components)
        self.db.delete(record)
        self.db.commit()
        return {
            "deleted": True,
            "record_id": record_id,
            "employee_id": employee_id,
            "cascaded": {"salary_record_components": component_count},
        }

    def delete_component(self, component_id: int) -> dict:
        """Delete a master salary component only when unused by any record line."""
        from app.exceptions import ConflictError, NotFoundError

        component = self.get_component_by_id(component_id)
        if not component:
            raise NotFoundError("Salary component not found")

        usage = (
            self.db.query(SalaryRecordComponent)
            .filter(SalaryRecordComponent.salary_component_id == component_id)
            .count()
        )
        if usage > 0:
            raise ConflictError(
                f"Cannot delete salary component '{component.code}' — "
                f"it is used by {usage} salary record line(s). "
                "Deactivate it instead, or remove those lines first.",
                details=[{"field": "component_id", "message": f"{usage} dependent records"}],
            )

        code = component.code
        self.db.delete(component)
        self.db.commit()
        return {"deleted": True, "component_id": component_id, "code": code}

    def _apply_profile_base(self, employee_id: int, components: list) -> list:
        from app.repositories.salary_profile_repository import SalaryProfileRepository
        from app.schemas.schemas import SalaryRecordComponentCreate

        profile_repo = SalaryProfileRepository(self.db)
        profile = profile_repo.get_active_profile(employee_id)
        basic_id = profile_repo.get_basic_component_id()

        if not basic_id:
            return components

        if not profile:
            has_basic = any(c.salary_component_id == basic_id for c in components)
            if not has_basic:
                raise ValueError(
                    "No salary profile found. Create an employee salary profile with base salary first."
                )
            return components

        filtered = [c for c in components if c.salary_component_id != basic_id]
        basic_line = SalaryRecordComponentCreate(
            salary_component_id=basic_id,
            amount=profile.base_salary,
        )
        return [basic_line, *filtered]

    def _validate_components(self, components) -> None:
        if not components:
            raise ValueError("At least one salary component is required")
        component_ids = [c.salary_component_id for c in components]
        if len(component_ids) != len(set(component_ids)):
            raise ValueError("Duplicate salary components are not allowed on one record")
        for comp_id in component_ids:
            exists = (
                self.db.query(SalaryComponent)
                .filter(SalaryComponent.id == comp_id, SalaryComponent.is_active.is_(True))
                .first()
            )
            if not exists:
                raise ValueError(f"Salary component {comp_id} not found or inactive")

    def _deactivate_existing(self, employee_id: int, new_effective_from: date) -> None:
        existing = (
            self.db.query(SalaryRecord)
            .filter(
                SalaryRecord.employee_id == employee_id,
                SalaryRecord.status == SalaryStatus.ACTIVE,
            )
            .all()
        )
        for rec in existing:
            rec.status = SalaryStatus.INACTIVE
            if rec.effective_to is None or rec.effective_to >= new_effective_from:
                from datetime import timedelta

                rec.effective_to = new_effective_from - timedelta(days=1)

    @staticmethod
    def build_list_item_response(record: SalaryRecord) -> dict:
        base = SalaryRepository.build_record_response(record)
        emp = record.employee
        return {
            **base,
            "employee_code": emp.employee_code,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "job_title": emp.job_title,
            "employment_status": emp.employment_status.value,
            "department_code": emp.department.code,
            "department_name": emp.department.name,
            "job_level_code": emp.job_level.code,
            "job_level_name": emp.job_level.name,
            "country_code": emp.country.iso_code,
            "country_name": emp.country.name,
        }

    @staticmethod
    def build_record_response(record: SalaryRecord) -> dict:
        totals = calculate_salary_totals(record.components)
        components = []
        for comp in record.components:
            from app.services.salary_calculator import calculate_component_amount

            components.append(
                {
                    "id": comp.id,
                    "salary_component_id": comp.salary_component_id,
                    "component_code": comp.salary_component.code,
                    "component_name": comp.salary_component.name,
                    "component_type": comp.salary_component.component_type.value,
                    "calculation_method": comp.salary_component.calculation_method.value,
                    "amount": comp.amount,
                    "units": comp.units,
                    "calculated_amount": calculate_component_amount(comp, record.components),
                }
            )
        return {
            "id": record.id,
            "employee_id": record.employee_id,
            "currency_code": record.currency.code,
            "currency_symbol": record.currency.symbol,
            "effective_from": record.effective_from,
            "effective_to": record.effective_to,
            "status": record.status.value,
            "payment_status": record.payment_status.value,
            "total_earnings": totals["total_earnings"],
            "total_deductions": totals["total_deductions"],
            "adjusted_compensation": totals["adjusted_compensation"],
            "components": components,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
        }

    def list_components(self, active_only: bool = True) -> list[SalaryComponent]:
        query = self.db.query(SalaryComponent)
        if active_only:
            query = query.filter(SalaryComponent.is_active.is_(True))
        return query.order_by(SalaryComponent.code).all()

    def get_component_by_id(self, component_id: int) -> SalaryComponent | None:
        return self.db.query(SalaryComponent).filter(SalaryComponent.id == component_id).first()

    def create_component(self, data) -> SalaryComponent:
        from app.models import CalculationMethod, ComponentType
        from app.schemas.schemas import SalaryComponentCreate

        payload: SalaryComponentCreate = data
        component = SalaryComponent(
            code=payload.code.upper(),
            name=payload.name,
            component_type=ComponentType(payload.component_type),
            calculation_method=CalculationMethod(payload.calculation_method),
            is_taxable=payload.is_taxable,
            is_active=payload.is_active,
        )
        self.db.add(component)
        self.db.commit()
        self.db.refresh(component)
        return component

    def update_component(self, component_id: int, data) -> SalaryComponent | None:
        from app.models import CalculationMethod, ComponentType
        from app.schemas.schemas import SalaryComponentUpdate

        component = self.get_component_by_id(component_id)
        if not component:
            return None

        payload: SalaryComponentUpdate = data
        updates = payload.model_dump(exclude_unset=True)
        if "component_type" in updates and updates["component_type"]:
            updates["component_type"] = ComponentType(updates["component_type"])
        if "calculation_method" in updates and updates["calculation_method"]:
            updates["calculation_method"] = CalculationMethod(updates["calculation_method"])

        for field, value in updates.items():
            setattr(component, field, value)

        self.db.commit()
        self.db.refresh(component)
        return component
