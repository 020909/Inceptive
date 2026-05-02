# Inceptive — Build Plan v3 (Repo-Grounded)

> **HOW TO USE THIS FILE**
> This is the source of truth. Read it fully at the start of every coding session.
> Do not trust agent memory; trust this file. When you complete a PR, check its box
> in the "Status" section. Do not skip acceptance gates. If a gate fails, stop and fix.

---

## North Star (one sentence)

Ship the **Regulated Action Kernel**:
**Evidence In → AI Draft → Human Approves → Warrant Issued → Minimal Execute → Ledger Entry → Replay → Export Packet.**

Everything else (landing page, "10-agent council," SAR/AML/vendor/reconciliation modules) is deferred until the kernel runs end-to-end on real data with zero demo content.

---

## Source of Truth — Verified Repo Claims (do not re-litigate)

| Claim | Status | Evidence |
|---|---|---|
| `/api/agent/stream` exists | **FALSE — config drift removed** | Dead reference removed from `vercel.json`; no route ever existed |
| `/api/internal/agent-tick` exists | **FALSE — config drift removed** | Dead reference removed from `vercel.json`; worker script deleted |
| `/api/cron/*` endpoints exist | **FALSE — config drift removed** | Dead cron entries removed from `vercel.json`; Inngest handles scheduling |
| Approval queue is placeholder | **FALSE** | `src/app/api/approval-queue/approve/route.ts` is real, DB-backed, tenant-scoped |
| Audit attribution is real | **FALSE** | `src/app/api/approval-queue/approve/route.ts:86` hardcodes `actor_email: "user@inceptive-ai.com"` |
| Tenancy is unified | **FALSE** | `src/app/api/cases/route.ts:67,70,147` uses `org_id`; approval-queue uses `tenant_id` |
| Dashboard data is real | **FALSE** | `src/components/blocks/data.json` is hardcoded proposal-doc demo data, not even fintech themed |
| Real APIs that exist | **TRUE** | `approval-queue/{approve,reject}`, `auth/{google,microsoft,meta,linkedin,twitter,tiktok,telegram}`, `cases`, `health`, `inngest`, `stripe/{webhook,portal,checkout,setup}`, `ubo/upload` |

**Stop-ship implications:** ~~vercel cron 404s~~ (fixed), fictional audit log (legal risk), two competing tenancy models (one bypasses RLS), hardcoded demo data shipped to prod.

---

## Status (check boxes as you complete)

### Day 1 Morning — Stop-Ship Block
- [x] PR #1: Kill config drift in `vercel.json` + docs + scripts
- [ ] PR #2: Unify tenancy to `tenant_id`
- [ ] PR #3: Fix audit attribution (real user email)
- [ ] PR #4: Delete `data.json` + fix consumers
- [ ] **Acceptance gate A** (see below)

### Day 1 Afternoon — Kernel Foundation
- [ ] PR #5: Schema migration (5 kernel tables)
- [ ] PR #6: Evidence Pack service + tamper test
- [ ] **Acceptance gate B**

### Day 2 Morning — Warrant + Ledger
- [ ] PR #7: Warrant issuance on approval
- [ ] PR #8: Warrant-gated executor
- [ ] PR #9: Ledger UI (query, replay, export)
- [ ] **Acceptance gate C**

### Day 2 Afternoon — One Real Workflow
- [ ] PR #10: KYB workflow end-to-end through kernel
- [ ] **Final acceptance checklist** (11 boxes, see end)

---

## PR Details

### PR #1 — Kill config drift (30 min)

Replace `vercel.json` with:

```json
{
  "crons": [],
  "functions": {
    "src/app/api/inngest/route.ts": { "maxDuration": 60 }
  }
}
```

Rule: every entry must point to a route that exists in `src/app/api/`. Use Inngest (already wired) for scheduled work.

### PR #2 — Unify tenancy to `tenant_id` (90 min)

Files:
- `src/app/api/cases/route.ts:67,70,147,273` — replace `org_id` with `tenant_id`.
- Replace `user_profiles.org_id` lookup with `getTenantIdFromRequest` helper from `src/lib/ubo/requestContext` (already used in approval-queue).
- Supabase migration: `ALTER TABLE cases RENAME COLUMN org_id TO tenant_id;` (or add+backfill+drop).
- Update RLS policies on `cases` to filter on `tenant_id`.

### PR #3 — Fix audit attribution (45 min)

In `src/app/api/approval-queue/approve/route.ts:86` and `reject/route.ts`, replace hardcoded `actor_email: "user@inceptive-ai.com"` with the authenticated user's email from Supabase auth.

Add unit assertion: `audit_log.actor_email === auth.user.email` for every approve/reject.

### PR #4 — Burn the demo data (45 min)

Delete `src/components/blocks/data.json`. Find consumers with `rg "blocks/data" src/`. For each: either delete the component, or wire it to a real query against `cases` / `approval_queue` / `audit_log`. If no real query exists yet, render an empty state — never hardcoded fixtures.

### Acceptance Gate A (end of Day 1 morning)

- `git grep "org_id" src/app/api` → 0 results
- `git grep "user@inceptive-ai.com"` → 0 results
- `git grep "blocks/data.json"` → 0 results; file deleted
- Every path in `vercel.json` resolves to a real handler

### PR #5 — Kernel schema migration

One Supabase migration. Five tables. All with `tenant_id` and RLS (`tenant_id = current_tenant()`).

```sql
create table evidence_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  kind text not null,                    -- 'document','extraction','citation','tool_output','external_signal'
  source_uri text,
  content_hash text not null,
  parent_artifact_id uuid references evidence_artifacts(id),
  offsets jsonb,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create table evidence_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_id uuid references cases(id),
  pack_hash text not null,
  policy_version_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table evidence_pack_items (
  pack_id uuid references evidence_packs(id) on delete cascade,
  artifact_id uuid references evidence_artifacts(id),
  role text not null,                    -- 'input','citation','draft','reference'
  primary key (pack_id, artifact_id, role)
);

create table execution_warrants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  evidence_pack_id uuid not null references evidence_packs(id),
  approval_id uuid not null references approval_queue(id),
  scope jsonb not null,
  expires_at timestamptz not null,
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_by_action_id uuid
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  prev_entry_hash text,
  entry_hash text not null,
  warrant_id uuid references execution_warrants(id),
  evidence_pack_id uuid references evidence_packs(id),
  policy_version_hash text not null,
  actor_id uuid not null,
  action_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table policy_versions (
  version_hash text primary key,
  tenant_id uuid not null,
  bundle jsonb not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
```

### PR #6 — Evidence Pack service

`src/lib/kernel/evidence.ts`:
- `createArtifact(tenantId, kind, payload, parent?, offsets?)` — canonicalize, sha256, insert.
- `createPack(tenantId, caseId, artifacts[], policyVersionHash, userId)` — `pack_hash = sha256(sortedArtifactIds + sortedContentHashes + policyVersionHash)`.
- `verifyPack(packId)` — recompute and compare. Returns boolean.

### Acceptance Gate B

Unit test: insert artifact → build pack → mutate artifact `content_hash` directly in DB → call `verifyPack` → expect `false`. Tamper detection works.

### PR #7 — Warrant issuance on approval

Modify `src/app/api/approval-queue/approve/route.ts`:
1. Require queue item to reference an `evidence_pack_id` (add column).
2. On approval, in same transaction:
   - Insert `execution_warrants` with scope/limits/expiry from `queueItem.action_type` and `queueItem.payload`.
   - Insert `ledger_entries` with `action_type='warrant_issued'`, `prev_entry_hash` = last entry's `entry_hash` for this tenant (use Postgres advisory lock per tenant for concurrent safety).
3. Return warrant id.

Same surgery on `reject/route.ts`: ledger entry with `action_type='approval_rejected'` + reason.

### PR #8 — Warrant-gated executor

New: `src/app/api/kernel/execute/route.ts`:
- Accepts `{ warrant_id, action_payload }`.
- Verifies: tenant match, not expired, not consumed, scope matches payload.
- Executes the action (for KYB demo: stub `sendKybDecision` writes to `kyb_decisions` table; no external network).
- Writes `ledger_entries` with `action_type='action_executed'`.
- Marks warrant `consumed_at` and `consumed_by_action_id`.

This is the **only** path to mutate regulated state. No other route writes to `kyb_decisions`, `sar_drafts`, etc.

### PR #9 — Ledger UI

`src/app/dashboard/ledger/page.tsx`:
- Table view of `ledger_entries`, filterable by case/actor/action_type/date.
- Click entry → side panel: full payload, linked evidence pack, linked warrant, linked policy version (with diff vs current).
- **Verify Chain** button: walks `prev_entry_hash` chain for tenant, returns green if intact.
- **Export Packet** button: zips evidence pack artifacts + warrant + ledger entries + policy version JSON → `case-{id}-{date}.zip`.
- **Replay** button: re-runs the policy version against the original evidence pack, shows side-by-side "decision then" vs "decision now."

### Acceptance Gate C

From ledger UI: pick any entry → Replay shows side-by-side decision comparison. Export produces a zip on disk whose hashes match DB.

**Honest cut if behind:** drop Replay; ship Verify Chain + Export only. Replay is the magic but Verify+Export wins a pilot conversation.

### PR #10 — KYB workflow end-to-end

Pick **KYB only**. Not SAR, not vendor, not reconciliation. KYB has cleanest evidence shape (uploads already work via `src/app/api/ubo/upload/route.ts`).

Flow:
1. Upload KYB docs → `ubo/upload` creates `evidence_artifacts` of kind `document`.
2. New: `src/app/api/kernel/draft/route.ts`:
   - Calls free-tier LLM (Groq Llama 3.3 70B or Gemini 2.0 Flash via OpenRouter — BYOK, no paid keys).
   - Returns extracted entity data + risk + **citations as `(artifact_id, offsets, snippet_hash)`** (NVIDIA Enterprise RAG pattern).
   - Validation pass: every cited offset must match an existing artifact and snippet hash must match. If mismatch, reject and retry.
   - Creates `evidence_pack` with input artifacts + draft (kind=`extraction`) + citation artifacts.
   - Inserts `approval_queue` row with pack id.
3. Reviewer opens approval queue, sees draft + every citation linked back to source PDF with offsets.
4. Approve → PR #7 fires → warrant → PR #8 executor → ledger chain.
5. From ledger: replay + export.

**Critical UX rule:** if any draft field has no citation pointing to an artifact, UI shows it as "uncited — cannot be approved." Single rule kills hallucination AND demonstrates regulatory grade.

---

## Final Acceptance Checklist (all must pass before "done")

- [ ] `git grep "org_id" src/app/api` → 0 results
- [ ] `git grep "user@inceptive-ai.com"` → 0 results
- [ ] `git grep "blocks/data.json"` → 0 results; file deleted
- [ ] Every path in `vercel.json` resolves to a real route handler
- [ ] Unit test: tampered artifact fails `verifyPack`
- [ ] Unit test: expired warrant cannot be consumed
- [ ] Unit test: warrant scope mismatch rejects execution
- [ ] Integration test: full KYB flow from upload to export packet, < 90 seconds
- [ ] Ledger UI: Verify Chain returns green on a fresh tenant
- [ ] Export Packet: produces a zip whose hashes match the DB
- [ ] No marketing copy claims "SOC 2 Type II," "10-agent council," or any agent count

---

## Demo Script (8 minutes, zero theater)

- **0–1** Setup: "AI in regulated work is only valuable if every action is provable. One workflow, end-to-end, no canned data."
- **1–2** Evidence in: upload 3 KYB docs → show artifacts with content hashes.
- **2–4** Draft with citations: hover any field → popup with source PDF/page/offset/snippet. "Every claim cited or it can't be approved."
- **4–5** Approval & warrant: queue → policy version hash + pack hash → approve → show warrant (scope, limits, expiry, one-shot).
- **5–6** Execute & ledger: action runs → ledger chain → Verify Chain → green.
- **6–7** Replay: pick entry → "decision then" vs "decision now under current policy." "If a regulator asks why we approved this six months ago, we prove what the rules were."
- **7–8** Export: download zip → show artifacts, draft, citations, warrant, ledger, policy JSON. "What an auditor receives. Every hash independently verifiable."

---

## What We Are NOT Building (and why)

| Thing | Why cut |
|---|---|
| Enterprise landing page | Doesn't move a pilot. After first paying design partner. |
| "10-agent council with streaming" | Doesn't exist; conflicts with kernel; marketing fiction = procurement risk |
| Real-time analytics dashboard | Free output of working ledger; don't build separately |
| SAR / AML / Vendor / Reconciliation modules | Feature sprawl before kernel proven = demo theater. KYB proves the shape. |
| RBAC UI | Tenancy + RLS enough for beta. Phase 2. |
| SOC 2 Type II claim on marketing | **Remove from any public surface today.** Fraud risk if untrue. |

---

## NVIDIA Patterns → Inceptive Primitives (no NIM, no GPUs, no paid APIs)

| Blueprint | Pattern stolen | Where in kernel |
|---|---|---|
| Data Flywheel | Structured run logging → failure datasets → regression evals | `ledger_entries` is the structured log; Phase 2: weekly Inngest job builds golden set from rejected approvals; Promptfoo for regression |
| Enterprise RAG | Citations must reference artifact id + offsets | Enforced in PR #10 draft route; UI blocks approval of uncited fields |
| AI-Q Research Agent | Planner routes between internal evidence + external signals; **no Tavily** | Phase 2: replace external signals with FinCEN RSS, OFAC list deltas, Watchman self-hosted |
| Streaming Data to RAG | Time-window queries (`captured_at` filters) | `evidence_artifacts.captured_at` indexed; ledger UI supports "last 24h / since policy hash X" |
| Vulnerability Analysis | Evidence → report → approval → ledger → export shape | This **is** the kernel. Phase 2: Trivy in CI for SBOM artifacts. |
| Transaction Foundation Model | — | **Do not adopt.** Phase 3 research only. |

---

## Risks & Honest Cuts

| Risk | Mitigation |
|---|---|
| LLM hallucinates citations | Validation pass: every cited offset must match existing artifact AND snippet hash must match. Mismatch = reject back to model. |
| Hash chain breaks on concurrent writes | `prev_entry_hash` written inside Postgres advisory lock per tenant |
| Free-tier LLM rate limits during demo | Cache demo run beforehand. Recorded fallback. **No live LLM calls during the critical 8 minutes.** |
| RLS migration drops a row | Migration in transaction; staging dry-run; backup first |
| Day 2 afternoon overruns | If PR #10 not done by hour 6 of Day 2, ship kernel without KYB and demo using manually-seeded evidence pack. **The kernel is the product; KYB is the example.** |

---

## Resume Instructions for a New Session

If you (agent or human) are reading this cold:

1. Re-verify the "Source of Truth" table by running:
   ```
   ls src/app/api
   grep -n "org_id\|user@inceptive-ai.com" src/app/api -r
   cat vercel.json
   ```
2. Find the first unchecked box in "Status" and start there.
3. Do not skip acceptance gates.
4. If anything in this plan conflicts with what you see in code, **the code wins**. Update this file with what you actually find before proceeding.
5. Do not build SAR, AML, vendor analyst, reconciliation, or a landing page in the 2-day window. Period.
