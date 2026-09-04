#!/bin/sh
set -e

echo "==> Waiting for database..."
python - <<'PY'
import time
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.database import engine

for attempt in range(1, 61):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database is ready.")
        break
    except OperationalError as exc:
        if attempt == 60:
            raise SystemExit(f"Database not ready after 60s: {exc}") from exc
        time.sleep(1)
PY

echo "==> Checking whether seed data is needed..."
python - <<'PY'
from sqlalchemy import inspect

from app.database import SessionLocal, engine
from app.models import Employee
from app.seed.seed_data import run_seed

inspector = inspect(engine)
if not inspector.has_table("employees"):
    print("No tables found — running initial seed...")
    run_seed(reset=True)
else:
    db = SessionLocal()
    try:
        count = db.query(Employee).count()
    finally:
        db.close()
    if count == 0:
        print("Employees table is empty — running seed...")
        run_seed(reset=True)
    else:
        print(f"Found {count} employees — skipping seed.")
PY

echo "==> Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
