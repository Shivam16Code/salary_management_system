from sqlalchemy.exc import IntegrityError

from app.exceptions import friendly_integrity_error, human_validation_detail


class _Orig:
    def __init__(self, message: str):
        self._message = message

    def __str__(self) -> str:
        return self._message


def test_postgres_duplicate_email_is_readable():
    orig = _Orig(
        'duplicate key value violates unique constraint "ix_employees_email"\n'
        "DETAIL: Key (email)=(sawan.patel@skedgroup.in) already exists."
    )
    message, details = friendly_integrity_error(IntegrityError("INSERT", {}, orig))
    assert message == "An employee with this email already exists."
    assert details == [{"field": "email", "message": message}]
    assert "duplicate key" not in message
    assert "ix_employees" not in message


def test_sqlite_duplicate_email_is_readable():
    orig = _Orig("UNIQUE constraint failed: employees.email")
    message, details = friendly_integrity_error(IntegrityError("INSERT", {}, orig))
    assert message == "An employee with this email already exists."
    assert details[0]["field"] == "email"


def test_missing_field_validation_is_readable():
    detail = human_validation_detail(
        {"type": "missing", "loc": ("body", "last_name"), "msg": "Field required"}
    )
    assert detail == {"field": "last_name", "message": "Last name is required."}
