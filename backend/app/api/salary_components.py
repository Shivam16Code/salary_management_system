from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.repositories.salary_repository import SalaryRepository
from app.schemas.schemas import (
    SalaryComponentCreate,
    SalaryComponentResponse,
    SalaryComponentUpdate,
)

router = APIRouter(prefix="/salary-components", tags=["salary-components"])


@router.get("", response_model=list[SalaryComponentResponse])
def list_salary_components(active_only: bool = True, db: Session = Depends(get_db)):
    repo = SalaryRepository(db)
    return repo.list_components(active_only=active_only)


@router.post("", response_model=SalaryComponentResponse, status_code=201)
def create_salary_component(data: SalaryComponentCreate, db: Session = Depends(get_db)):
    return SalaryRepository(db).create_component(data)


@router.put("/{component_id}", response_model=SalaryComponentResponse)
def update_salary_component(
    component_id: int, data: SalaryComponentUpdate, db: Session = Depends(get_db)
):
    repo = SalaryRepository(db)
    component = repo.update_component(component_id, data)
    if not component:
        raise NotFoundError("Salary component not found")
    return component


@router.delete("/{component_id}", status_code=200)
def delete_salary_component(component_id: int, db: Session = Depends(get_db)):
    """Delete a salary component only when unused by salary records."""
    return SalaryRepository(db).delete_component(component_id)
