from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.repositories.master_data_repository import MasterDataRepository
from app.schemas.schemas import (
    CountryCreate,
    CountryReferenceItem,
    CountryResponse,
    CountryUpdate,
    CurrencyResponse,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    JobLevelCreate,
    JobLevelResponse,
    JobLevelUpdate,
)
from app.services.reference_data import COUNTRY_REFERENCE

router = APIRouter(tags=["master-data"])


def _repo(db: Session = Depends(get_db)) -> MasterDataRepository:
    return MasterDataRepository(db)


@router.get("/countries/reference", response_model=list[CountryReferenceItem])
def list_country_reference(
    search: str | None = Query(default=None),
    exclude_existing: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    items = COUNTRY_REFERENCE
    if exclude_existing:
        existing = {c.iso_code for c in MasterDataRepository(db).list_countries()}
        items = [i for i in items if i["iso_code"] not in existing]
    if search:
        term = search.lower()
        items = [
            i
            for i in items
            if term in i["iso_code"].lower() or term in i["name"].lower()
        ]
    return items


@router.get("/currencies", response_model=list[CurrencyResponse])
def list_currencies(
    active_only: bool = Query(default=False),
    repo: MasterDataRepository = Depends(_repo),
):
    return repo.list_currencies(active_only=active_only)


@router.get("/currencies/{currency_id}", response_model=CurrencyResponse)
def get_currency(currency_id: int, repo: MasterDataRepository = Depends(_repo)):
    currency = repo.get_currency(currency_id)
    if not currency:
        raise NotFoundError("Currency not found")
    return currency


@router.get("/countries", response_model=list[CountryResponse])
def list_countries(
    active_only: bool = Query(default=False),
    repo: MasterDataRepository = Depends(_repo),
):
    return repo.list_countries(active_only=active_only)


@router.get("/countries/{country_id}", response_model=CountryResponse)
def get_country(country_id: int, repo: MasterDataRepository = Depends(_repo)):
    country = repo.get_country(country_id)
    if not country:
        raise NotFoundError("Country not found")
    return country


@router.post("/countries", response_model=CountryResponse, status_code=201)
def create_country(data: CountryCreate, repo: MasterDataRepository = Depends(_repo)):
    return repo.create_country(data)


@router.put("/countries/{country_id}", response_model=CountryResponse)
def update_country(
    country_id: int,
    data: CountryUpdate,
    repo: MasterDataRepository = Depends(_repo),
):
    country = repo.update_country(country_id, data)
    if not country:
        raise NotFoundError("Country not found")
    return country


@router.delete("/countries/{country_id}", status_code=200)
def delete_country(country_id: int, repo: MasterDataRepository = Depends(_repo)):
    """Delete country only when no employees reference it."""
    return repo.delete_country(country_id)


@router.get("/departments", response_model=list[DepartmentResponse])
def list_departments(
    active_only: bool = Query(default=False),
    repo: MasterDataRepository = Depends(_repo),
):
    return repo.list_departments(active_only=active_only)


@router.get("/departments/{department_id}", response_model=DepartmentResponse)
def get_department(department_id: int, repo: MasterDataRepository = Depends(_repo)):
    dept = repo.get_department(department_id)
    if not dept:
        raise NotFoundError("Department not found")
    return dept


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(data: DepartmentCreate, repo: MasterDataRepository = Depends(_repo)):
    return repo.create_department(data)


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    data: DepartmentUpdate,
    repo: MasterDataRepository = Depends(_repo),
):
    dept = repo.update_department(department_id, data)
    if not dept:
        raise NotFoundError("Department not found")
    return dept


@router.delete("/departments/{department_id}", status_code=200)
def delete_department(department_id: int, repo: MasterDataRepository = Depends(_repo)):
    """Delete department only when no employees reference it."""
    return repo.delete_department(department_id)


@router.get("/job-levels", response_model=list[JobLevelResponse])
def list_job_levels(
    active_only: bool = Query(default=False),
    repo: MasterDataRepository = Depends(_repo),
):
    return repo.list_job_levels(active_only=active_only)


@router.get("/job-levels/{job_level_id}", response_model=JobLevelResponse)
def get_job_level(job_level_id: int, repo: MasterDataRepository = Depends(_repo)):
    level = repo.get_job_level(job_level_id)
    if not level:
        raise NotFoundError("Job level not found")
    return level


@router.post("/job-levels", response_model=JobLevelResponse, status_code=201)
def create_job_level(data: JobLevelCreate, repo: MasterDataRepository = Depends(_repo)):
    return repo.create_job_level(data)


@router.put("/job-levels/{job_level_id}", response_model=JobLevelResponse)
def update_job_level(
    job_level_id: int,
    data: JobLevelUpdate,
    repo: MasterDataRepository = Depends(_repo),
):
    level = repo.update_job_level(job_level_id, data)
    if not level:
        raise NotFoundError("Job level not found")
    return level


@router.delete("/job-levels/{job_level_id}", status_code=200)
def delete_job_level(job_level_id: int, repo: MasterDataRepository = Depends(_repo)):
    """Delete job level only when no employees reference it."""
    return repo.delete_job_level(job_level_id)
