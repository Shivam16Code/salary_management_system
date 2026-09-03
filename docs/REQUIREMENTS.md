# Salary Management System — Requirements (One Page)

## Goal
Replace ACME's Excel-based salary management with a web application so HR Managers can manage, search, and analyze compensation for ~10,000 employees across multiple countries and currencies.

## Scope & Features

| Area | In Scope |
|------|----------|
| **Employee Management** | CRUD-lite view; ID, name, email, country, department, job level/title, status, hire date |
| **Salary Records** | Effective-dated records; earnings & deductions via configurable components |
| **Salary Components** | EARNING / DEDUCTION types; FIXED / PERCENTAGE / PER_UNIT calculation methods |
| **Multi-Currency** | Store salaries in original currency; normalize to reporting currency via Frankfurter API |
| **Search & Filter** | Server-side search, filter (country, dept, level, title, currency, salary range, status), sort, pagination |
| **Analytics** | Avg, median, min, max, total compensation; breakdown by country, department, job level |
| **Salary History** | Historical effective-dated records preserved; current salary derived from active record |
| **Seeding** | Deterministic seed of 10,000 employees with realistic salary distributions |

## Deliberately Out of Scope

- Full payroll processing, tax/statutory engines, bank payments
- Attendance, leave, recruitment, performance, benefits modules
- Live exchange-rate APIs (Frankfurter API used for reporting conversion)
- Authentication/authorization (MVP assumes trusted HR user; can be added later)
- Microservices (modular monolith is sufficient for 10K records)

## Reasoning

The assessment focuses on **salary data management and compensation insights**, not a complete HRMS. Excluding payroll execution and auth keeps the MVP focused on correctness, performance (server-side pagination/filtering), testability, and product value for the HR Manager persona.

## Success Criteria

HR Manager can search/filter 10K employees, view and update salary records with history, analyze org-wide compensation in a chosen reporting currency, and trust results via automated tests and deterministic seed data.
