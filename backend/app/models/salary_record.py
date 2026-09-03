from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import PaymentStatus, SalaryStatus


class SalaryRecord(Base):
    __tablename__ = "salary_records"
    __table_args__ = (
        Index("ix_salary_records_employee_id", "employee_id"),
        Index("ix_salary_records_effective_from", "effective_from"),
        Index("ix_salary_records_status", "status"),
        Index("ix_salary_records_employee_status", "employee_id", "status"),
        Index("ix_salary_records_currency_id", "currency_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    currency_id: Mapped[int] = mapped_column(ForeignKey("currencies.id"), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[SalaryStatus] = mapped_column(
        Enum(SalaryStatus, name="salary_status_enum"), nullable=False, default=SalaryStatus.ACTIVE
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum"),
        nullable=False,
        default=PaymentStatus.NOT_PAID,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["Employee"] = relationship(back_populates="salary_records")
    currency: Mapped["Currency"] = relationship(back_populates="salary_records")
    components: Mapped[list["SalaryRecordComponent"]] = relationship(
        back_populates="salary_record", cascade="all, delete-orphan"
    )
