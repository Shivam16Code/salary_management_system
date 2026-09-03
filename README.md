# ACME Salary Management System

Web app for HR managers to manage, search, and analyze compensation for ~10,000 employees across multiple countries and currencies.

| Layer | Stack |
|-------|--------|
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Tests | pytest |

---

## Ports

| Service | Docker | Local |
|---------|--------|--------|
| App (UI) | **http://localhost:8080** | **http://localhost:5173** |
| API | http://localhost:8000 | http://localhost:8000 |
| PostgreSQL | localhost:**5433** → container `5432` | localhost:**5433** (same Compose DB) |
| API docs | http://localhost:8000/docs | http://localhost:8000/docs |
| Health | http://localhost:8000/health | http://localhost:8000/health |

---

## 1. Run with Docker (recommended)

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

From the project root:

```bash
docker compose up -d --build
```

| What happens | Detail |
|--------------|--------|
| Postgres | Starts and stays healthy |
| Backend | Waits for DB; **seeds automatically** if the database is empty (~10k employees — first boot can take several minutes) |
| Frontend | Nginx serves the built UI on port **8080** |

Open the app:

```text
http://localhost:8080
```

### Useful Docker commands

```bash
# Follow backend logs (seed progress + API)
docker compose logs -f backend

# Status
docker compose ps

# Stop containers (keeps DB volume)
docker compose down

# Stop and wipe database volume (full re-seed on next up)
docker compose down -v
```

---

## 2. Run locally (frontend + backend)

Use this when you want hot reload and local debugging. Postgres can still run via Docker.

**Prerequisites:**

- Python **3.12+**
- Node.js **18+**
- Docker (for Postgres only), or your own PostgreSQL on port **5433**

### 2.1 Database (Postgres via Docker)

```bash
docker compose up -d postgres
```

Default connection (also set in `backend/app/config.py`):

```text
postgresql://postgres:postgres@localhost:5433/salary_management
```

### 2.2 Backend (port 8000)

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# First time only — seed demo data
python -m app.seed.seed_data

# Start API with reload
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000  
- Swagger: http://localhost:8000/docs  

### 2.3 Frontend (port 5173)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Vite proxies `/api` and `/health` to `http://localhost:8000`.

### Tests

```bash
cd backend
source venv/bin/activate
pytest -v
```

---

## What you can do in the app

- **Dashboard** — filtered compensation analytics, charts, breakdowns, CSV export  
- **Employees** — search, filter, hire wizard (employee + salary package), detail view  
- **Salary Records** — period pay lines, payment status, filters  
- **Master Data** — countries, currencies, departments, job levels  
- **Salary Components** — earnings / deductions catalog  
- **Exchange Rates** — live FX for multi-currency reporting  

---

## API overview

All application routes use the prefix `/api/v1`.

| Area | Examples |
|------|----------|
| Employees | `GET/POST /employees`, `GET/PUT/DELETE /employees/{id}` |
| Salary profiles | `GET/POST /employees/{id}/salary-profile` |
| Salary records | `GET /salaries`, `POST /employees/{id}/salaries` |
| Salary components | `GET/POST /salary-components` |
| Master data | `/countries`, `/currencies`, `/departments`, `/job-levels` |
| Exchange rates | `/exchange-rates`, `/exchange-rates/{base}/{target}` |
| Analytics | `/analytics/filtered`, `/analytics/summary`, breakdowns, trend |
| Health | `GET /health` |

Interactive docs: **http://localhost:8000/docs**

---

## Notes

- **First Docker boot** seeds only when the DB has no tables; later starts skip seeding.  
- Config defaults live in `backend/app/config.py`; Docker overrides `DATABASE_URL` and `CORS_ORIGINS`.  
- Do not commit secrets; `.env` is gitignored if you add one.  
- Performance: DB indexes, server-side pagination/filter/sort, eager loading, connection pooling, Frankfurter FX for analytics.
