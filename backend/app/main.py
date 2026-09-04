from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    analytics,
    employees,
    exchange_rates,
    master_data,
    salaries,
    salary_components,
    salary_profiles,
)
from app.config import settings
from app.exceptions import register_exception_handlers

app = FastAPI(
    title="ACME Salary Management System",
    description="Employee salary management for HR Managers",
    version="1.0.0",
)

register_exception_handlers(app)


@app.on_event("startup")
def apply_schema_updates() -> None:
    from app.seed.seed_data import backfill_payment_status, ensure_payment_status_column

    ensure_payment_status_column()
    backfill_payment_status()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employees.router, prefix="/api/v1")
app.include_router(salary_profiles.router, prefix="/api/v1")
app.include_router(salaries.router, prefix="/api/v1")
app.include_router(salary_components.router, prefix="/api/v1")
app.include_router(master_data.router, prefix="/api/v1")
app.include_router(exchange_rates.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "salary-management"}
