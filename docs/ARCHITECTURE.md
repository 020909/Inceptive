# Inceptive — architecture & autonomy roadmap

This document mirrors the Step 0–2 audit and roadmap. The codebase is **Next.js 16 (App Router) + React 19 + Supabase + Stripe + Vercel AI SDK**.

## Current stack (mapped)

| Layer | Technology | Location |
|-------|------------|----------|
| Frontend | Next.js pages, Tailwind, shadcn-style UI | `src/app/`, `src/components/` |
| API | Route handlers | `src/app/api/**/route.ts` |
| Auth | Supabase Auth (cookies + Bearer), middleware guards | `src/middleware.ts`, `src/lib/supabase*.ts`, `src/lib/api-auth.ts` |
| DB | Supabase Postgres + RLS | `supabase/*.sql` |
| Agent (sync) | `streamText` + tools in API route | `src/app/api/agent/stream/route.ts` |
| Billing | Stripe Checkout, webhooks, credits | `src/lib/stripe.ts`, `src/lib/credits.ts`, `src/app/api/stripe/*` |
| Connectors (OAuth) | Per-provider connect/callback routes | `src/app/api/auth/*/connect|callback/route.ts` |
| Connector registry (code) | Typed modules + browser/gmail/slack/computer stubs | `src/lib/connectors/` |
| Autonomy (async) | `agent_jobs` table + tick API + worker script | `supabase/009_agent_autonomy.sql`, `src/lib/agent/*`, `src/app/api/internal/agent-tick` |

## Live site

- **Local:** not verified from CI/sandbox (run `npm run dev` and open `http://localhost:3000`).
- **Deployed:** not embedded in repo; default marketing URL in code is `NEXT_PUBLIC_APP_URL` (e.g. `https://app.inceptive-ai.com`).

## What is done (~production-shaped MVP)

- Auth, protected dashboard, signup/login.
- BYOK AI (OpenAI / Anthropic / Gemini / OpenRouter) via Settings; agent stream + research + email + social generators.
- OAuth connectors: Google (Gmail/YouTube), Microsoft (Outlook), Meta (FB/IG), LinkedIn, Twitter/X, TikTok, Telegram; tokens encrypted at rest (`token-crypto`).
- CRUD-style product surfaces: emails, social posts, goals, tasks, research reports, weekly-style reports, chat sessions, credits + Stripe plans.
- Security hardening: OAuth redirect allowlisting, SSRF guard on agent browse, JWT/cookie auth on agent routes, Stripe webhook signature verification.

## Partially done

- **Agent UX:** Dashboard chat is strong; `/agent` was a redirect-only shell — replaced with a **live jobs** view.
- **Connectors:** Many OAuth flows exist; **Slack / WhatsApp / Calendar / GitHub** are not wired as first-class connector modules.
- **Memory:** `memory_enabled` + `chat_sessions` exist; no vector/graph RAG pipeline.
- **Observability:** console logs only; no tracing, no task timeline UI beyond new jobs list.
- **README:** still default `create-next-app` text (superseded by this doc).

## Missing (vs OpenClaw / Manus / Perplexity Computer–class)

- Real **browser automation** (Playwright/Puppeteer VM), not just HTTP fetch + DDG.
- **24/7 process model** on platform hosts (Vercel) is limited — use **Docker/worker** + cron or queue (Redis/BullMQ optional; baseline uses DB + tick).
- **Triggers:** Slack events, GitHub webhooks, PagerDuty, inbound email rules — not implemented.
- **Multi-agent** planner/worker/judge, reflection loop, sandboxed computer-use.
- **Skill/plugin hot-reload** system.
- **E2E test suite** in CI (smoke scripts + optional Vitest later).

## One-week focused roadmap (bullet)

1. **Day 1–2:** Ship DB-backed `agent_jobs`, `/api/internal/agent-tick`, Docker + worker loop; document `CRON_SECRET`.
2. **Day 3:** Connector registry + browser/gmail/slack/computer stubs; one real path (browser probe job).
3. **Day 4:** Live agent UI + logs column; pause/resume job actions.
4. **Day 5:** Inbox-monitor template job (stub + hooks to Gmail API read when scopes allow).
5. **Day 6–7:** Playwright sidecar (optional service) OR webhook trigger MVP; tighten observability.

See chat output for the full prioritized table.
