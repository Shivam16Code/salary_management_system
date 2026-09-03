from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.repositories.salary_profile_repository import SalaryProfileRepository
from app.schemas.schemas import (
    EmployeeSalaryProfileCreate,
    EmployeeSalaryProfileResponse,
    EmployeeSalaryProfileUpdate,
    SalaryProfilePreview,
)

router = APIRouter(prefix="/employees", tags=["salary-profiles"])


@router.get("/{employee_id}/salary-profile", response_model=EmployeeSalaryProfileResponse)
def get_active_salary_profile(employee_id: int, db: Session = Depends(get_db)):
    repo = SalaryProfileRepository(db)
    profile = repo.get_active_profile(employee_id)
    if not profile:
        raise NotFoundError("No active salary profile found")
    return EmployeeSalaryProfileResponse(**repo.build_profile_response(profile))


@router.get("/{employee_id}/salary-profile/history", response_model=list[EmployeeSalaryProfileResponse])
def list_salary_profile_history(employee_id: int, db: Session = Depends(get_db)):
    repo = SalaryProfileRepository(db)
    profiles = repo.list_history(employee_id)
    return [EmployeeSalaryProfileResponse(**repo.build_profile_response(p)) for p in profiles]


@router.post("/{employee_id}/salary-profile", response_model=EmployeeSalaryProfileResponse, status_code=201)
def create_salary_profile(
    employee_id: int, data: EmployeeSalaryProfileCreate, db: Session = Depends(get_db)
):
    repo = SalaryProfileRepository(db)
    profile = repo.create_profile(employee_id, data)
    return EmployeeSalaryProfileResponse(**repo.build_profile_response(profile))


@router.put("/{employee_id}/salary-profile", response_model=EmployeeSalaryProfileResponse)
def update_salary_profile(
    employee_id: int, data: EmployeeSalaryProfileUpdate, db: Session = Depends(get_db)
):
    repo = SalaryProfileRepository(db)
    profile = repo.update_profile(employee_id, data)
    return EmployeeSalaryProfileResponse(**repo.build_profile_response(profile))


@router.post("/salary-profile/preview", response_model=SalaryProfilePreview)
def preview_salary_profile(data: EmployeeSalaryProfileCreate):
    from app.models.enums import PayFrequency
    from app.services.salary_profile_calculator import (
        annual_package_from,
        monthly_base_from,
        per_period_amount_from_annual,
    )

    frequency = PayFrequency(data.pay_frequency)
    annual = annual_package_from(data.package_amount, frequency)
    base = monthly_base_from(data.package_amount, frequency)
    per_period = per_period_amount_from_annual(annual, frequency)
    return SalaryProfilePreview(
        package_amount=data.package_amount,
        pay_frequency=data.pay_frequency,
        annual_package=annual,
        base_salary=base,
        per_period_amount=per_period,
    )
