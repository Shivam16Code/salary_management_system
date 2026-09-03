from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SalaryRecordComponent(Base):
    __tablename__ = "salary_record_components"
    __table_args__ = (
        UniqueConstraint("salary_record_id", "salary_component_id", name="uq_record_component"),
        Index("ix_salary_record_components_record_id", "salary_record_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    salary_record_id: Mapped[int] = mapped_column(
        ForeignKey("salary_records.id", ondelete="CASCADE"), nullable=False
    )
    salary_component_id: Mapped[int] = mapped_column(
        ForeignKey("salary_components.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    units: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    salary_record: Mapped["SalaryRecord"] = relationship(back_populates="components")
    salary_component: Mapped["SalaryComponent"] = relationship(back_populates="record_components")
