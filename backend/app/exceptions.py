"""Central application errors and FastAPI exception handlers.

All API error responses use a consistent envelope:

{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Human-readable summary",
    "details": [{"field": "email", "message": "..."}],  # optional
    "path": "/api/v1/employees/1"
  }
}
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.services.currency_service import CurrencyServiceError

FIELD_LABELS: dict[str, str] = {
    "first_name": "First name",
    "last_name": "Last name",
    "email": "Email",
    "employee_code": "Employee code",
    "country_id": "Country",
    "department_id": "Department",
    "job_level_id": "Job level",
    "job_title": "Job title",
    "hire_date": "Hire date",
    "employment_status": "Status",
    "iso_code": "Country code",
    "code": "Code",
    "name": "Name",
    "symbol": "Symbol",
    "currency_id": "Currency",
    "package_amount": "Package amount",
    "pay_frequency": "Pay frequency",
    "effective_from": "Start date",
    "effective_to": "End date",
    "amount": "Amount",
    "units": "Units",
    "salary_component_id": "Salary component",
}

_UNIQUE_BY_CONSTRAINT: dict[str, tuple[str, str]] = {
    "ix_employees_email": ("email", "An employee with this email already exists."),
    "employees_email_key": ("email", "An employee with this email already exists."),
    "ix_employees_employee_code": (
        "employee_code",
        "An employee with this employee code already exists.",
    ),
    "employees_employee_code_key": (
        "employee_code",
        "An employee with this employee code already exists.",
    ),
    "ix_departments_code": ("code", "A department with this code already exists."),
    "departments_code_key": ("code", "A department with this code already exists."),
    "ix_job_levels_code": ("code", "A job level with this code already exists."),
    "job_levels_code_key": ("code", "A job level with this code already exists."),
    "ix_currencies_code": ("code", "A currency with this code already exists."),
    "currencies_code_key": ("code", "A currency with this code already exists."),
    "ix_countries_iso_code": ("iso_code", "A country with this ISO code already exists."),
    "countries_iso_code_key": ("iso_code", "A country with this ISO code already exists."),
    "ix_salary_components_code": ("code", "A salary component with this code already exists."),
    "salary_components_code_key": ("code", "A salary component with this code already exists."),
    "uq_record_component": (
        "salary_component_id",
        "This salary component is already on this salary record.",
    ),
}

_UNIQUE_BY_TABLE_COLUMN: dict[tuple[str, str], tuple[str, str]] = {
    ("employees", "email"): ("email", "An employee with this email already exists."),
    ("employees", "employee_code"): (
        "employee_code",
        "An employee with this employee code already exists.",
    ),
    ("departments", "code"): ("code", "A department with this code already exists."),
    ("job_levels", "code"): ("code", "A job level with this code already exists."),
    ("currencies", "code"): ("code", "A currency with this code already exists."),
    ("countries", "iso_code"): ("iso_code", "A country with this ISO code already exists."),
    ("salary_components", "code"): ("code", "A salary component with this code already exists."),
}

_FK_TABLE_MESSAGES: dict[str, str] = {
    "employees": "This item is still assigned to employees and cannot be deleted.",
    "salary_records": "This item is still used by salary records and cannot be deleted.",
    "salary_record_components": "This item is still used on salary records and cannot be deleted.",
    "employee_salary_profiles": "This item is still used by salary profiles and cannot be deleted.",
    "countries": "This item is still used by a country and cannot be deleted.",
}


def _field_label(field: str) -> str:
    key = field.split(".")[-1] if field else ""
    if key in FIELD_LABELS:
        return FIELD_LABELS[key]
    if key.isdigit():
        return "This field"
    return key.replace("_", " ").capitalize() if key else "This field"


def human_validation_detail(err: dict[str, Any]) -> dict[str, Any]:
    loc = err.get("loc", ())
    field = ".".join(str(p) for p in loc if p not in ("body", "query", "path"))
    label = _field_label(field)
    err_type = str(err.get("type") or "")
    ctx = err.get("ctx") or {}

    if err_type == "missing":
        message = f"{label} is required."
    elif err_type == "string_too_short":
        min_len = ctx.get("min_length")
        message = (
            f"{label} must be at least {min_len} characters."
            if min_len
            else f"{label} is too short."
        )
    elif err_type == "string_too_long":
        max_len = ctx.get("max_length")
        message = (
            f"{label} must be at most {max_len} characters."
            if max_len
            else f"{label} is too long."
        )
    elif "email" in err_type or field.endswith("email"):
        message = "Enter a valid email address."
    elif err_type in {"int_parsing", "int_type"}:
        message = f"{label} must be a whole number."
    elif err_type in {"float_parsing", "decimal_parsing", "decimal_type"}:
        message = f"{label} must be a number."
    elif err_type == "greater_than":
        message = f"{label} must be greater than {ctx.get('gt', 0)}."
    elif err_type == "greater_than_equal":
        message = f"{label} must be at least {ctx.get('ge', 0)}."
    elif err_type == "less_than_equal":
        message = f"{label} must be at most {ctx.get('le', 0)}."
    elif err_type in {"date_from_datetime_parsing", "date_type", "date_parsing"}:
        message = f"{label} must be a valid date."
    elif err_type in {"literal_error", "enum"}:
        message = f"{label} is not a valid choice."
    else:
        raw = str(err.get("msg") or "Invalid value")
        raw = re.sub(r"^Value error,\s*", "", raw, flags=re.I)
        if raw.lower() == "field required":
            message = f"{label} is required."
        else:
            message = raw if raw.endswith(".") else f"{raw}."

    return {"field": field or "body", "message": message}


def friendly_integrity_error(exc: IntegrityError) -> tuple[str, list[dict[str, Any]]]:
    """Turn a database integrity error into a user-facing message. Never include SQL."""
    raw = str(getattr(exc, "orig", None) or exc)

    constraint_match = re.search(r'unique constraint ["\']([A-Za-z0-9_]+)["\']', raw, re.I)
    constraint = constraint_match.group(1).lower() if constraint_match else None

    sqlite_match = re.search(r"unique constraint failed:\s*(\w+)\.(\w+)", raw, re.I)
    table = sqlite_match.group(1).lower() if sqlite_match else None
    column = sqlite_match.group(2).lower() if sqlite_match else None

    pg_key = re.search(r"Key \(([A-Za-z0-9_, ]+)\)=", raw)
    if pg_key and not column:
        column = pg_key.group(1).split(",")[0].strip().lower()

    mapped: tuple[str, str] | None = None
    if constraint and constraint in _UNIQUE_BY_CONSTRAINT:
        mapped = _UNIQUE_BY_CONSTRAINT[constraint]
    elif table and column and (table, column) in _UNIQUE_BY_TABLE_COLUMN:
        mapped = _UNIQUE_BY_TABLE_COLUMN[(table, column)]
    elif column and column in {"email", "employee_code", "iso_code"}:
        field, message = _UNIQUE_BY_TABLE_COLUMN.get(
            ("employees", column),
            (column, f"This {_field_label(column).lower()} is already in use."),
        )
        mapped = (field, message)

    lower = raw.lower()
    if mapped and ("unique" in lower or "duplicate" in lower or "already exists" in lower):
        field, message = mapped
        return message, [{"field": field, "message": message}]

    if "unique" in lower or "duplicate" in lower:
        return "This value is already in use. Please choose a different one.", []

    fk_table = re.search(r'referenced from table ["\']?(\w+)', raw, re.I)
    if "foreign key" in lower or "still referenced" in lower or fk_table:
        table_name = fk_table.group(1).lower() if fk_table else ""
        message = _FK_TABLE_MESSAGES.get(
            table_name,
            "This item is still in use and cannot be deleted.",
        )
        return message, []

    null_col = re.search(r'null value in column ["\']?(\w+)', raw, re.I)
    if null_col or "not-null" in lower or "not null" in lower:
        field = null_col.group(1) if null_col else ""
        label = _field_label(field) if field else "A required field"
        return f"{label} is required.", [{"field": field, "message": f"{label} is required."}] if field else []

    return "This change could not be saved because it conflicts with existing data.", []


class AppError(Exception):
    """Base application error with HTTP status and machine-readable code."""

    status_code: int = 400
    code: str = "BAD_REQUEST"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: list[dict[str, Any]] | None = None,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.details = details or []
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class ValidationAppError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


class BadRequestError(AppError):
    status_code = 400
    code = "BAD_REQUEST"


class ExternalServiceError(AppError):
    status_code = 502
    code = "EXTERNAL_SERVICE_ERROR"


def error_body(
    *,
    code: str,
    message: str,
    path: str,
    details: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details or [],
            "path": path,
        },
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(
                code=exc.code,
                message=exc.message,
                path=str(request.url.path),
                details=exc.details,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [human_validation_detail(err) for err in exc.errors()]
        if len(details) == 1:
            message = details[0]["message"]
        else:
            message = "Please fix the highlighted fields and try again."
        return JSONResponse(
            status_code=422,
            content=error_body(
                code="VALIDATION_ERROR",
                message=message,
                path=str(request.url.path),
                details=details,
            ),
        )

    @app.exception_handler(CurrencyServiceError)
    async def currency_error_handler(
        request: Request, exc: CurrencyServiceError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content=error_body(
                code="EXTERNAL_SERVICE_ERROR",
                message=str(exc) or "Currency exchange service failed",
                path=str(request.url.path),
            ),
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        message, details = friendly_integrity_error(exc)
        return JSONResponse(
            status_code=409,
            content=error_body(
                code="CONFLICT",
                message=message,
                path=str(request.url.path),
                details=details,
            ),
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content=error_body(
                code="BAD_REQUEST",
                message=str(exc) or "Invalid request",
                path=str(request.url.path),
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=error_body(
                code="INTERNAL_ERROR",
                message="An unexpected server error occurred. Please try again later.",
                path=str(request.url.path),
            ),
        )
