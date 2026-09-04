import pytest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import (
    CalculationMethod,
    ComponentType,
    Country,
    Currency,
    Department,
    Employee,
    EmploymentStatus,
    JobLevel,
    SalaryComponent,
    PaymentStatus,
    SalaryRecord,
    SalaryRecordComponent,
    SalaryStatus,
)

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seeded_data(db_session):
    currency = Currency(code="INR", name="Indian Rupee", symbol="₹", decimal_places=2, is_active=True)
    db_session.add(currency)
    db_session.flush()

    country = Country(iso_code="IND", name="India", currency_id=currency.id, is_active=True)
    dept = Department(code="ENG", name="Engineering", is_active=True)
    level = JobLevel(code="L4", name="Senior", description="Senior individual contributor", is_active=True)
    db_session.add_all([country, dept, level])
    db_session.flush()

    basic = SalaryComponent(
        code="BASIC", name="Basic Salary", component_type=ComponentType.EARNING,
        calculation_method=CalculationMethod.FIXED, is_taxable=True, is_active=True,
    )
    hra = SalaryComponent(
        code="HRA", name="HRA", component_type=ComponentType.EARNING,
        calculation_method=CalculationMethod.PERCENTAGE, is_taxable=True, is_active=True,
    )
    overtime = SalaryComponent(
        code="OVERTIME", name="Overtime", component_type=ComponentType.EARNING,
        calculation_method=CalculationMethod.PER_UNIT, is_taxable=True, is_active=True,
    )
    unpaid = SalaryComponent(
        code="UNPAID_LEAVE", name="Unpaid Leave", component_type=ComponentType.DEDUCTION,
        calculation_method=CalculationMethod.FIXED, is_taxable=False, is_active=True,
    )
    db_session.add_all([basic, hra, overtime, unpaid])
    db_session.flush()

    for i in range(1, 51):
        emp = Employee(
            employee_code=f"EMP{i:05d}",
            first_name=f"Test{i}",
            last_name="User",
            email=f"test{i}@acme.com",
            country_id=country.id,
            department_id=dept.id,
            job_level_id=level.id,
            job_title="Software Engineer",
            employment_status=EmploymentStatus.ACTIVE,
            hire_date=date(2020, 1, 1),
        )
        db_session.add(emp)
        db_session.flush()

        payment_status = PaymentStatus.PAID if i <= 35 else PaymentStatus.NOT_PAID
        record = SalaryRecord(
            employee_id=emp.id, currency_id=currency.id,
            effective_from=date(2025, 4, 1),
            effective_to=date(2026, 9, 30),
            status=SalaryStatus.ACTIVE,
            payment_status=payment_status,
        )
        db_session.add(record)
        db_session.flush()

        db_session.add(SalaryRecordComponent(
            salary_record_id=record.id, salary_component_id=basic.id, amount=Decimal("1000000"),
        ))
        db_session.add(SalaryRecordComponent(
            salary_record_id=record.id, salary_component_id=hra.id,
            amount=Decimal("40"),
        ))

    db_session.commit()
    return {
        "country": country, "dept": dept, "level": level, "currency": currency,
        "basic": basic, "hra": hra, "overtime": overtime, "unpaid": unpaid,
    }


def _mock_frankfurter(mock_httpx_get):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"rate": 0.012, "base": "INR", "quote": "USD", "date": "2026-09-01"}
    mock_httpx_get.return_value = mock_response


class TestHealthAPI:
    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


class TestEmployeeAPI:
    def test_list_employees_pagination(self, client, seeded_data):
        resp = client.get("/api/v1/employees?page=1&page_size=10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 10
        assert data["total"] == 50

    def test_search_by_full_name(self, client, seeded_data):
        resp = client.get("/api/v1/employees", params={"search": "Test1 User", "page_size": 25})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["full_name"] == "Test1 User"
        assert data["items"][0]["employee_code"] == "EMP00001"

    def test_search_by_first_name_prefix(self, client, seeded_data):
        resp = client.get("/api/v1/employees", params={"search": "Test12", "page_size": 25})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["first_name"] == "Test12"

    def test_search_by_reversed_full_name(self, client, seeded_data):
        resp = client.get("/api/v1/employees", params={"search": "User Test3", "page_size": 25})
        assert resp.status_code == 200
        data = resp.json()
        assert any(item["full_name"] == "Test3 User" for item in data["items"])

    def test_create_employee(self, client, seeded_data):
        payload = {
            "first_name": "New",
            "last_name": "Employee",
            "email": "new@acme.com",
            "country_id": seeded_data["country"].id,
            "department_id": seeded_data["dept"].id,
            "job_level_id": seeded_data["level"].id,
            "job_title": "Analyst",
            "hire_date": "2024-01-01",
        }
        resp = client.post("/api/v1/employees", json=payload)
        assert resp.status_code == 201
        assert resp.json()["email"] == "new@acme.com"

    def test_update_employee(self, client, seeded_data):
        resp = client.put("/api/v1/employees/1", json={"job_title": "Lead Engineer"})
        assert resp.status_code == 200
        assert resp.json()["job_title"] == "Lead Engineer"

    def test_get_employee_detail(self, client, seeded_data):
        resp = client.get("/api/v1/employees/1")
        assert resp.status_code == 200
        assert resp.json()["employee_code"] == "EMP00001"

    def test_employee_not_found(self, client, seeded_data):
        resp = client.get("/api/v1/employees/9999")
        assert resp.status_code == 404
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"
        assert "message" in body["error"]
        assert body["error"]["path"].endswith("/employees/9999")

    def test_validation_error_envelope(self, client, seeded_data):
        resp = client.post("/api/v1/employees", json={"first_name": "Only"})
        assert resp.status_code == 422
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert isinstance(body["error"]["details"], list)
        assert len(body["error"]["details"]) >= 1
        dumped = str(body)
        assert "duplicate key" not in dumped.lower()
        for detail in body["error"]["details"]:
            assert "Field required" not in detail["message"]
            assert detail["message"].endswith(".")

    def test_duplicate_email_is_readable(self, client, seeded_data):
        payload = {
            "first_name": "Sawan",
            "last_name": "Patel",
            "email": "test1@acme.com",
            "country_id": seeded_data["country"].id,
            "department_id": seeded_data["dept"].id,
            "job_level_id": seeded_data["level"].id,
            "job_title": "Analyst",
            "hire_date": "2024-01-01",
        }
        resp = client.post("/api/v1/employees", json=payload)
        assert resp.status_code == 409
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert body["error"]["message"] == "An employee with this email already exists."
        dumped = str(body).lower()
        assert "duplicate key" not in dumped
        assert "ix_employees" not in dumped
        assert "unique constraint" not in dumped


class TestDeleteAPI:
    def test_delete_salary_record_cascades_components(self, client, seeded_data, db_session):
        before = (
            db_session.query(SalaryRecordComponent)
            .filter(SalaryRecordComponent.salary_record_id == 1)
            .count()
        )
        assert before > 0

        resp = client.delete("/api/v1/salaries/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted"] is True
        assert data["cascaded"]["salary_record_components"] == before

        remaining = (
            db_session.query(SalaryRecordComponent)
            .filter(SalaryRecordComponent.salary_record_id == 1)
            .count()
        )
        assert remaining == 0
        assert db_session.query(SalaryRecord).filter(SalaryRecord.id == 1).first() is None

    def test_delete_employee_cascades_payroll(self, client, seeded_data, db_session):
        emp_id = 2
        records_before = (
            db_session.query(SalaryRecord).filter(SalaryRecord.employee_id == emp_id).count()
        )
        assert records_before >= 1

        resp = client.delete(f"/api/v1/employees/{emp_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted"] is True
        assert data["cascaded"]["salary_records"] == records_before
        assert client.get(f"/api/v1/employees/{emp_id}").status_code == 404

        assert (
            db_session.query(SalaryRecord).filter(SalaryRecord.employee_id == emp_id).count()
            == 0
        )

    def test_delete_department_blocked_when_in_use(self, client, seeded_data):
        resp = client.delete("/api/v1/departments/1")
        assert resp.status_code == 409
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert "employee" in body["error"]["message"].lower()

    def test_delete_unused_salary_component(self, client, seeded_data, db_session):
        create = client.post(
            "/api/v1/salary-components",
            json={
                "code": "TEMPDEL",
                "name": "Temp Delete Me",
                "component_type": "EARNING",
                "calculation_method": "FIXED",
            },
        )
        assert create.status_code == 201
        component_id = create.json()["id"]

        resp = client.delete(f"/api/v1/salary-components/{component_id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        assert db_session.query(SalaryComponent).filter(SalaryComponent.id == component_id).first() is None

        # Used components cannot be deleted
        used = client.delete("/api/v1/salary-components/1")
        assert used.status_code == 409
        assert used.json()["error"]["code"] == "CONFLICT"


class TestMasterDataAPI:
    def test_list_countries(self, client, seeded_data):
        resp = client.get("/api/v1/countries")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
        assert "currency_code" in resp.json()[0]

    def test_list_currencies(self, client, seeded_data):
        resp = client.get("/api/v1/currencies")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_create_department(self, client, seeded_data):
        resp = client.post("/api/v1/departments", json={"code": "RND", "name": "Research"})
        assert resp.status_code == 201
        assert resp.json()["code"] == "RND"

    @patch("app.services.currency_service.httpx.get")
    def test_create_country(self, mock_get, client, seeded_data):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = [
            {"iso_code": "EUR", "name": "Euro", "symbol": "€"},
        ]
        mock_get.return_value = mock_response
        resp = client.post("/api/v1/countries", json={"iso_code": "FRA"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["iso_code"] == "FRA"
        assert data["name"] == "France"
        assert data["currency_code"] == "EUR"


class TestAnalyticsAPI:
    @patch("app.services.currency_service.httpx.get")
    def test_analytics_summary(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        resp = client.get("/api/v1/analytics/summary?reporting_currency=USD")
        assert resp.status_code == 200
        assert resp.json()["employee_count"] == 50

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_by_department(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        resp = client.get("/api/v1/analytics/by-department?reporting_currency=USD")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_distribution(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        resp = client.get("/api/v1/analytics/distribution?reporting_currency=USD")
        assert resp.status_code == 200
        assert resp.json()["total_employees"] == 50

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_as_of_date(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        before = client.get(
            "/api/v1/analytics/summary?reporting_currency=USD&as_of_date=2020-01-01"
        )
        assert before.status_code == 200
        assert before.json()["employee_count"] == 0

        on_record = client.get(
            "/api/v1/analytics/summary?reporting_currency=USD&as_of_date=2025-04-01"
        )
        assert on_record.status_code == 200
        assert on_record.json()["employee_count"] == 50
        assert on_record.json()["as_of_date"] == "2025-04-01"

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_trend(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        resp = client.get(
            "/api/v1/analytics/trend?reporting_currency=USD"
            "&date_from=2025-04-01&date_to=2025-06-30"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["points"]) >= 1
        assert data["points"][-1]["employee_count"] == 50

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_trend_short_range_daily(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        resp = client.get(
            "/api/v1/analytics/trend?reporting_currency=USD"
            "&date_from=2025-04-01&date_to=2025-04-03"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["points"]) == 3
        assert data["points"][0]["period_label"] == "Apr 01, 2025"

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_payment_status_filter(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        all_resp = client.get("/api/v1/analytics/summary?reporting_currency=USD")
        paid_resp = client.get("/api/v1/analytics/summary?reporting_currency=USD&payment_statuses=PAID")
        not_paid_resp = client.get("/api/v1/analytics/summary?reporting_currency=USD&payment_statuses=NOT_PAID")
        assert all_resp.status_code == 200
        assert paid_resp.status_code == 200
        assert not_paid_resp.status_code == 200
        assert all_resp.json()["employee_count"] == 50
        assert paid_resp.json()["employee_count"] == 35
        assert not_paid_resp.json()["employee_count"] == 15

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_country_filter_applies_to_all_breakdowns(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        country_id = seeded_data["country"].id
        summary = client.get(
            f"/api/v1/analytics/summary?reporting_currency=USD&as_of_date=2025-04-01&country_ids={country_id}"
        ).json()
        by_dept = client.get(
            f"/api/v1/analytics/by-department?reporting_currency=USD&as_of_date=2025-04-01&country_ids={country_id}"
        ).json()
        dept_total = sum(row["employee_count"] for row in by_dept)
        assert summary["employee_count"] == 50
        assert dept_total == summary["employee_count"]

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_filtered_combined(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        dept_id = seeded_data["dept"].id
        level_id = seeded_data["level"].id
        resp = client.get(
            "/api/v1/analytics/filtered"
            f"?reporting_currency=USD&date_from=2025-04-01&date_to=2025-04-03"
            f"&department_ids={dept_id}&job_level_ids={level_id}&payment_statuses=PAID"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "range"
        assert data["filters"]["department_ids"] == [dept_id]
        assert data["filters"]["job_level_ids"] == [level_id]
        assert data["filters"]["payment_statuses"] == ["PAID"]
        assert data["summary"]["employee_count"] == data["distribution"]["total_employees"]
        assert "payment_summary" in data
        assert data["payment_summary"]["total_records"] >= data["summary"]["employee_count"]
        dept_total = sum(x["employee_count"] for x in data["by_department"])
        assert dept_total == data["summary"]["employee_count"]
        assert len(data["trend"]["points"]) == 3

    @patch("app.services.currency_service.httpx.get")
    def test_analytics_range_matches_salary_record_period(self, mock_httpx_get, client, db_session, seeded_data):
        """Salary records whose period starts inside the filter range."""
        _mock_frankfurter(mock_httpx_get)
        junior = JobLevel(code="L1", name="Junior", description="Junior", is_active=True)
        db_session.add(junior)
        db_session.flush()

        emp = Employee(
            employee_code="EMP10002",
            first_name="Ben",
            last_name="Parker",
            email="benparker@gmail.com",
            country_id=seeded_data["country"].id,
            department_id=seeded_data["dept"].id,
            job_level_id=junior.id,
            job_title="Associate Engineer",
            employment_status=EmploymentStatus.ACTIVE,
            hire_date=date(2026, 9, 2),
        )
        db_session.add(emp)
        db_session.flush()

        record = SalaryRecord(
            employee_id=emp.id,
            currency_id=seeded_data["currency"].id,
            effective_from=date(2026, 9, 1),
            effective_to=date(2026, 9, 30),
            status=SalaryStatus.ACTIVE,
            payment_status=PaymentStatus.PAID,
        )
        db_session.add(record)
        db_session.flush()
        db_session.add(
            SalaryRecordComponent(
                salary_record_id=record.id,
                salary_component_id=seeded_data["basic"].id,
                amount=Decimal("29167"),
            )
        )
        db_session.commit()

        resp = client.get(
            "/api/v1/analytics/filtered"
            "?reporting_currency=INR&date_from=2026-09-01&date_to=2026-09-02"
            f"&department_ids={seeded_data['dept'].id}&job_level_ids={junior.id}&payment_statuses=PAID"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["employee_count"] == 1
        assert float(data["summary"]["total_compensation"]) == 29167.0

        outside = client.get(
            "/api/v1/analytics/filtered"
            "?reporting_currency=INR&date_from=2026-10-01&date_to=2026-10-02"
            f"&department_ids={seeded_data['dept'].id}&job_level_ids={junior.id}&payment_statuses=PAID"
        )
        assert outside.json()["summary"]["employee_count"] == 0


class TestSalaryAPI:
    def test_list_salary_records_filtered(self, client, db_session, seeded_data):
        junior = JobLevel(code="L1", name="Junior", description="Junior", is_active=True)
        db_session.add(junior)
        db_session.flush()

        emp = Employee(
            employee_code="EMP10002",
            first_name="Ben",
            last_name="Parker",
            email="benparker@gmail.com",
            country_id=seeded_data["country"].id,
            department_id=seeded_data["dept"].id,
            job_level_id=junior.id,
            job_title="Associate Engineer",
            employment_status=EmploymentStatus.ACTIVE,
            hire_date=date(2026, 9, 2),
        )
        db_session.add(emp)
        db_session.flush()

        record = SalaryRecord(
            employee_id=emp.id,
            currency_id=seeded_data["currency"].id,
            effective_from=date(2026, 9, 1),
            effective_to=date(2026, 9, 30),
            status=SalaryStatus.ACTIVE,
            payment_status=PaymentStatus.PAID,
        )
        db_session.add(record)
        db_session.flush()
        db_session.add(
            SalaryRecordComponent(
                salary_record_id=record.id,
                salary_component_id=seeded_data["basic"].id,
                amount=Decimal("29167"),
            )
        )
        db_session.commit()

        resp = client.get(
            "/api/v1/salaries"
            "?date_from=2026-09-01&date_to=2026-09-02"
            f"&department_ids={seeded_data['dept'].id}&job_level_ids={junior.id}"
            "&payment_statuses=PAID"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["summary"]["paid_count"] == 1
        assert data["items"][0]["employee_code"] == "EMP10002"
        assert float(data["items"][0]["adjusted_compensation"]) == 29167.0
        assert data["items"][0]["payment_status"] == "PAID"

        not_paid = client.get(
            "/api/v1/salaries"
            "?date_from=2026-09-01&date_to=2026-09-02"
            f"&department_ids={seeded_data['dept'].id}&job_level_ids={junior.id}"
            "&payment_statuses=NOT_PAID"
        )
        assert not_paid.json()["total"] == 0

    @patch("app.services.currency_service.httpx.get")
    def test_list_salary_records_summary_reporting_currency(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        resp = client.get(
            "/api/v1/salaries?date_from=2025-04-01&date_to=2025-04-30&reporting_currency=USD"
        )
        assert resp.status_code == 200
        summary = resp.json()["summary"]
        assert summary["reporting_currency"] == "USD"
        assert summary["total_records"] == 50
        assert summary["paid_count"] + summary["not_paid_count"] == summary["total_records"]
        assert float(summary["total_paid_amount"]) >= 0
        assert float(summary["total_not_paid_amount"]) >= 0

    def test_list_salary_records_date_range_filter(self, client, seeded_data):
        """Period start must fall in the filter range; mere overlap is not enough."""
        # Seeded records start 2025-04-01; they overlap Sep 2026 but must NOT match.
        sept = client.get(
            "/api/v1/salaries?date_from=2026-09-01&date_to=2026-09-02"
        )
        assert sept.status_code == 200
        assert sept.json()["total"] == 0

        april = client.get(
            "/api/v1/salaries?date_from=2025-04-01&date_to=2025-04-01"
        )
        assert april.json()["total"] == 50

        outside = client.get(
            "/api/v1/salaries?date_from=2024-01-01&date_to=2024-01-31"
        )
        assert outside.json()["total"] == 0

    def test_list_salary_records_currency_and_employment_filters(self, client, seeded_data):
        currency_id = seeded_data["currency"].id
        active = client.get(
            f"/api/v1/salaries?date_from=2025-04-01&date_to=2025-04-30"
            f"&currency_ids={currency_id}&employment_statuses=ACTIVE"
        )
        assert active.status_code == 200
        assert active.json()["total"] == 50
        for item in active.json()["items"]:
            assert item["employment_status"] == "ACTIVE"
            assert item["currency_code"] == "INR"

        terminated = client.get(
            "/api/v1/salaries?date_from=2025-04-01&date_to=2025-04-30&employment_statuses=TERMINATED"
        )
        assert terminated.json()["total"] == 0

    def test_list_salary_records_multi_select_filters(self, client, seeded_data):
        """Multiple payment statuses and departments can be selected at once."""
        dept_id = seeded_data["dept"].id
        both_payment = client.get(
            "/api/v1/salaries?date_from=2025-04-01&date_to=2025-04-30"
            "&payment_statuses=PAID&payment_statuses=NOT_PAID"
        )
        assert both_payment.status_code == 200
        assert both_payment.json()["total"] == 50

        single_dept = client.get(
            f"/api/v1/salaries?date_from=2025-04-01&date_to=2025-04-30&department_ids={dept_id}"
        )
        assert single_dept.status_code == 200
        assert single_dept.json()["total"] == 50

    def test_list_employee_salaries(self, client, seeded_data):
        resp = client.get("/api/v1/employees/1/salaries")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_get_current_salary(self, client, seeded_data):
        resp = client.get("/api/v1/employees/1/salaries/current")
        assert resp.status_code == 200
        assert float(resp.json()["adjusted_compensation"]) > 0

    def test_create_salary_record(self, client, seeded_data):
        payload = {
            "effective_from": "2026-04-01",
            "status": "ACTIVE",
            "components": [
                {"salary_component_id": seeded_data["basic"].id, "amount": 1200000},
                {"salary_component_id": seeded_data["hra"].id, "amount": 40},
            ],
        }
        resp = client.post("/api/v1/employees/1/salaries", json=payload)
        assert resp.status_code == 201
        assert float(resp.json()["adjusted_compensation"]) > 0
        assert len(resp.json()["components"]) == 2

    def test_create_salary_with_overtime_and_deduction(self, client, seeded_data):
        payload = {
            "effective_from": "2026-05-01",
            "status": "ACTIVE",
            "components": [
                {"salary_component_id": seeded_data["basic"].id, "amount": 1000000},
                {"salary_component_id": seeded_data["hra"].id, "amount": 40},
                {"salary_component_id": seeded_data["overtime"].id, "amount": 5000, "units": 10},
                {"salary_component_id": seeded_data["unpaid"].id, "amount": 15000},
            ],
        }
        resp = client.post("/api/v1/employees/2/salaries", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["components"]) == 4
        codes = {c["component_code"] for c in data["components"]}
        assert "OVERTIME" in codes
        assert "UNPAID_LEAVE" in codes
        assert float(data["total_deductions"]) >= 15000

    def test_update_salary_record_components(self, client, seeded_data):
        resp = client.put(
            "/api/v1/salaries/1",
            json={
                "components": [
                    {"salary_component_id": seeded_data["basic"].id, "amount": 1100000},
                    {"salary_component_id": seeded_data["hra"].id, "amount": 40},
                ],
            },
        )
        assert resp.status_code == 200
        assert float(resp.json()["adjusted_compensation"]) > 0

    def test_update_salary_record_payment_status(self, client, seeded_data):
        resp = client.put("/api/v1/salaries/1", json={"payment_status": "PAID"})
        assert resp.status_code == 200
        assert resp.json()["payment_status"] == "PAID"


class TestSalaryProfileAPI:
    def test_create_and_update_salary_profile(self, client, seeded_data):
        create_resp = client.post(
            "/api/v1/employees/1/salary-profile",
            json={
                "package_amount": 1200000,
                "pay_frequency": "YEARLY",
                "effective_from": "2025-04-01",
                "change_reason": "Initial package",
            },
        )
        assert create_resp.status_code == 201
        data = create_resp.json()
        assert float(data["annual_package"]) == 1200000
        assert float(data["base_salary"]) == 100000
        assert data["pay_frequency"] == "YEARLY"

        update_resp = client.put(
            "/api/v1/employees/1/salary-profile",
            json={
                "package_amount": 1500000,
                "pay_frequency": "YEARLY",
                "effective_from": "2026-04-01",
                "change_reason": "Annual increment",
            },
        )
        assert update_resp.status_code == 200
        assert float(update_resp.json()["annual_package"]) == 1500000

        history_resp = client.get("/api/v1/employees/1/salary-profile/history")
        assert history_resp.status_code == 200
        assert len(history_resp.json()) == 2
        assert history_resp.json()[1]["status"] == "INACTIVE"

    def test_salary_record_uses_profile_base(self, client, seeded_data):
        client.post(
            "/api/v1/employees/3/salary-profile",
            json={
                "package_amount": 100000,
                "pay_frequency": "MONTHLY",
                "effective_from": "2025-04-01",
            },
        )
        resp = client.post(
            "/api/v1/employees/3/salaries",
            json={
                "effective_from": "2026-06-01",
                "status": "ACTIVE",
                "components": [
                    {"salary_component_id": seeded_data["hra"].id, "amount": 40},
                ],
            },
        )
        assert resp.status_code == 201
        basic = next(c for c in resp.json()["components"] if c["component_code"] == "BASIC")
        assert float(basic["amount"]) == 100000

    def test_preview_salary_profile(self, client, seeded_data):
        resp = client.post(
            "/api/v1/employees/salary-profile/preview",
            json={
                "package_amount": 300000,
                "pay_frequency": "QUARTERLY",
                "effective_from": "2025-04-01",
            },
        )
        assert resp.status_code == 200
        assert float(resp.json()["annual_package"]) == 1200000
        assert float(resp.json()["base_salary"]) == 100000


class TestSalaryComponentsAPI:
    def test_list_salary_components(self, client, seeded_data):
        resp = client.get("/api/v1/salary-components")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_create_salary_component(self, client, seeded_data):
        payload = {
            "code": "TRAVEL",
            "name": "Travel Allowance",
            "component_type": "EARNING",
            "calculation_method": "FIXED",
        }
        resp = client.post("/api/v1/salary-components", json=payload)
        assert resp.status_code == 201
        assert resp.json()["code"] == "TRAVEL"


class TestExchangeRatesAPI:
    @patch("app.services.currency_service.httpx.get")
    def test_get_exchange_rate_pair(self, mock_httpx_get, client, seeded_data):
        _mock_frankfurter(mock_httpx_get)
        resp = client.get("/api/v1/exchange-rates/INR/USD")
        assert resp.status_code == 200
        assert resp.json()["base"] == "INR"

    @patch("app.services.currency_service.httpx.get")
    def test_list_exchange_rates(self, mock_httpx_get, client, seeded_data):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = [
            {"date": "2026-09-01", "base": "USD", "quote": "INR", "rate": 95.21},
        ]
        mock_httpx_get.return_value = mock_response
        resp = client.get("/api/v1/exchange-rates?base=USD")
        assert resp.status_code == 200
        assert resp.json()["base"] == "USD"
