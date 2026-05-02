# Inceptive — architecture & autonomy roadmap

This document mirrors the Step 0–2 audit and roadmap. The codebase is **Next.js 16 (App Router) + React 19 + Supabase + Stripe + Vercel AI SDK**.

## Current stack (mapped, single deploy)

| Layer | Technology | Location |
|-------|------------|----------|
| Frontend | Next.js pages, Tailwind, shadcn-style UI | `src/app/`, `src/components/` |
| API | Route handlers | `src/app/api/**/route.ts` |
| Auth | Supabase Auth (cookies + Bearer), middleware guards | `src/middleware.ts`, `src/lib/supabase*.ts`, `src/lib/api-auth.ts` |
| DB | Supabase Postgres + RLS | `supabase/*.sql` |
| Compliance AI | AML triage, SAR drafter, policy vault, reconciliation, vendor analyst | `src/app/api/aml-triage`, `src/app/api/sar-drafter`, `src/app/api/policy-vault`, `src/app/api/reconciliation`, `src/app/api/vendor-analyst` |
| Approval queue | Maker-checker pattern with real audit attribution | `src/app/api/approval-queue/{approve,reject}` |
| Billing | Stripe Checkout, webhooks, credits | `src/lib/stripe.ts`, `src/lib/credits.ts`, `src/app/api/stripe/*` |
| Connectors (OAuth) | Per-provider connect/callback routes | `src/app/api/auth/*/connect|callback/route.ts` |
| Background jobs | Inngest (already wired) | `src/inngest/` |

## Live site

- **Local:** not verified from CI/sandbox (run `npm run dev` and open `http://localhost:3000`).
- **Deployed:** not embedded in repo; default marketing URL in code is `NEXT_PUBLIC_APP_URL` (e.g. `https://app.inceptive-ai.com`).

## What is done (~production-shaped MVP)

- Auth, protected dashboard, signup/login.
- BYOK AI (OpenAI / Anthropic / Gemini / OpenRouter) via Settings; compliance AI routes (AML, SAR, policy, reconciliation, vendor).
- OAuth connectors: Google (Gmail/YouTube), Microsoft (Outlook), Meta (FB/IG), LinkedIn, Twitter/X, TikTok, Telegram; tokens encrypted at rest (`token-crypto`).
- Compliance modules: AML triage, SAR drafter, policy vault, reconciliation, vendor analyst, approval queue (maker-checker).
- Security hardening: OAuth redirect allowlisting, SSRF guard on agent browse, JWT/cookie auth on routes, Stripe webhook signature verification.

## Partially done

- **Agent UX:** Dashboard chat is strong; Inngest handles background jobs natively.
- **Connectors:** Many OAuth flows exist; **Slack / WhatsApp / Calendar / GitHub** are not wired as first-class connector modules.
- **Memory:** `memory_enabled` + `chat_sessions` exist; no vector/graph RAG pipeline.
- **Observability:** console logs only; no tracing, no task timeline UI beyond new jobs list.
- **README:** updated to reflect compliance OS scope.

## Missing (vs regulated-action-kernel requirements)

- **Regulated Action Kernel**: Evidence In → AI Draft → Human Approves → Warrant Issued → Execute → Ledger → Replay → Export. Not yet end-to-end.
- **Unified tenancy**: `org_id` references in cases/realtime must migrate to `tenant_id`.
- **Real audit attribution**: Some routes still hardcode `"system@inceptive-ai.com"` or `"user@inceptive-ai.com"`.
- **Demo data removal**: `data.json` hardcoded filler still shipped in dashboard.
- **Triggers:** Slack events, GitHub webhooks, PagerDuty, inbound email rules — not implemented.
- **Multi-agent** planner/worker/judge, reflection loop, sandboxed computer-use.
- **E2E test suite** in CI (smoke scripts + optional Vitest later).

## Current alignment rules (Inceptive 2.0)

1. Keep core backend in Next.js route handlers (`src/app/api`) with Supabase as the primary database.
2. Use `src/lib/search/provider.ts` for all web-search entry points:
   - Default: DuckDuckGo
   - Optional upgrade: SearXNG via `SEARXNG_URL`
3. Keep memory in Supabase pgvector (`agent_memory`) and avoid parallel vector stores unless there is a proven bottleneck.
4. Treat self-hosted services (SearXNG, Apache Tika) as optional external dependencies pointed to by env vars, not in-process services on Vercel.
5. Every audit log entry must carry the real authenticated user's email — no hardcoded fallbacks.
6. All tenant-scoped queries use `tenant_id` (never `org_id`).

## Near-term roadmap (compliance kernel)

1. **PR1:** Kill config/drift — remove dead route references, clean scripts/docs.
2. **PR2:** Unify tenancy to `tenant_id` across all API routes and realtime subscriptions.
3. **PR3:** Fix audit attribution — replace all hardcoded actor emails with real auth user email.
4. **PR4:** Delete demo data (`data.json`) — wire consumers to real queries or empty states.
5. **PR5:** Ship kernel schema (evidence_artifacts, evidence_packs, execution_warrants, ledger_entries, policy_versions).
