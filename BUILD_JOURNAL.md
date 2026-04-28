# BUILD_JOURNAL (append-only)

This file is the durable handoff log between waves/subagents.

Rules:
- Append only (never rewrite prior entries)
- Each wave logs: scope, files touched, key decisions, `npm run build` + `npm run lint` status

## Wave 0 — Orchestration setup (parent)
- **Time**: 2026-04-27
- **Notes**: Initialized journal. Reset working tree to clean HEAD before executing plan.

## Wave 0 — Phase 1 cleanup (parent)
- **Time**: 2026-04-27
- **Scope**: Removed non-compliance routes, APIs, libs, and UI modules. Preserved auth flows and Stripe billing/webhooks.
- **Key deletions**:
  - Dashboard routes removed: `src/app/(dashboard)/{agent,analyst,dashboard/**,email,github,goals,integrations,knowledge,playbooks,projects,reports,research,skills,social,team,upgrade,workflows}`
  - App routes removed: `src/app/{browser-agent,email-preview,org/**,puter-test,sidebar-demo,actions}`
  - API routes removed: most of `src/app/api/*` except `auth`, `cases`, `approval-queue`, `health`, `inngest`, `stripe`
  - Lib/modules removed: legacy agent/council/openmanus/connectors/research/memory/etc; stripped `src/lib/inngest/functions.ts` to empty export
  - Removed unused generators: `src/lib/{excel-generator.ts,pdf-generator.tsx}` and `src/lib/search/provider.ts`
  - Removed broken UI: `src/components/ui/monaco-editor-panel.tsx`, `src/components/approval-queue/ApprovalItemDetail.tsx`
- **Stripe decision**: kept `src/lib/stripe.ts` and `src/app/api/stripe/**`; removed credit-reset dependency from `src/app/api/stripe/webhook/route.ts`.
- **Dependencies removed**: uninstalled legacy packages (playwright, xlsx, pdf2json, monaco editor, etc.). Re-installed `framer-motion` because it is imported by auth/settings and auth is out-of-scope to edit.
- **Build/Lint**:
  - `npm run build`: PASS
  - `npm run lint`: PASS (warnings only)


