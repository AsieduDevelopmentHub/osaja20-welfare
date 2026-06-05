# Installation Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+
- Docker (optional, for PostgreSQL & Redis)

## 1. Install dependencies

```bash
pnpm install
```

## 2. Start infrastructure

```bash
cd infrastructure/docker
docker compose up -d postgres redis
```

## 3. Configure API

```bash
cp apps/api/.env.example apps/api/.env
```

## 4. Run API

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn v1.main:app --reload --app-dir .
```

API docs: http://localhost:8000/docs

## 5. Run web apps

```bash
pnpm dev:member   # http://localhost:3000
pnpm dev:admin    # http://localhost:3001
```

## Run algorithm tests

```bash
cd apps/api
pytest tests/
```
