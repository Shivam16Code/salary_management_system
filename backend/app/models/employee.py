from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import EmploymentStatus


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_country_id", "country_id"),
        Index("ix_employees_department_id", "department_id"),
        Index("ix_employees_job_level_id", "job_level_id"),
        Index("ix_employees_status", "employment_status"),
        Index("ix_employees_hire_date", "hire_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id"), nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    job_level_id: Mapped[int] = mapped_column(ForeignKey("job_levels.id"), nullable=False)
    job_title: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    employment_status: Mapped[EmploymentStatus] = mapped_column(
        Enum(EmploymentStatus, name="employment_status_enum"),
        nullable=False,
        default=EmploymentStatus.ACTIVE,
    )
    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    country: Mapped["Country"] = relationship(back_populates="employees")
    department: Mapped["Department"] = relationship(back_populates="employees")
    job_level: Mapped["JobLevel"] = relationship(back_populates="employees")
    salary_records: Mapped[list["SalaryRecord"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    salary_profiles: Mapped[list["EmployeeSalaryProfile"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
