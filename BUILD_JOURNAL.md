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

## Wave 1 — Compliance ontology + types (parent)
- **Time**: 2026-04-27
- **Changes**:
  - Added DB migrations: `supabase/033_compliance_ontology.sql`, `supabase/034_compliance_rls.sql`, `supabase/035_case_number_sequence.sql`
  - Added types/contracts: `src/types/compliance.ts` (Zod + inferred TS types)
- **Build/Lint**:
  - `npm run build`: PASS
  - `npm run lint`: PASS (warnings only)

## Wave 2A — UBO backend pipeline (subagent)
- **Time**: 2026-04-27
- **Scope**: UBO document upload API, parsing/extraction/tree/screening libs, Inngest pipeline to populate `approval_queue.ai_draft` + audit log trail.
- **Files touched**:
  - `src/app/api/ubo/upload/route.ts`
  - `src/lib/ubo/{requestContext.ts,parser.ts,extractor.ts,treeBuilder.ts,screener.ts}`
  - `src/inngest/functions/uboParser.ts`
  - `src/lib/inngest/functions.ts`
- **Notes**:
  - Storage bucket: `kyb-documents` (service role only).
  - Inngest event: `ubo/document.uploaded`.
  - Audit log events added: upload accepted, parsing complete, extraction complete, screening complete, queue updated, decision pending.
- **Build**:
  - `npm run build`: (pending)

## Wave 2A — Build status update (subagent)
- **Time**: 2026-04-27
- **Build**:
  - `npm run build`: PASS

## Wave 2 — Audit Trail (subagent)
- **Time**: 2026-04-27
- **Scope**: Rewrote `Audit Trail` dashboard page to read tenant-scoped records from `audit_log`, add filters, CSV export, and right-side immutable record drawer.
- **Files touched**:
  - `src/app/(dashboard)/audit-trail/page.tsx`
- **Key decisions**:
  - Query `audit_log` via Supabase client with RLS tenant scoping; apply filters in query (`created_at` range, `actor_email` ilike, `action_type`, `decision`).
  - Case ID column is derived heuristically: `entity_type === "case" ? entity_id : before_state/after_state.case_id` (when present).
  - Drawer uses `Sheet` (right-side) and renders `before_state` / `after_state` as formatted JSON plus citations.
- **Build/Lint**:
  - `npm run build`: FAIL — Turbopack reported module resolution error: `@/components/layout/command-palette` imported by `src/components/layout/app-shell.tsx`.
  - `npm run lint`: NOT RUN


## Wave 2C — App shell (Sidebar + Header + Cmd+K) (subagent)
- **Time**: 2026-04-27
- **Scope**: Implemented Wave 2C dashboard app shell layout (Sidebar + 56px Header + full-width content surface) and added a Cmd+K command palette for navigation/actions.
- **Files touched**:
  - `src/components/layout/app-shell.tsx`
  - `src/components/layout/app-sidebar.tsx`
  - `src/components/layout/app-header.tsx` (new)
  - `src/components/layout/command-palette.tsx` (new)
  - `package.json` (added `cmdk`)
  - `package-lock.json`
- **Key decisions**:
  - Sidebar nav order updated per spec, with active state using `var(--surface-container)` + left border in `var(--border-strong)` (no indigo).
  - Header is fixed at `h-14` (56px) and exposes command palette via Cmd+K + clickable search field.
  - Command palette implemented with `cmdk` inside existing dialog; includes grouped navigation items matching sidebar order.
- **Build/Lint**:
  - `npm run build`: PASS

## Wave 2B — UBO frontend (subagent)
- **Time**: 2026-04-27
- **Scope**: Added `/ubo` dashboard UI (upload → entities/citations → ownership tree) and realtime processing stepper subscribing to `approval_queue` by `queue_id`.
- **UI decisions**:
  - Foundry Black tokens only (no shadows, no hover-scale, 6px radius for new UBO widgets).
  - Upload uses XHR + FormData to expose progress events.
  - Ownership tree uses `@xyflow/react` with a simple top-down layout + Minimap + FitView + PNG export (SVG foreignObject → canvas).
- **Files touched**:
  - `src/components/ubo/DocumentUpload.tsx`
  - `src/components/ubo/OwnershipTree.tsx`
  - `src/components/ubo/CitationsPanel.tsx`
  - `src/app/(dashboard)/ubo/page.tsx`
  - Build fix (unrelated): `src/components/layout/app-sidebar.tsx` (missing `Coins` import)
  - Build fix (unrelated): `src/lib/ubo/parser.ts` (PDF parsing moved to `pdfjs-dist` to satisfy Turbopack/exports)
- **Build**:
  - `npm run build`: PASS

## Wave 3A — Approval Queue (parent)
- **Time**: 2026-04-27
- **Scope**: Rewired maker-checker approvals to the new compliance ontology (`approval_queue` + `audit_log`) and removed legacy org/user_profile dependencies.
- **Files touched**:
  - `src/app/(dashboard)/approval-queue/page.tsx`
  - `src/app/api/approval-queue/{approve,reject}/route.ts`
- **Build/Lint**:
  - `npm run build`: PASS
  - `npm run lint`: PASS (warnings only)

## Wave 3B — Dashboard Home (parent)
- **Time**: 2026-04-27
- **Scope**: Added `/dashboard` operations center (queue snapshot + recent immutable audit activity).
- **Files touched**:
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/components/layout/{app-sidebar.tsx,command-palette.tsx}` (dashboard route wiring)
- **Build/Lint**:
  - `npm run build`: PASS
  - `npm run lint`: PASS (warnings only)

