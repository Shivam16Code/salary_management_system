#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting PostgreSQL (Docker)..."
cd "$ROOT"
docker compose up -d
sleep 3

echo "==> Setting up backend (Python 3.12)..."
cd "$ROOT/backend"
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Seeding database (10,000 employees)..."
python -m app.seed.seed_data

echo "==> Running tests..."
pytest -v

echo "==> Setting up frontend..."
cd "$ROOT/frontend"
npm install

echo ""
echo "Setup complete! Run:"
echo "  Backend:  cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  Frontend: cd frontend && npm run dev"
echo "  Open:     http://localhost:5173"
