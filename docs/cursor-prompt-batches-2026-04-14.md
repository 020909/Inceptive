# Cursor / Codex Prompt Batches For Inceptive

Date: April 14, 2026

## Usage Rules

Run these in order. Do not skip ahead.

- Do not fabricate UI states, analytics, memories, integrations, or approvals.
- If something is not implemented, either implement it properly or hide it.
- Reuse the existing stack: `Next.js 16`, `React 19`, `TypeScript`, `Supabase`, `Tailwind`, `Framer Motion`.
- Prefer wiring existing tables, APIs, and runtime pieces before creating new abstractions.
- Preserve existing user changes. Do not revert unrelated work.
- When referencing open-source repos, do not copy code from GPL, AGPL, fair-code, or mixed open-core projects into Inceptive. Reimplement ideas in Inceptive's stack.
- Every batch must finish with tests, QA notes, and a concise change summary in the output.

## Prompt 1

```text
You are upgrading Inceptive from "ambitious demo" to "trustworthy product". Start with a source-of-truth cleanup pass.

Repository facts:
- Stack is Next.js 16 + React 19 + TypeScript + Supabase + Tailwind + Framer Motion.
- The app already has org workspaces, workflows, scheduled tasks, model settings, reports, research, credits, and a job executor.
- The current trust problem is fake/demo/placeholder UI in user-facing surfaces.

Primary targets:
- src/app/(dashboard)/dashboard/page.tsx
- src/components/agent/MemoryPanel.tsx
- src/app/(dashboard)/github/page.tsx
- src/app/(dashboard)/social/page.tsx
- src/lib/connectors/computer-use.ts
- any related components/APIs needed to replace fake states

Your job:
1. Remove or replace every user-facing fake/demo/placeholder state in the above surfaces.
2. Dashboard must show real data when available and honest empty states when not available. No placeholder task arrays, fake agent runs, or fake recent tasks.
3. MemoryPanel must use real memory data from the existing memory backend instead of hardcoded demo memories.
4. GitHub page must stop advertising unsupported OAuth if it is not actually implemented. Either implement the real flow end-to-end or present the current supported PAT flow cleanly without “coming soon”.
5. Social/connectors UI must not tease unsupported connectors. Hide or clearly mark unavailable connectors inside an internal/admin-only state, not the main production UX.
6. Computer use must not appear production-ready if the connector is still a placeholder. Gate it behind an explicit experimental/runtime availability check.
7. Search for similar placeholder/fake/demo/coming soon strings in the repo and clean any remaining production-facing trust breakers.

Constraints:
- Do not invent new fake metrics to replace the old ones.
- Prefer using existing Supabase tables and existing APIs.
- If an empty state is needed, write clean enterprise UI copy that is honest.

Acceptance criteria:
- No hardcoded demo memories remain in the user-facing Memory panel.
- No placeholder arrays power the dashboard metrics or recent activity.
- Unsupported features are not advertised as working.
- The app feels more honest, even if some features are temporarily hidden.
- Add or update tests where practical.

At the end:
- summarize exactly what fake/demo behavior was removed
- list all changed files
- list any still-missing enterprise features you deliberately left out of this batch
```

## Prompt 2

```text
Build the enterprise website and positioning layer for Inceptive. Right now src/app/page.tsx only redirects to /dashboard. Replace that with a real marketing site that can win investor and enterprise trust.

Business positioning:
- ICP: growth companies and mid-market teams first, enterprise-ready architecture
- Core message: ecosystem-agnostic AI operations team that automates cross-system work
- Tone: credible, sharp, enterprise, not generic AI hype

Competitive benchmarks to learn from:
- Airia: orchestration + security + governance
- WRITER: AI HQ, ready agents, ROI framing
- Kore.ai: multi-agent orchestration, observability, connectors, templates
- Sema4.ai: Studio / Control Room / Work Room separation

Current repo facts:
- app already contains real features: workflows, reports, research, email, org analytics, settings, multi-model support
- dashboard has some analytics, but root site does not exist
- pricing logic lives in src/lib/stripe.ts and upgrade surfaces exist

Your job:
1. Replace the root redirect with a polished landing page.
2. Add sections for:
   - hero with a non-generic enterprise message
   - “how it works” tied to actual product primitives
   - real use cases based on current capabilities
   - enterprise differentiators: orchestration, approvals, model flexibility, connectors, observability
   - ROI framing
   - pricing section that is aligned with actual billing implementation or updated end-to-end if you change pricing
   - trust/security/governance section
   - CTA to product and demo/contact path
3. Reuse the established design language, but make it feel premium and intentional. Use strong typography, gradients/patterns, and motion without becoming generic SaaS sludge.
4. Do not add fake customer logos, fake testimonials, or fake statistics.
5. If you need product visuals, derive them from real app surfaces/components instead of made-up screenshots.

Constraints:
- If you change plan names or prices, you must update all related plan metadata, upgrade UI, and any exposed copy consistently.
- Do not break authenticated app routing.

Acceptance criteria:
- Visiting / shows a real homepage, not a redirect.
- Messaging is enterprise-grade and consistent with the actual product.
- Pricing and feature claims do not exceed what the product can currently support.
- Mobile and desktop both look intentional.

At the end:
- explain the new ICP and headline strategy in 5 bullets max
- list changed files
- call out any pricing/backend assumptions made
```

## Prompt 3

```text
Upgrade Inceptive’s Command Center and analytics into a real observability + ROI surface.

Primary targets:
- src/app/(dashboard)/dashboard/page.tsx
- src/app/org/[slug]/analytics/page.tsx
- src/lib/analytics.ts
- src/app/api/dashboard/route.ts if useful
- related components you need to create

Competitive inspiration:
- Kore.ai observability and agent tracing
- WRITER observability and ROI framing
- Airia model lifecycle + cost control

What exists already:
- analytics_events
- agent_activity_log
- org_workflows
- credit transactions / plan info
- scheduled tasks and jobs

Your job:
1. Replace the current simplistic dashboard with real, enterprise-relevant metrics:
   - runs completed
   - success/failure rate
   - active workflows
   - queued/running/failed jobs
   - credits or cost consumed
   - estimated hours saved
   - estimated value created
2. Add a real “human review” / “needs attention” panel, even if initial scope is from failed jobs, approval-pending actions, or connector issues.
3. Add recent run history with meaningful statuses and timestamps.
4. Improve org analytics so admins can see adoption and workflow usage across the workspace.
5. Instrument missing events needed for these metrics.
6. Keep all numbers grounded in actual data. If a metric cannot yet be calculated reliably, omit it or label it clearly as estimated with formula details.

Constraints:
- No fabricated charts.
- Avoid clutter; optimize for operations managers and admins.
- Enterprise-grade empty/loading/error states.

Acceptance criteria:
- Dashboard tells a truthful story of system health and business value.
- Org admins can understand agent usage and activity without digging through the DB.
- ROI is explicit and formula-backed.

At the end:
- document each new metric and how it is computed
- list changed files
- list any future events/data you recommend logging next
```

## Prompt 4

```text
Build a real approval, audit, and governance layer for Inceptive. Right now approval behavior is mostly local state and not enterprise-grade.

Primary targets:
- src/lib/agent-context.tsx
- src/app/(dashboard)/settings/page.tsx
- src/app/org/[slug]/settings/page.tsx
- relevant APIs under src/app/api/
- Supabase SQL migrations if needed

Benchmarks:
- Kore.ai RBAC + audit logs
- Airia governance + accountability
- WRITER approvals/admin controls
- Veza least-privilege and identity governance mindset

Your job:
1. Replace local-only approval toggles with durable server-backed approval settings and approval items.
2. Introduce a review queue model for actions that require human approval.
3. Add audit logging for:
   - workflow activation/deactivation
   - connector changes
   - model configuration changes
   - approval decisions
   - admin/member changes
4. Add an enterprise settings surface for governance:
   - who can approve
   - what categories require approval
   - audit log browsing/filtering/export
5. Add role-aware behavior where practical, even if full RBAC comes later.

Constraints:
- Use clean DB-backed primitives, not temporary client-only state.
- Make this extensible for future SSO/RBAC work.
- Do not fake compliance claims.

Acceptance criteria:
- Approval decisions persist and are visible in a review queue/history.
- Important operational changes generate audit records.
- Settings clearly separate personal settings from org governance settings.

At the end:
- describe the new data model
- list every new table/column/index/policy added
- list changed files
```

## Prompt 5

```text
Turn Inceptive’s connectors into a governed connector platform instead of a loose collection of pages and OAuth flows.

Primary targets:
- src/app/(dashboard)/social/page.tsx
- src/app/(dashboard)/settings/page.tsx
- src/app/(dashboard)/github/page.tsx
- src/app/api/connectors*
- src/lib/connectors/*
- any new admin/connectors surfaces you need

Benchmarks:
- WRITER connectors + MCP gateway controls
- Kore.ai integrations and connector breadth
- Airia secure integrations

Your job:
1. Create a unified connector control center that shows:
   - connector status
   - auth method
   - scopes/tools enabled
   - health/last sync
   - who can use it
2. Normalize connector definitions so unsupported connectors are not surfaced as if they are production-ready.
3. Add connector policies:
   - enabled/disabled
   - org-wide vs team-specific access
   - read/write action scope display
4. Improve secret handling UX and connector health diagnostics.
5. Make GitHub, email, social, and messaging connectors feel part of one system rather than separate product islands.
6. If appropriate, create a connector catalog page and de-emphasize the current “social” naming.

Constraints:
- Reuse existing backend routes where possible.
- Do not overbuild a marketplace yet; focus on governance and operational clarity.

Acceptance criteria:
- A user/admin can understand connector readiness and permissions from one place.
- Connector UX is consistent across providers.
- Unsupported providers are no longer misleading.

At the end:
- list the connector model/design decisions you made
- list changed files
- list which connectors are fully supported vs partial vs hidden
```

## Prompt 6

```text
Harden Inceptive’s workflow engine and template system into a real enterprise orchestration surface.

Primary targets:
- src/app/org/[slug]/workflows/page.tsx
- src/app/org/[slug]/workflows/active/page.tsx
- src/app/org/[slug]/workflows/builder/page.tsx
- src/components/workflow/workflow-builder.tsx
- src/components/org/workflow-templates-gallery.tsx
- src/lib/workflow-nodes.ts
- src/lib/supabase/workflows-core.ts
- relevant APIs and SQL if needed

Benchmarks:
- Kore.ai multi-agent orchestration
- n8n node-based workflows
- Activepieces piece/plugin model
- Airia orchestration + prototyping

Your job:
1. Upgrade workflow templates from “nice cards” into clearly production-usable automations with:
   - trigger definition
   - tool/action definition
   - approval requirements
   - run history
   - version/status
2. Improve the workflow builder UX and node semantics so it feels deliberate and enterprise-grade.
3. Add execution history and failure visibility for workflows.
4. Add template metadata that supports industry/use-case packaging later.
5. Reconcile overlapping concepts if needed:
   - goals
   - workflows
   - projects
   If there is confusion, simplify the product model instead of preserving product debt.
6. Build toward multi-agent patterns where useful, but do not fake orchestration depth that the runtime cannot support.

Constraints:
- Prefer using the existing workflow and org tables first.
- Keep builder responsive and understandable for both business and technical users.

Acceptance criteria:
- Workflow pages look and behave like a serious automation product.
- Admins can activate, inspect, and manage workflows with confidence.
- Product terminology is cleaner than before.

At the end:
- explain the updated product model in plain English
- list changed files
- list any DB changes
```

## Prompt 7

```text
Upgrade Settings into a real model hub + runtime policy center, and harden the agent runtime around it.

Primary targets:
- src/app/(dashboard)/settings/page.tsx
- src/lib/ai-model.ts
- src/lib/ai/model-router.ts
- src/lib/agent/executor.ts
- src/lib/agent/task-queue.ts
- src/app/api/agent/*
- related org/admin settings surfaces if needed

Benchmarks:
- Kore.ai Model Hub / Model Factory / Evaluation Studio
- Airia model lifecycle and cost controls
- Sema4 shared configurations and model settings

Your job:
1. Turn the current provider/model settings into a real model hub:
   - provider/model registry
   - default model by task type
   - fallback routing
   - BYOK visibility
   - cost / latency notes
2. Add runtime policies:
   - max autonomy level
   - approval requirements by tool/task class
   - budget/credit limits
   - connector access policy hooks
3. Remove or isolate legacy stub job kinds where possible.
4. Add better execution metadata for agent runs: model used, duration, result status, error class.
5. Prepare the runtime for later evaluation and replay without rewriting the whole system.

Constraints:
- Keep current functionality working.
- Prefer additive hardening over broad rewrites.

Acceptance criteria:
- Settings become operationally meaningful for admins and power users.
- Runtime decisions are more observable and configurable.
- Legacy stub behavior is reduced or clearly isolated.

At the end:
- describe the model-selection and fallback strategy
- list changed files
- list follow-up work needed for full eval/replay
```

## Prompt 8

```text
Upgrade Inceptive’s research, reporting, and source handling so it feels enterprise-credible instead of generic AI output.

Primary targets:
- src/app/(dashboard)/research/page.tsx
- src/app/(dashboard)/reports/page.tsx
- src/app/api/agent/research/route.ts
- src/app/api/reports/route.ts
- related components/libs under src/lib/research and report generation

Benchmarks:
- WRITER Knowledge Graph and citations
- Kore.ai Search + Data AI
- investor requirement for competitor intelligence and measurable value

Your job:
1. Make research outputs source-aware and citation-first.
2. Add explicit sections in report outputs for:
   - summary
   - findings
   - sources
   - confidence / caveats
   - recommended next actions
3. Improve competitor analysis/report templates to be more executive-readable.
4. Ensure downloadable reports preserve source attribution where possible.
5. If the current UI is weak, redesign the report/research reading experience to feel like a serious analyst workspace.

Constraints:
- No fabricated citations.
- If a source is weak or missing, say so clearly in the output.
- Optimize for decision support, not chat verbosity.

Acceptance criteria:
- Research and report outputs are more trustworthy and auditable.
- Executives can scan a report quickly and still see evidence.

At the end:
- explain how source attribution now works
- list changed files
- list any remaining quality limits
```

## Prompt 9

```text
Build the enterprise workspace/admin layer needed for real team usage.

Primary targets:
- src/app/org/[slug]/dashboard/page.tsx
- src/app/org/[slug]/activity/page.tsx
- src/app/org/[slug]/settings/page.tsx
- src/components/org/*
- src/lib/supabase/org-core.ts
- related APIs and SQL

Benchmarks:
- Sema4 Control Room / Work Room separation
- Kore.ai admin and governance surfaces
- Mattermost/OpenProject/AppFlowy collaboration patterns

Your job:
1. Improve the org admin experience so it feels like a real control room:
   - members
   - roles
   - workflow adoption
   - connector access
   - recent activity
   - governance shortcuts
2. Make org activity useful for operators, not just decorative.
3. Add missing admin affordances for inviting, managing, and reviewing workspace activity.
4. Separate personal settings from organization settings clearly.
5. Prepare the structure for future SSO/SAML/SCIM without shipping fake enterprise checkboxes.

Constraints:
- Use current org primitives and extend them cleanly.
- Avoid adding fake “enterprise” labels without real behavior.

Acceptance criteria:
- A workspace admin can operate Inceptive as a team product.
- Org surfaces feel coherent and distinct from the personal dashboard.

At the end:
- summarize the admin mental model you implemented
- list changed files
- list what remains for SSO/SCIM/RBAC phase 2
```

## Prompt 10

```text
Do the enterprise QA, deployment, and hardening pass for Inceptive.

Primary targets:
- tests/smoke/core-flows.spec.ts
- add more Playwright/unit/integration tests where needed
- docs/*
- health/check routes and deployment docs

Repo facts:
- There is currently only one meaningful smoke test.
- The app already has auth, workflows, scheduled tasks, connectors, reports, org analytics, and billing.

Your job:
1. Expand automated coverage for the most business-critical flows:
   - auth and dashboard load
   - settings/model config save
   - workflow activation / workflow builder save
   - scheduled task create
   - report generation
   - research generation
   - connector management paths that are testable without live third-party auth
2. Add targeted unit/integration coverage around job execution, metrics, and approval/audit logic created in earlier batches.
3. Add deployment and ops docs for:
   - required env vars
   - cron setup
   - Supabase prerequisites
   - self-host baseline
   - health checks
   - backup/recovery notes
4. Harden health/status surfaces so operators can tell if core systems are alive.

Constraints:
- Tests should be realistic and high-signal, not snapshot spam.
- Do not rely on inaccessible third-party live services in default test runs.

Acceptance criteria:
- The product has materially better regression protection.
- A technical buyer could understand how to run and operate it.
- Health and deployment posture are stronger than before.

At the end:
- list new test coverage by area
- list new docs created or updated
- list remaining production-readiness gaps
```

## Prompt 11

```text
Design and, where reasonable, implement the OpenClaw / NemoClaw-inspired extension strategy for Inceptive without blindly importing those projects.

Reference ideas:
- OpenClaw: gateway control plane, multi-channel assistant, skills packaging, onboarding
- NemoClaw: hardened sandbox, policy-based privacy/security guardrails, managed inference, runtime hardening

Important constraints:
- Inceptive is a Next.js + TypeScript + Supabase product.
- Do not transplant large external codebases.
- Do not copy restrictive-license code.
- If a clean service boundary is better than embedding, choose the service boundary.

Your job:
1. Propose and implement the safest practical integration path for:
   - experimental computer use
   - tool sandboxing
   - runtime policies
   - future multi-channel messaging support
2. Separate “enterprise-safe now” from “experimental later”.
3. If needed, define a sidecar service contract instead of bloating the main app.
4. Add explicit feature flags and operator warnings for experimental runtime capabilities.

Acceptance criteria:
- The architecture becomes clearer about what belongs in the core app versus a sidecar runtime.
- Experimental agent power is gated and policy-aware.
- The plan is implementable by a real engineering team, not fantasy architecture.

At the end:
- provide an architecture decision record summary
- list changed files
- list what was intentionally deferred
```
