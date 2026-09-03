from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import PayFrequency, SalaryStatus


class EmployeeSalaryProfile(Base):
    """Versioned base salary profile — archived rows preserve history when pay changes."""

    __tablename__ = "employee_salary_profiles"
    __table_args__ = (
        Index("ix_esp_employee_id", "employee_id"),
        Index("ix_esp_effective_from", "effective_from"),
        Index("ix_esp_employee_status", "employee_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    currency_id: Mapped[int] = mapped_column(ForeignKey("currencies.id"), nullable=False)
    package_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    pay_frequency: Mapped[PayFrequency] = mapped_column(
        Enum(PayFrequency, name="pay_frequency_enum"), nullable=False
    )
    annual_package: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    base_salary: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[SalaryStatus] = mapped_column(
        Enum(SalaryStatus, name="salary_status_enum", create_type=False),
        nullable=False,
        default=SalaryStatus.ACTIVE,
    )
    change_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["Employee"] = relationship(back_populates="salary_profiles")
    currency: Mapped["Currency"] = relationship()
