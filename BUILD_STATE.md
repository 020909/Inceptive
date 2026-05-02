# BUILD_STATE — External Memory for AI Builder

**Last Updated:** Wave 5 — All 8 modules built, seed script complete, zero type errors
**Mission:** Build all 8 compliance modules to demo-ready state in 48 hours.

## Architecture Constants
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind + shadcn/ui + @xyflow/react
- **Backend:** Next.js API routes + Inngest for async jobs
- **Database:** Supabase (PostgreSQL) — existing compliance ontology at `supabase/033_compliance_ontology.sql`
- **Auth:** Supabase Auth (client: `@/lib/supabase`)
- **AI SDK:** Vercel AI SDK (`ai` package) with `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`
- **Model routing:** `src/lib/ai-model.ts` → buildModel(apiKey, provider, modelName)
- **UI tokens:** Foundry Black theme — CSS vars: `--fg-primary`, `--fg-muted`, `--accent`, `--surface-container`, `--border-subtle`, etc.

## DB Schema (migrations 032–036)
- `tenants` — multi-tenant boundary
- `companies` — name, registration_number, jurisdiction, risk_score, risk_tier, gleif_lei
- `persons` — full_name, dob, nationality, pep_status, sanctions_hit, risk_score
- `documents` — entity_id, file_url, parsed_content, parsing_status
- `ownership_relationships` — parent/child entity refs, ownership_percentage, relationship_type
- `cases` — case_number, case_type, title, status, priority, assigned_to, due_date
- `approval_queue` — case_type, entity_id, ai_draft (jsonb), ai_confidence, citations, status
- `sar_drafts` — case_id, fincen_form_type, subject_entities, narrative_draft, narrative_version, status
- `audit_log` — actor_id, actor_email, action_type, entity_type, before_state, after_state, ai_model_used, ai_prompt_hash, ip_address
- `alerts` — alert_number, alert_type, source, severity, status, risk_score, triage_result (jsonb), case_id
- `transactions` — transaction_id, source_system, amount, direction, counterparty_name, matched, reconciliation_run_id
- `policies` — title, policy_number, category, version, status, content, summary, tags, file_url
- `reconciliation_runs` — run_number, source_a/b_name, matched_count, exception_count, exceptions (jsonb)
- `vendor_assessments` — vendor_id, assessment_type, risk_score, risk_tier, findings (jsonb), recommendations

## Build Status — ALL MODULES COMPLETE ✅

| Module | Page | API Route | Status |
|--------|------|-----------|--------|
| AML Triage | `src/app/(dashboard)/aml-triage/page.tsx` | `/api/aml-triage` | ✅ Built |
| SAR Drafter | `src/app/(dashboard)/sar-drafter/page.tsx` | `/api/sar-drafter` | ✅ Built |
| Policy Vault | `src/app/(dashboard)/policy-vault/page.tsx` | `/api/policy-vault`, `/api/policy-vault/search` | ✅ Built |
| Reconciliation | `src/app/(dashboard)/reconciliation/page.tsx` | `/api/reconciliation` | ✅ Built |
| Vendor Analyst | `src/app/(dashboard)/vendor-analyst/page.tsx` | `/api/vendor-analyst` | ✅ Built |
| Audit Trail | `src/app/(dashboard)/audit-trail/page.tsx` | (reads audit_log directly) | ✅ Built |
| Approval Queue | `src/app/(dashboard)/approval-queue/page.tsx` | `/api/approval-queue/approve`, `/api/approval-queue/reject` | ✅ Pre-existing |
| Cases | `src/app/(dashboard)/cases/page.tsx` | `/api/cases` | ✅ Pre-existing |

## Already Built (DO NOT REBUILD)
1. ✅ Compliance ontology SQL (033, 034, 035) + new tables SQL (036)
2. ✅ Zod types in `src/types/compliance.ts` (all 11 row types + schemas)
3. ✅ UBO pipeline: upload API, parser, extractor, tree builder, screener, Inngest function
4. ✅ UBO frontend: upload, ownership tree (@xyflow/react), citations panel
5. ✅ Approval Queue: full table + approve/reject API routes + detail dialog
6. ✅ Cases page: full table with filters, pagination, create modal, realtime
7. ✅ Dashboard home: section cards + chart + data table
8. ✅ App shell: sidebar, header, command palette (Cmd+K)
9. ✅ Audit Trail: full table with hash display, action filter, search, detail dialog, pagination
10. ✅ AML Triage: alert list with severity/status filters, AI triage button, triage result dialog
11. ✅ SAR Drafter: drafts table, generate modal with case selector, view dialog with narrative
12. ✅ Policy Vault: policies table, create modal, view dialog, AI semantic search dialog
13. ✅ Reconciliation: runs table, new reconciliation modal with dual JSON input, exception viewer
14. ✅ Vendor Analyst: assessments table, new assessment modal, view dialog with findings/recommendations
15. ✅ Seed script: `scripts/seed-compliance.ts` — 10 sophisticated scenarios

## API Routes (all built)
- `/api/aml-triage` — POST (trigger AI triage on alert)
- `/api/sar-drafter` — POST (generate SAR narrative)
- `/api/policy-vault` — GET/POST (list/upload policies)
- `/api/policy-vault/search` — POST (semantic search via GPT-4o RAG)
- `/api/reconciliation` — POST (dual-source upload + matching engine), GET (list runs)
- `/api/vendor-analyst` — POST (AI risk assessment), GET (list assessments)
- `/api/approval-queue/approve` — POST
- `/api/approval-queue/reject` — POST
- `/api/cases` — CRUD
- `/api/ubo/upload` — POST
- `/api/auth/*` — Supabase auth
- `/api/health` — GET
- `/api/stripe/*` — billing

## Key Decisions
- Use Vercel AI SDK (`ai` + `generateText`) instead of LangGraph for all LLM calls — too heavy for 2-day sprint, can migrate later
- All AI routes use `buildModel()` from `src/lib/ai-model.ts` with `process.env.OPENAI_API_KEY` and provider "openai"
- Use `createAdminClient()` for server-side DB writes in API routes (bypasses RLS with service role key)
- Client pages use `createClient()` (browser) for reads, API routes for writes/AI calls
- SAR Drafter auto-creates approval_queue entry after generating narrative
- Vendor Analyst auto-creates approval_queue entry if risk assessment recommends review/rejection
- Matching engine in Reconciliation uses composite key: `transaction_id|amount|direction`
- Policy semantic search uses GPT-4o with policy content as context (no pgvector embeddings yet)
- base-ui Select `onValueChange` passes `(value: string | null, eventDetails)` — wrap setters with `(v) => v !== null && setState(v)`

## Seed Script Scenarios (`npm run seed:compliance`)
1. **Structuring/Smurfing** — Viktor Petrov: 7 sub-$10K wires to Baltic shell company
2. **PEP Layering** — Amara Okafor: $925K through BVI shell company, ownership chain
3. **Sanctions Near-Miss** — Nordgas Energy: 87.3% OFAC SDN name similarity
4. **False Positive** — Sarah Mitchell: Legitimate quarterly trust distributions, closed
5. **SAR Filing** — Dmitri Volkov: Complete SAR with 5-paragraph FinCEN narrative, filed
6. **Policy Vault** — 5 policies: AML Program, KYC Procedures, Sanctions Screening, Vendor Risk Mgmt, Reconciliation Controls
7. **Reconciliation** — Completed run: 1247 vs 1241 records, 99.3% match rate, 5 exceptions
8. **Vendor Assessments** — 4 vendors across low/medium/high risk tiers with detailed findings
9. **Approval Queue** — 3 pending items: vendor assessment, SAR filing, policy update
10. **Audit Trail History** — 10 entries spanning 30 days covering all action types

## Remaining Work
- 🟡 Dashboard polish — wire real compliance metrics into section cards
- 🟡 End-to-end demo flow testing (run seed → verify each page renders)
- 🟡 Consider pgvector embeddings for Policy Vault semantic search upgrade
- 🟡 Consider LangGraph migration for agent orchestration post-MVP

## Known Issues
- Client-side Supabase queries may fail on new tables if RLS policies require `request_tenant_id()` from JWT claims — browser client may not have tenant_id in JWT
- `vendors` table from 032 lacks `tenant_id` — vendor_assessments references vendor_id but vendors aren't tenant-scoped (potential cross-tenant data leak)
- Badge component uses custom variants (positive/negative) not standard shadcn (destructive)

## File Map Quick Reference
- Pages: `src/app/(dashboard)/*/page.tsx`
- API routes: `src/app/api/*/route.ts`
- Lib: `src/lib/*`
- Components: `src/components/*`
- Types: `src/types/compliance.ts`
- UBO lib: `src/lib/ubo/*`
- DB migrations: `supabase/*.sql`
- Seed script: `scripts/seed-compliance.ts`
- Build state: `BUILD_STATE.md` (this file)
