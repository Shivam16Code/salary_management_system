"""Application settings — defaults in code; Docker can override via env vars."""

import os


class Settings:
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5433/salary_management",
    )
    cors_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    )
    seed_random_seed = int(os.getenv("SEED_RANDOM_SEED", "42"))
    default_page_size = 25
    max_page_size = 100
    frankfurter_api_url = os.getenv(
        "FRANKFURTER_API_URL",
        "https://api.frankfurter.dev/v2",
    )
    frankfurter_timeout_seconds = float(os.getenv("FRANKFURTER_TIMEOUT_SECONDS", "10"))

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
