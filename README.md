# Inceptive

Compliance-focused **Next.js + Supabase** app with AI-powered compliance modules (AML triage, SAR drafter, policy vault, reconciliation, vendor analyst), approval-queue maker-checker, OAuth connectors, and Stripe billing.

## Quick start

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Apply SQL in `supabase/` (in order) in the Supabase SQL editor.

## Architecture & roadmap

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for the full system map and autonomy plan.

## Background work

Background and scheduled work is handled by **Inngest** (already wired in the app). No external worker process needed.

## Docker

```bash
docker compose up --build
```

Requires `.env` with Supabase and Stripe (if used) credentials.

---

Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
