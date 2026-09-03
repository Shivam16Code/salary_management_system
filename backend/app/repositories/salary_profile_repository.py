from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Employee,
    EmployeeSalaryProfile,
    PayFrequency,
    SalaryComponent,
    SalaryStatus,
)
from app.schemas.schemas import EmployeeSalaryProfileCreate, EmployeeSalaryProfileUpdate
from app.services.salary_profile_calculator import (
    annual_package_from,
    monthly_base_from,
    per_period_amount_from_annual,
)


class SalaryProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_profile(self, employee_id: int) -> EmployeeSalaryProfile | None:
        return (
            self.db.query(EmployeeSalaryProfile)
            .options(joinedload(EmployeeSalaryProfile.currency))
            .filter(
                EmployeeSalaryProfile.employee_id == employee_id,
                EmployeeSalaryProfile.status == SalaryStatus.ACTIVE,
            )
            .order_by(EmployeeSalaryProfile.effective_from.desc())
            .first()
        )

    def get_profile_by_id(self, profile_id: int) -> EmployeeSalaryProfile | None:
        return (
            self.db.query(EmployeeSalaryProfile)
            .options(joinedload(EmployeeSalaryProfile.currency))
            .filter(EmployeeSalaryProfile.id == profile_id)
            .first()
        )

    def list_history(self, employee_id: int) -> list[EmployeeSalaryProfile]:
        return (
            self.db.query(EmployeeSalaryProfile)
            .options(joinedload(EmployeeSalaryProfile.currency))
            .filter(EmployeeSalaryProfile.employee_id == employee_id)
            .order_by(EmployeeSalaryProfile.effective_from.desc())
            .all()
        )

    def create_profile(
        self, employee_id: int, data: EmployeeSalaryProfileCreate
    ) -> EmployeeSalaryProfile:
        employee = self._get_employee(employee_id)
        if self.get_active_profile(employee_id):
            raise ValueError(
                "Employee already has an active salary profile. Update it to change base salary."
            )

        return self._insert_profile(employee, data)

    def update_profile(
        self, employee_id: int, data: EmployeeSalaryProfileUpdate
    ) -> EmployeeSalaryProfile:
        employee = self._get_employee(employee_id)
        current = self.get_active_profile(employee_id)
        if not current:
            raise ValueError("No active salary profile found. Create one first.")

        self._archive_profile(current, data.effective_from)

        create_payload = EmployeeSalaryProfileCreate(
            package_amount=data.package_amount,
            pay_frequency=data.pay_frequency or current.pay_frequency.value,
            effective_from=data.effective_from,
            change_reason=data.change_reason,
        )
        return self._insert_profile(employee, create_payload)

    def _get_employee(self, employee_id: int) -> Employee:
        employee = (
            self.db.query(Employee)
            .options(joinedload(Employee.country))
            .filter(Employee.id == employee_id)
            .first()
        )
        if not employee:
            raise ValueError("Employee not found")
        return employee

    def _archive_profile(self, profile: EmployeeSalaryProfile, new_effective_from: date) -> None:
        profile.status = SalaryStatus.INACTIVE
        if profile.effective_to is None or profile.effective_to >= new_effective_from:
            profile.effective_to = new_effective_from - timedelta(days=1)

    def _insert_profile(
        self, employee: Employee, data: EmployeeSalaryProfileCreate
    ) -> EmployeeSalaryProfile:
        frequency = PayFrequency(data.pay_frequency)
        annual = annual_package_from(data.package_amount, frequency)
        base = monthly_base_from(data.package_amount, frequency)

        profile = EmployeeSalaryProfile(
            employee_id=employee.id,
            currency_id=employee.country.currency_id,
            package_amount=data.package_amount,
            pay_frequency=frequency,
            annual_package=annual,
            base_salary=base,
            effective_from=data.effective_from,
            status=SalaryStatus.ACTIVE,
            change_reason=data.change_reason,
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return self.get_profile_by_id(profile.id)  # type: ignore[return-value]

    def get_basic_component_id(self) -> int | None:
        basic = (
            self.db.query(SalaryComponent)
            .filter(SalaryComponent.code == "BASIC", SalaryComponent.is_active.is_(True))
            .first()
        )
        return basic.id if basic else None

    @staticmethod
    def build_profile_response(profile: EmployeeSalaryProfile) -> dict:
        per_period = per_period_amount_from_annual(profile.annual_package, profile.pay_frequency)
        return {
            "id": profile.id,
            "employee_id": profile.employee_id,
            "package_amount": profile.package_amount,
            "pay_frequency": profile.pay_frequency.value,
            "annual_package": profile.annual_package,
            "base_salary": profile.base_salary,
            "per_period_amount": per_period,
            "currency_code": profile.currency.code,
            "currency_symbol": profile.currency.symbol,
            "effective_from": profile.effective_from,
            "effective_to": profile.effective_to,
            "status": profile.status.value,
            "change_reason": profile.change_reason,
            "created_at": profile.created_at,
            "updated_at": profile.updated_at,
        }
