"""Seed script for ACME Salary Management System — generates 10,000 employees."""

import random
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from faker import Faker
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import (
    CalculationMethod,
    ComponentType,
    Country,
    Currency,
    Department,
    Employee,
    EmployeeSalaryProfile,
    EmploymentStatus,
    JobLevel,
    PayFrequency,
    SalaryComponent,
    PaymentStatus,
    SalaryRecord,
    SalaryRecordComponent,
    SalaryStatus,
)
from app.services.salary_profile_calculator import (
    annual_package_from,
    monthly_base_from,
    per_period_amount_from_annual,
)

SEED = settings.seed_random_seed
EMPLOYEE_COUNT = 10_000
# App "today" for payroll seed — records generated through this date
PAYROLL_THROUGH = date(2026, 9, 2)
RECORDS_FROM = date(2025, 1, 1)

CURRENCIES = [
    ("INR", "Indian Rupee", "₹", 2),
    ("USD", "US Dollar", "$", 2),
    ("GBP", "British Pound", "£", 2),
    ("EUR", "Euro", "€", 2),
    ("AUD", "Australian Dollar", "A$", 2),
    ("CAD", "Canadian Dollar", "C$", 2),
    ("SGD", "Singapore Dollar", "S$", 2),
    ("JPY", "Japanese Yen", "¥", 0),
]

COUNTRIES = [
    ("IND", "India", "INR"),
    ("USA", "United States", "USD"),
    ("GBR", "United Kingdom", "GBP"),
    ("DEU", "Germany", "EUR"),
    ("AUS", "Australia", "AUD"),
    ("CAN", "Canada", "CAD"),
    ("SGP", "Singapore", "SGD"),
    ("JPN", "Japan", "JPY"),
]

DEPARTMENTS = [
    ("ENG", "Engineering"),
    ("PROD", "Product"),
    ("SALES", "Sales"),
    ("MKT", "Marketing"),
    ("HR", "Human Resources"),
    ("FIN", "Finance"),
    ("OPS", "Operations"),
    ("LEGAL", "Legal"),
    ("CS", "Customer Success"),
    ("DATA", "Data & Analytics"),
]

JOB_LEVELS = [
    ("L1", "Intern", "Entry-level internship role"),
    ("L2", "Junior", "Junior individual contributor"),
    ("L3", "Mid-Level", "Mid-level professional"),
    ("L4", "Senior", "Senior individual contributor"),
    ("L5", "Staff", "Staff-level expert"),
    ("L6", "Principal", "Principal-level expert"),
    ("L7", "Director", "People management — director"),
    ("L8", "VP", "Executive leadership — vice president"),
]

LEVEL_RANK = {code: int(code[1:]) for code, _, _ in JOB_LEVELS}

JOB_TITLES = {
    "ENG": ["Software Engineer", "Backend Developer", "Frontend Developer", "DevOps Engineer", "QA Engineer"],
    "PROD": ["Product Manager", "Product Analyst", "Product Designer", "UX Researcher"],
    "SALES": ["Account Executive", "Sales Manager", "Business Development Rep"],
    "MKT": ["Marketing Manager", "Content Strategist", "Brand Manager"],
    "HR": ["HR Business Partner", "Recruiter", "Compensation Analyst"],
    "FIN": ["Financial Analyst", "Accountant", "Controller"],
    "OPS": ["Operations Manager", "Supply Chain Analyst"],
    "LEGAL": ["Legal Counsel", "Compliance Officer"],
    "CS": ["Customer Success Manager", "Support Engineer"],
    "DATA": ["Data Scientist", "Data Engineer", "Analytics Engineer"],
}

SALARY_COMPONENTS = [
    ("BASIC", "Basic Salary", ComponentType.EARNING, CalculationMethod.FIXED, True),
    ("HRA", "HRA", ComponentType.EARNING, CalculationMethod.PERCENTAGE, True),
    ("BONUS", "Bonus", ComponentType.EARNING, CalculationMethod.FIXED, True),
    ("ALLOWANCE", "Allowance", ComponentType.EARNING, CalculationMethod.FIXED, True),
    ("OVERTIME", "Overtime", ComponentType.EARNING, CalculationMethod.PER_UNIT, True),
    ("UNPAID_LEAVE", "Unpaid Leave", ComponentType.DEDUCTION, CalculationMethod.FIXED, False),
    ("OTHER_DED", "Other Salary Deduction", ComponentType.DEDUCTION, CalculationMethod.FIXED, False),
]

# Base salary ranges by country currency and job level (annual)
BASE_SALARY_RANGES = {
    "INR": {1: (300000, 600000), 2: (600000, 1200000), 3: (1200000, 2000000), 4: (2000000, 3500000),
            5: (3500000, 5000000), 6: (5000000, 8000000), 7: (8000000, 12000000), 8: (12000000, 20000000)},
    "USD": {1: (35000, 55000), 2: (55000, 85000), 3: (85000, 130000), 4: (130000, 180000),
            5: (180000, 250000), 6: (250000, 350000), 7: (350000, 500000), 8: (500000, 800000)},
    "GBP": {1: (22000, 35000), 2: (35000, 55000), 3: (55000, 85000), 4: (85000, 120000),
            5: (120000, 170000), 6: (170000, 240000), 7: (240000, 350000), 8: (350000, 550000)},
    "EUR": {1: (28000, 42000), 2: (42000, 65000), 3: (65000, 95000), 4: (95000, 135000),
            5: (135000, 190000), 6: (190000, 270000), 7: (270000, 390000), 8: (390000, 600000)},
    "AUD": {1: (45000, 65000), 2: (65000, 95000), 3: (95000, 140000), 4: (140000, 190000),
            5: (190000, 260000), 6: (260000, 360000), 7: (360000, 520000), 8: (520000, 800000)},
    "CAD": {1: (40000, 60000), 2: (60000, 90000), 3: (90000, 130000), 4: (130000, 175000),
            5: (175000, 240000), 6: (240000, 330000), 7: (330000, 480000), 8: (480000, 750000)},
    "SGD": {1: (36000, 54000), 2: (54000, 84000), 3: (84000, 120000), 4: (120000, 168000),
            5: (168000, 228000), 6: (228000, 312000), 7: (312000, 456000), 8: (456000, 720000)},
    "JPY": {1: (2500000, 4000000), 2: (4000000, 6500000), 3: (6500000, 10000000), 4: (10000000, 14000000),
            5: (14000000, 20000000), 6: (20000000, 28000000), 7: (28000000, 40000000), 8: (40000000, 65000000)},
}


def month_end(d: date) -> date:
    if d.month == 12:
        return date(d.year, 12, 31)
    return date(d.year, d.month + 1, 1) - timedelta(days=1)


def next_month_start(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def quarter_start(d: date) -> date:
    month = ((d.month - 1) // 3) * 3 + 1
    return date(d.year, month, 1)


def quarter_end(d: date) -> date:
    start = quarter_start(d)
    if start.month == 10:
        return date(start.year, 12, 31)
    return date(start.year, start.month + 3, 1) - timedelta(days=1)


def next_quarter_start(d: date) -> date:
    start = quarter_start(d)
    if start.month == 10:
        return date(start.year + 1, 1, 1)
    return date(start.year, start.month + 3, 1)


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def pick_pay_frequency(rng: random.Random, level_rank: int) -> PayFrequency:
    """Assign pay frequency by seniority — execs yearly/quarterly, juniors weekly/monthly."""
    if level_rank >= 7:
        weights = [0.05, 0.35, 0.40, 0.20]
    elif level_rank <= 2:
        weights = [0.28, 0.58, 0.10, 0.04]
    else:
        weights = [0.14, 0.66, 0.15, 0.05]
    return rng.choices(
        [PayFrequency.WEEKLY, PayFrequency.MONTHLY, PayFrequency.QUARTERLY, PayFrequency.YEARLY],
        weights=weights,
    )[0]


def iter_monthly_periods(range_start: date, range_end: date):
    current = date(range_start.year, range_start.month, 1)
    while current <= range_end:
        period_end = month_end(current)
        if period_end >= range_start:
            yield current, period_end
        current = next_month_start(current)


def iter_weekly_periods(range_start: date, range_end: date):
    current = week_start(range_start)
    if current < range_start:
        current += timedelta(days=7)
    while current <= range_end:
        period_end = current + timedelta(days=6)
        if period_end >= range_start:
            yield current, period_end
        current += timedelta(days=7)


def iter_quarterly_periods(range_start: date, range_end: date):
    current = quarter_start(range_start)
    while current <= range_end:
        period_end = quarter_end(current)
        if period_end >= range_start:
            yield current, period_end
        current = next_quarter_start(current)


def iter_yearly_periods(range_start: date, range_end: date):
    for year in range(range_start.year, range_end.year + 1):
        period_start = date(year, 1, 1)
        period_end = date(year, 12, 31)
        if period_end >= range_start and period_start <= range_end:
            yield period_start, period_end


def iter_pay_periods(frequency: PayFrequency, range_start: date, range_end: date):
    if range_start > range_end:
        return
    if frequency == PayFrequency.WEEKLY:
        yield from iter_weekly_periods(range_start, range_end)
    elif frequency == PayFrequency.MONTHLY:
        yield from iter_monthly_periods(range_start, range_end)
    elif frequency == PayFrequency.QUARTERLY:
        yield from iter_quarterly_periods(range_start, range_end)
    elif frequency == PayFrequency.YEARLY:
        yield from iter_yearly_periods(range_start, range_end)


def payment_status_for_period(rng: random.Random, period_end: date) -> PaymentStatus:
    """Older closed periods are mostly paid; recent periods mix paid / not paid."""
    if period_end < PAYROLL_THROUGH - timedelta(days=21):
        return PaymentStatus.PAID if rng.random() < 0.93 else PaymentStatus.NOT_PAID
    return PaymentStatus.PAID if rng.random() < 0.68 else PaymentStatus.NOT_PAID


def create_salary_profile(
    db: Session,
    employee_id: int,
    currency_id: int,
    package_amount: Decimal,
    frequency: PayFrequency,
    effective_from: date,
    effective_to: date | None,
    status: SalaryStatus,
    change_reason: str | None = None,
) -> EmployeeSalaryProfile:
    profile = EmployeeSalaryProfile(
        employee_id=employee_id,
        currency_id=currency_id,
        package_amount=package_amount,
        pay_frequency=frequency,
        annual_package=annual_package_from(package_amount, frequency),
        base_salary=monthly_base_from(package_amount, frequency),
        effective_from=effective_from,
        effective_to=effective_to,
        status=status,
        change_reason=change_reason,
    )
    db.add(profile)
    return profile


def create_period_salary_records(
    db: Session,
    employee_id: int,
    currency_id: int,
    per_period_amount: Decimal,
    frequency: PayFrequency,
    component_map: dict,
    rng: random.Random,
    range_start: date,
    range_end: date,
    *,
    active_last: bool = True,
) -> int:
    """Create one salary record per pay period; returns count created."""
    periods = list(iter_pay_periods(frequency, range_start, range_end))
    if not periods:
        return 0

    pending_records: list[SalaryRecord] = []
    for idx, (period_start, period_end) in enumerate(periods):
        is_current = active_last and idx == len(periods) - 1
        record = SalaryRecord(
            employee_id=employee_id,
            currency_id=currency_id,
            effective_from=period_start,
            effective_to=period_end,
            status=SalaryStatus.ACTIVE if is_current else SalaryStatus.INACTIVE,
            payment_status=payment_status_for_period(rng, period_end),
        )
        db.add(record)
        pending_records.append(record)

    db.flush()

    for record in pending_records:
        for row in generate_salary_components_for_record(
            record, per_period_amount, component_map, rng
        ):
            db.add(row)

    return len(pending_records)


def seed_master_data(db: Session) -> dict:
    """Seed currencies, countries, departments, job levels, salary components."""
    currency_map = {}
    for code, name, symbol, decimal_places in CURRENCIES:
        cur = Currency(
            code=code, name=name, symbol=symbol, decimal_places=decimal_places, is_active=True
        )
        db.add(cur)
        db.flush()
        currency_map[code] = cur

    country_map = {}
    for iso_code, name, currency_code in COUNTRIES:
        c = Country(
            iso_code=iso_code,
            name=name,
            currency_id=currency_map[currency_code].id,
            is_active=True,
        )
        db.add(c)
        db.flush()
        country_map[iso_code] = c

    dept_map = {}
    for code, name in DEPARTMENTS:
        d = Department(code=code, name=name, is_active=True)
        db.add(d)
        db.flush()
        dept_map[code] = d

    level_map = {}
    for code, name, description in JOB_LEVELS:
        jl = JobLevel(code=code, name=name, description=description, is_active=True)
        db.add(jl)
        db.flush()
        level_map[code] = jl

    component_map = {}
    for code, name, ctype, method, taxable in SALARY_COMPONENTS:
        sc = SalaryComponent(
            code=code,
            name=name,
            component_type=ctype,
            calculation_method=method,
            is_taxable=taxable,
            is_active=True,
        )
        db.add(sc)
        db.flush()
        component_map[code] = sc

    db.commit()
    return {
        "countries": country_map,
        "currencies": currency_map,
        "departments": dept_map,
        "job_levels": level_map,
        "components": component_map,
    }


def generate_salary_components_for_record(
    record: SalaryRecord,
    basic_amount: Decimal,
    component_map: dict,
    rng: random.Random,
) -> list[SalaryRecordComponent]:
    """Build component rows for a salary record (caller adds to session)."""
    rows: list[SalaryRecordComponent] = []
    basic_comp = component_map["BASIC"]
    rows.append(
        SalaryRecordComponent(
            salary_record_id=record.id,
            salary_component_id=basic_comp.id,
            amount=basic_amount,
        )
    )
    rows.append(
        SalaryRecordComponent(
            salary_record_id=record.id,
            salary_component_id=component_map["HRA"].id,
            amount=Decimal("40"),
        )
    )
    bonus_pct = Decimal(str(rng.uniform(0.10, 0.20)))
    rows.append(
        SalaryRecordComponent(
            salary_record_id=record.id,
            salary_component_id=component_map["BONUS"].id,
            amount=(basic_amount * bonus_pct).quantize(Decimal("1")),
        )
    )
    rows.append(
        SalaryRecordComponent(
            salary_record_id=record.id,
            salary_component_id=component_map["ALLOWANCE"].id,
            amount=Decimal(str(rng.randint(5000, 50000))),
        )
    )
    if rng.random() < 0.15:
        rows.append(
            SalaryRecordComponent(
                salary_record_id=record.id,
                salary_component_id=component_map["UNPAID_LEAVE"].id,
                amount=Decimal(str(rng.randint(1000, 20000))),
            )
        )
    return rows


def generate_salary_components(
    db: Session,
    record: SalaryRecord,
    basic_amount: Decimal,
    component_map: dict,
    rng: random.Random,
) -> None:
    """Generate salary record components for an employee."""
    for row in generate_salary_components_for_record(record, basic_amount, component_map, rng):
        db.add(row)


def seed_employees(db: Session, master: dict, count: int = EMPLOYEE_COUNT) -> None:
    """Seed employees with frequency-based salary profiles and period salary records."""
    faker = Faker()
    rng = random.Random(SEED)
    Faker.seed(SEED)

    country_codes = list(master["countries"].keys())
    country_weights = [0.35, 0.25, 0.10, 0.08, 0.06, 0.05, 0.05, 0.06]
    dept_codes = list(master["departments"].keys())
    level_codes = list(master["job_levels"].keys())
    level_weights = [0.05, 0.15, 0.30, 0.25, 0.12, 0.07, 0.04, 0.02]
    frequency_counts: dict[str, int] = {f.value: 0 for f in PayFrequency}

    batch_size = 500
    for batch_start in range(0, count, batch_size):
        batch_end = min(batch_start + batch_size, count)
        for i in range(batch_start, batch_end):
            emp_num = i + 1
            country_code = rng.choices(country_codes, weights=country_weights)[0]
            country = master["countries"][country_code]
            currency = country.currency
            currency_code = currency.code
            dept_code = rng.choice(dept_codes)
            dept = master["departments"][dept_code]
            level_code = rng.choices(level_codes, weights=level_weights)[0]
            level = master["job_levels"][level_code]
            job_title = rng.choice(JOB_TITLES[dept_code])
            level_rank = LEVEL_RANK[level.code]

            hire_date = faker.date_between(start_date=date(2015, 1, 1), end_date=date(2026, 8, 15))
            status = EmploymentStatus.ACTIVE if rng.random() < 0.92 else rng.choice(
                [EmploymentStatus.INACTIVE, EmploymentStatus.TERMINATED, EmploymentStatus.ON_LEAVE]
            )

            employee = Employee(
                employee_code=f"EMP{emp_num:05d}",
                first_name=faker.first_name(),
                last_name=faker.last_name(),
                email=f"emp{emp_num:05d}@acme.com",
                country_id=country.id,
                department_id=dept.id,
                job_level_id=level.id,
                job_title=job_title,
                employment_status=status,
                hire_date=hire_date,
            )
            db.add(employee)
            db.flush()

            sal_range = BASE_SALARY_RANGES[currency_code][level_rank]
            annual = Decimal(str(rng.randint(sal_range[0], sal_range[1])))
            frequency = pick_pay_frequency(rng, level_rank)
            frequency_counts[frequency.value] += 1
            package_amount = per_period_amount_from_annual(annual, frequency)

            if status != EmploymentStatus.ACTIVE:
                range_lo = max(hire_date, RECORDS_FROM)
                range_hi = min(PAYROLL_THROUGH, date(2026, 6, 30))
                records_end = (
                    faker.date_between(start_date=range_lo, end_date=range_hi)
                    if range_lo <= range_hi
                    else range_lo
                )
            else:
                records_end = PAYROLL_THROUGH

            records_start = max(hire_date, RECORDS_FROM)
            if frequency == PayFrequency.WEEKLY:
                # Weekly periods are denser — seed from 2026 only to keep volume manageable
                records_start = max(records_start, date(2026, 1, 1))
            if records_start > records_end:
                records_end = records_start
            profile_from = records_start
            first_periods = list(iter_pay_periods(frequency, records_start, records_end))
            if first_periods:
                profile_from = first_periods[0][0]

            # Prior package & records (~25% of employees) — before current package
            if rng.random() < 0.25 and records_start > date(2024, 1, 1):
                old_annual = (annual * Decimal(str(rng.uniform(0.78, 0.92)))).quantize(Decimal("1"))
                old_package = per_period_amount_from_annual(old_annual, frequency)
                hist_end = profile_from - timedelta(days=1)
                hist_start = max(hire_date, date(2024, 1, 1))
                hist_periods = list(iter_pay_periods(frequency, hist_start, hist_end))
                if hist_periods:
                    hist_from = hist_periods[0][0]
                    create_salary_profile(
                        db,
                        employee.id,
                        currency.id,
                        old_package,
                        frequency,
                        hist_from,
                        hist_end,
                        SalaryStatus.INACTIVE,
                        change_reason="Previous package",
                    )
                    create_period_salary_records(
                        db,
                        employee.id,
                        currency.id,
                        old_package,
                        frequency,
                        master["components"],
                        rng,
                        hist_start,
                        hist_end,
                        active_last=False,
                    )

            create_salary_profile(
                db,
                employee.id,
                currency.id,
                package_amount,
                frequency,
                profile_from,
                None,
                SalaryStatus.ACTIVE,
            )

            create_period_salary_records(
                db,
                employee.id,
                currency.id,
                package_amount,
                frequency,
                master["components"],
                rng,
                records_start,
                records_end,
            )

        db.commit()
        print(f"  Seeded employees {batch_start + 1}–{batch_end} / {count}")

    print("  Pay frequency mix:", ", ".join(f"{k}={v}" for k, v in frequency_counts.items()))


def ensure_payment_status_column() -> None:
    """Add payment_status column for databases created before this field existed."""
    from sqlalchemy import inspect, text

    if engine.dialect.name != "postgresql":
        return

    inspector = inspect(engine)
    if "salary_records" not in inspector.get_table_names():
        return
    if any(col["name"] == "payment_status" for col in inspector.get_columns("salary_records")):
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                DO $$ BEGIN
                    CREATE TYPE payment_status_enum AS ENUM ('PAID', 'NOT_PAID');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE salary_records
                ADD COLUMN payment_status payment_status_enum
                NOT NULL DEFAULT 'NOT_PAID';
                """
            )
        )


def backfill_payment_status() -> None:
    """Assign mixed PAID/NOT_PAID values for analytics demos on existing rows."""
    if engine.dialect.name != "postgresql":
        return

    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "salary_records" not in inspector.get_table_names():
        return
    if not any(col["name"] == "payment_status" for col in inspector.get_columns("salary_records")):
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE salary_records
                SET payment_status = CASE
                    WHEN mod(id, 100) < 72 THEN 'PAID'::payment_status_enum
                    ELSE 'NOT_PAID'::payment_status_enum
                END
                WHERE payment_status = 'NOT_PAID';
                """
            )
        )


def run_seed(reset: bool = True) -> None:
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    ensure_payment_status_column()

    db = SessionLocal()
    try:
        if reset:
            print("Clearing existing data...")
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
        else:
            Base.metadata.create_all(bind=engine)

        print("Seeding master data...")
        master = seed_master_data(db)

        print(f"Seeding {EMPLOYEE_COUNT} employees...")
        seed_employees(db, master, EMPLOYEE_COUNT)

        emp_count = db.query(Employee).count()
        sal_count = db.query(SalaryRecord).count()
        profile_count = db.query(EmployeeSalaryProfile).count()
        print(f"\nSeed complete: {emp_count} employees, {profile_count} salary profiles, {sal_count} salary records")
    finally:
        db.close()


if __name__ == "__main__":
    reset_flag = "--no-reset" not in sys.argv
    run_seed(reset=reset_flag)
