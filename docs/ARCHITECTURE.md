# Architecture & Design Notes

## Architecture: Modular Monolith

```
React (Vite) ──REST──▶ FastAPI ──▶ PostgreSQL
                          │
                    Service Layer
                    (Salary Calc, Currency, Analytics)
                          │
                    Repository Layer
                    (Employee, Salary queries)
```

## Key Design Decisions

### 1. Salary as Derived Values
Total compensation is **never stored** — it's calculated from salary components at read time. This prevents inconsistent totals and supports flexible component models.

### 2. Effective-Dated Salary Records
Each salary change creates a new record. Previous records are marked INACTIVE with an `effective_to` date. This preserves full salary history for auditing.

### 3. Server-Side Everything for 10K Records
- Pagination: default 25, max 100 per page
- All filters applied in SQL WHERE clauses
- Sorting via indexed columns
- No client-side loading of full dataset

### 4. Database Indexes
Indexes on: `employee_code`, `email`, `country_id`, `department_id`, `job_level_id`, `employment_status`, `job_title`, `salary_records.employee_id`, `salary_records.effective_from`, `salary_records.status`

### 5. Exchange Rates via Frankfurter API
Live rates fetched from `https://api.frankfurter.dev/v2` (no API key required). Rates are cached in-memory during analytics to minimize external API calls (~8 unique currency pairs per request).

### 6. Batch Seeding
10,000 employees seeded in batches of 500 with `flush()` + `commit()` per batch for memory efficiency.

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Large list queries | OFFSET/LIMIT pagination with count query |
| N+1 queries | SQLAlchemy `joinedload` + `selectinload` |
| Salary range filter | Applied post-query (requires component calculation) |
| Analytics aggregation | Single pass over active employees with in-memory grouping |
| Connection pooling | pool_size=10, max_overflow=20 |
| Exchange rate lookups | Frankfurter API with in-memory cache per request |

## Trade-offs

- **No auth in MVP**: Faster delivery; production would add JWT/OAuth
- **Frankfurter API dependency**: Analytics requires network access; rates cached per request
- **Salary range filter in Python**: Component-based totals can't be filtered purely in SQL without a materialized view — acceptable for 10K scale
