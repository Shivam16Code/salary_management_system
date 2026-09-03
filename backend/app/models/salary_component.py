from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import CalculationMethod, ComponentType


class SalaryComponent(Base):
    __tablename__ = "salary_components"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    component_type: Mapped[ComponentType] = mapped_column(
        Enum(ComponentType, name="component_type_enum"), nullable=False
    )
    calculation_method: Mapped[CalculationMethod] = mapped_column(
        Enum(CalculationMethod, name="calculation_method_enum"), nullable=False
    )
    is_taxable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    record_components: Mapped[list["SalaryRecordComponent"]] = relationship(
        back_populates="salary_component"
    )
