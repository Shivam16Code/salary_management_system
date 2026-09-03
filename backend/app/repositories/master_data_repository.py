from sqlalchemy.orm import Session, joinedload

from app.models import Country, Currency, Department, JobLevel
from app.schemas.schemas import (
    CountryCreate,
    CountryUpdate,
    CurrencyCreate,
    CurrencyUpdate,
    DepartmentCreate,
    DepartmentUpdate,
    JobLevelCreate,
    JobLevelUpdate,
)
from app.services.currency_service import CurrencyService, CurrencyServiceError
from app.services.reference_data import get_country_reference


class MasterDataRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- Currencies ---

    def list_currencies(self, active_only: bool = False) -> list[Currency]:
        query = self.db.query(Currency)
        if active_only:
            query = query.filter(Currency.is_active.is_(True))
        return query.order_by(Currency.code).all()

    def get_currency(self, currency_id: int) -> Currency | None:
        return self.db.query(Currency).filter(Currency.id == currency_id).first()

    def get_currency_by_code(self, code: str) -> Currency | None:
        return self.db.query(Currency).filter(Currency.code == code.upper()).first()

    def create_currency(self, data: CurrencyCreate) -> Currency:
        currency = Currency(
            code=data.code.upper(),
            name=data.name,
            symbol=data.symbol,
            decimal_places=data.decimal_places,
            is_active=data.is_active,
        )
        self.db.add(currency)
        self.db.commit()
        self.db.refresh(currency)
        return currency

    def create_currency_from_reference(self, code: str) -> Currency:
        service = CurrencyService()
        try:
            references = service.fetch_reference_currencies()
        except CurrencyServiceError as exc:
            raise ValueError(str(exc)) from exc

        match = next((r for r in references if r["code"] == code.upper()), None)
        if not match:
            raise ValueError(f"Currency code '{code}' not found in reference data")

        existing = self.get_currency_by_code(match["code"])
        if existing:
            raise ValueError(f"Currency '{match['code']}' already exists")

        return self.create_currency(
            CurrencyCreate(
                code=match["code"],
                name=match["name"],
                symbol=match["symbol"],
                decimal_places=match["decimal_places"],
            )
        )

    def update_currency(self, currency_id: int, data: CurrencyUpdate) -> Currency | None:
        currency = self.get_currency(currency_id)
        if not currency:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(currency, field, value)
        self.db.commit()
        self.db.refresh(currency)
        return currency

    # --- Countries ---

    def list_countries(self, active_only: bool = False) -> list[Country]:
        query = self.db.query(Country).options(joinedload(Country.currency))
        if active_only:
            query = query.filter(Country.is_active.is_(True))
        return query.order_by(Country.name).all()

    def get_country(self, country_id: int) -> Country | None:
        return (
            self.db.query(Country)
            .options(joinedload(Country.currency))
            .filter(Country.id == country_id)
            .first()
        )

    def ensure_currency(self, currency_code: str) -> Currency:
        existing = self.get_currency_by_code(currency_code)
        if existing:
            return existing
        return self.create_currency_from_reference(currency_code)

    def create_country(self, data: CountryCreate) -> Country:
        ref = get_country_reference(data.iso_code)
        if not ref:
            raise ValueError(f"Country '{data.iso_code}' is not available in reference data")

        iso_code = ref["iso_code"]
        existing = (
            self.db.query(Country).filter(Country.iso_code == iso_code).first()
        )
        if existing:
            raise ValueError(f"Country '{iso_code}' already exists")

        currency = self.ensure_currency(ref["currency_code"])
        country = Country(
            iso_code=iso_code,
            name=ref["name"],
            currency_id=currency.id,
            is_active=data.is_active,
        )
        self.db.add(country)
        self.db.commit()
        return self.get_country(country.id)  # type: ignore[return-value]

    def update_country(self, country_id: int, data: CountryUpdate) -> Country | None:
        country = self.get_country(country_id)
        if not country:
            return None
        if data.is_active is not None:
            country.is_active = data.is_active
        self.db.commit()
        return self.get_country(country_id)

    # --- Departments ---

    def list_departments(self, active_only: bool = False) -> list[Department]:
        query = self.db.query(Department)
        if active_only:
            query = query.filter(Department.is_active.is_(True))
        return query.order_by(Department.name).all()

    def get_department(self, department_id: int) -> Department | None:
        return self.db.query(Department).filter(Department.id == department_id).first()

    def create_department(self, data: DepartmentCreate) -> Department:
        dept = Department(
            code=data.code.upper(),
            name=data.name,
            is_active=data.is_active,
        )
        self.db.add(dept)
        self.db.commit()
        self.db.refresh(dept)
        return dept

    def update_department(self, department_id: int, data: DepartmentUpdate) -> Department | None:
        dept = self.get_department(department_id)
        if not dept:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(dept, field, value)
        self.db.commit()
        self.db.refresh(dept)
        return dept

    def delete_department(self, department_id: int) -> dict:
        from app.exceptions import ConflictError, NotFoundError
        from app.models import Employee

        dept = self.get_department(department_id)
        if not dept:
            raise NotFoundError("Department not found")

        employee_count = (
            self.db.query(Employee).filter(Employee.department_id == department_id).count()
        )
        if employee_count > 0:
            raise ConflictError(
                f"Cannot delete department '{dept.code}' — {employee_count} employee(s) still assigned. "
                "Reassign employees first, or deactivate the department.",
                details=[{"field": "department_id", "message": f"{employee_count} employees reference it"}],
            )

        code = dept.code
        self.db.delete(dept)
        self.db.commit()
        return {"deleted": True, "department_id": department_id, "code": code}

    # --- Job Levels ---

    def list_job_levels(self, active_only: bool = False) -> list[JobLevel]:
        query = self.db.query(JobLevel)
        if active_only:
            query = query.filter(JobLevel.is_active.is_(True))
        return query.order_by(JobLevel.code).all()

    def get_job_level(self, job_level_id: int) -> JobLevel | None:
        return self.db.query(JobLevel).filter(JobLevel.id == job_level_id).first()

    def create_job_level(self, data: JobLevelCreate) -> JobLevel:
        level = JobLevel(
            code=data.code.upper(),
            name=data.name,
            description=data.description,
            is_active=data.is_active,
        )
        self.db.add(level)
        self.db.commit()
        self.db.refresh(level)
        return level

    def update_job_level(self, job_level_id: int, data: JobLevelUpdate) -> JobLevel | None:
        level = self.get_job_level(job_level_id)
        if not level:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(level, field, value)
        self.db.commit()
        self.db.refresh(level)
        return level

    def delete_job_level(self, job_level_id: int) -> dict:
        from app.exceptions import ConflictError, NotFoundError
        from app.models import Employee

        level = self.get_job_level(job_level_id)
        if not level:
            raise NotFoundError("Job level not found")

        employee_count = (
            self.db.query(Employee).filter(Employee.job_level_id == job_level_id).count()
        )
        if employee_count > 0:
            raise ConflictError(
                f"Cannot delete job level '{level.code}' — {employee_count} employee(s) still assigned. "
                "Reassign employees first, or deactivate the job level.",
                details=[{"field": "job_level_id", "message": f"{employee_count} employees reference it"}],
            )

        code = level.code
        self.db.delete(level)
        self.db.commit()
        return {"deleted": True, "job_level_id": job_level_id, "code": code}

    def delete_country(self, country_id: int) -> dict:
        from app.exceptions import ConflictError, NotFoundError
        from app.models import Employee

        country = self.get_country(country_id)
        if not country:
            raise NotFoundError("Country not found")

        employee_count = (
            self.db.query(Employee).filter(Employee.country_id == country_id).count()
        )
        if employee_count > 0:
            raise ConflictError(
                f"Cannot delete country '{country.iso_code}' — {employee_count} employee(s) still assigned. "
                "Reassign employees first, or deactivate the country.",
                details=[{"field": "country_id", "message": f"{employee_count} employees reference it"}],
            )

        iso = country.iso_code
        self.db.delete(country)
        self.db.commit()
        return {"deleted": True, "country_id": country_id, "iso_code": iso}
