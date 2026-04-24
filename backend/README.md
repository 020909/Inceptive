# Inceptive Backend

Dedicated FastAPI service for long-running agent orchestration and backend workflows.

## Requirements

- Python 3.11+
- Access to the same Supabase project used by the Next.js app

## Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` and populate it with the required values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_PORT=8000
BACKEND_CORS_ORIGINS=http://localhost:3000,https://app.inceptive-ai.com
VERCEL_PROJECT_PRODUCTION_URL=https://app.inceptive-ai.com
SUPABASE_DB_URL=postgresql://postgres:your-db-password@db.your-project-ref.supabase.co:5432/postgres
OPENROUTER_KEY=your_openrouter_key
MEM0_EMBEDDER_MODEL=text-embedding-3-small
MEM0_EMBEDDING_DIMS=64
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
LANGFUSE_BASE_URL=https://cloud.langfuse.com
REDIS_URL=redis://localhost:6379/0
```

Core app values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Mem0 requirements:

- `SUPABASE_DB_URL=postgresql://...` for direct Postgres access to Supabase pgvector
- `OPENAI_API_KEY=...` or `OPENROUTER_KEY=...` for embeddings
- optional: `MEM0_EMBEDDER_MODEL=text-embedding-3-small`
- optional: `MEM0_EMBEDDING_DIMS=64`

Observability requirements:

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- optional: `LANGFUSE_BASE_URL=https://cloud.langfuse.com`

Background job requirements:

- `REDIS_URL=redis://...`

## Run locally

Start the FastAPI API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Start the Celery worker and beat scheduler from the repo root:

```bash
celery -A backend.jobs.worker worker --beat --loglevel=info
```

Mem0 note: the backend env needs `SUPABASE_DB_URL`, not just the Supabase REST URL, because Mem0's `pgvector` backend connects to Postgres directly.

Health check:

```bash
curl http://localhost:8000/api/health
```

Churn agent:

```bash
curl http://localhost:8000/api/agents/churn
curl -X POST http://localhost:8000/api/agents/churn/run
```

Observability:

```bash
curl http://localhost:8000/api/observability/traces
```

Jobs:

```bash
curl "http://localhost:8000/api/jobs/status?agent_id=churn_agent"
curl -X POST http://localhost:8000/api/jobs/schedule \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"churn_agent","enabled":true,"interval_minutes":1440}'
```

## Structure

```text
backend/
  agents/
  api/
    routes/
  connectors/
  jobs/
  memory/
  observability/
  utils/
  workflows/
  main.py
  requirements.txt
```
