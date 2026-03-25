# Inceptive

Founder-focused **Next.js + Supabase** app with BYOK AI, OAuth connectors (Gmail, Outlook, social), Stripe billing, and an **async agent job** layer for 24/7-style workloads.

## Quick start

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Apply SQL in `supabase/` (in order) in the Supabase SQL editor — including **`009_agent_autonomy.sql`** for background jobs.

## Architecture & roadmap

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for the full system map and autonomy plan.

## Autonomous worker (self-hosted)

1. Set **`CRON_SECRET`** in `.env` (same value everywhere).
2. Run the web app (`npm start` or Docker).
3. Run **`npm run worker`** (or the `agent-worker` service in `docker-compose.yml`) so it POSTs to `/api/internal/agent-tick` on an interval.
4. Use the **Agent** page in the dashboard to enqueue jobs, or `POST /api/agent/jobs` with a Bearer token.

Example shell flow: [`scripts/e2e-inbox-monitor-example.sh`](./scripts/e2e-inbox-monitor-example.sh).

## Docker

```bash
docker compose up --build
```

Requires `.env` with Supabase, Stripe (if used), `CRON_SECRET`, and optional `SLACK_BOT_TOKEN` / `SLACK_DEFAULT_CHANNEL` for Slack jobs.

## Connectors (code)

Typed modules live under [`src/lib/connectors/`](./src/lib/connectors/) (browser, Gmail link-check, Slack bot stub, computer-use stub).

---

Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
# Inceptive-AI
