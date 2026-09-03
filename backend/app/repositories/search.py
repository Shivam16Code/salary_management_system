"""Shared employee text-search filters."""

from __future__ import annotations

from sqlalchemy import ColumnElement, and_, or_

from app.models import Employee


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _contains(column, text: str) -> ColumnElement[bool]:
    return column.ilike(f"%{_escape_like(text)}%", escape="\\")


def _word_match(column, token: str) -> ColumnElement[bool]:
    """Match token as a whole word inside a text column (case-insensitive)."""
    t = _escape_like(token)
    return or_(
        column.ilike(t, escape="\\"),
        column.ilike(f"{t} %", escape="\\"),
        column.ilike(f"% {t}", escape="\\"),
        column.ilike(f"% {t} %", escape="\\"),
    )


def employee_text_search_filter(
    search: str,
    *,
    include_job_title: bool = True,
) -> ColumnElement[bool] | None:
    """Match employee code, email, names, and optionally job title.

    Supports full-name queries such as "Ada Lovelace" by comparing against
    concatenated first+last (and last+first), with whole-word token matching
    so "Ada" does not incorrectly match unrelated prefixes.
    """
    raw = (search or "").strip()
    if not raw:
        return None

    full_name = Employee.first_name + " " + Employee.last_name
    reverse_name = Employee.last_name + " " + Employee.first_name
    tokens = [token for token in raw.split() if token]

    clauses: list[ColumnElement[bool]] = [
        _contains(Employee.employee_code, raw),
        _contains(Employee.email, raw),
        _contains(Employee.first_name, raw),
        _contains(Employee.last_name, raw),
        _contains(full_name, raw),
        _contains(reverse_name, raw),
        _word_match(Employee.first_name, raw),
        _word_match(Employee.last_name, raw),
        _word_match(full_name, raw),
    ]
    if include_job_title:
        clauses.append(_contains(Employee.job_title, raw))

    if len(tokens) >= 2:
        clauses.append(and_(*[_word_match(full_name, token) for token in tokens]))
        clauses.append(and_(*[_word_match(reverse_name, token) for token in tokens]))
        clauses.append(
            and_(
                _word_match(Employee.first_name, tokens[0]),
                _word_match(Employee.last_name, tokens[-1]),
            )
        )
        clauses.append(
            and_(
                _word_match(Employee.first_name, tokens[-1]),
                _word_match(Employee.last_name, tokens[0]),
            )
        )

    return or_(*clauses)
