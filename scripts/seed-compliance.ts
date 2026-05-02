import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let tenantId: string;
let actorId: string;
const actorEmail = "compliance.officer@inceptive.co";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}
function randomUuid(): string {
  return crypto.randomUUID();
}

async function resolveIds() {
  const { data: tenants } = await sb.from("tenants").select("id").limit(1);
  if (tenants && tenants.length > 0) {
    tenantId = tenants[0].id;
  } else {
    const { data } = await sb.from("tenants").insert({ name: "Inceptive Capital" }).select("id").single();
    tenantId = data!.id;
  }
  console.log(`Tenant: ${tenantId}`);

  const { data: users } = await sb.from("users").select("id, email").limit(5);
  if (users && users.length > 0) {
    const match = users.find((u: { email: string; id: string }) => u.email === actorEmail);
    if (match) {
      actorId = match.id;
    } else {
      actorId = users[0].id;
    }
  } else {
    actorId = randomUuid();
    await sb.from("users").insert({ id: actorId, email: actorEmail });
  }
  console.log(`Actor: ${actorId} (${actorEmail})`);
}

async function auditLog(action: string, entityType?: string, entityId?: string, extra?: Record<string, unknown>) {
  await sb.from("audit_log").insert({
    tenant_id: tenantId,
    actor_id: actorId,
    actor_email: actorEmail,
    action_type: action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    before_state: extra?.before_state || null,
    after_state: extra?.after_state || null,
    ai_model_used: extra?.ai_model_used || null,
    ai_prompt_hash: extra?.ai_prompt_hash || null,
    decision: extra?.decision || null,
    citations: extra?.citations || null,
    ip_address: "10.0.1.42",
    created_at: extra?.created_at ? String(extra.created_at) : undefined,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Structuring / Smurfing — Multiple sub-$10K wire transfers
// ══════════════════════════════════════════════════════════════════════════════
async function seedStructuringScenario() {
  console.log("  \u25b8 Scenario 1: Structuring / Smurfing");

  const { data: person } = await sb
    .from("persons")
    .insert({
      tenant_id: tenantId,
      full_name: "Viktor Petrov",
      nationality: "RU",
      pep_status: false,
      sanctions_hit: false,
      risk_score: 78,
    })
    .select("id")
    .single();

  const pid = person?.id || randomUuid();

  const txAmounts = [9800, 9500, 9900, 9700, 9600, 9400, 9800];
  const txIds: string[] = [];
  for (let i = 0; i < txAmounts.length; i++) {
    const { data: tx } = await sb
      .from("transactions")
      .insert({
        tenant_id: tenantId,
        transaction_id: `WIRE-2026-${String(4821 + i).padStart(5, "0")}`,
        source_system: "core_banking",
        amount: txAmounts[i],
        currency: "USD",
        direction: "debit",
        counterparty_name: "Baltic Trade Holdings OU",
        counterparty_account: "EE1234567890123",
        account_number: "****7842",
        transaction_date: daysAgo(14 - i),
        description: `Wire transfer ${i + 1} of 7 - sub CTR threshold`,
        category: "wire_transfer",
      })
      .select("id")
      .single();
    if (tx) txIds.push(tx.id);
  }

  const { data: alert } = await sb
    .from("alerts")
    .insert({
      tenant_id: tenantId,
      alert_number: "20260430-0001",
      alert_type: "structuring",
      source: "transaction_monitoring",
      severity: "high",
      status: "escalated",
      risk_score: 87,
      description: "7 wire transfers in 14 days, all sub-$10K, to same Baltic counterparty. Potential structuring to avoid CTR filing.",
      entity_name: "Viktor Petrov",
      entity_type: "person",
      entity_id: pid,
      transaction_ids: txIds,
      triage_result: {
        risk_assessment: "HIGH",
        is_false_positive: false,
        narrative: "Customer Viktor Petrov executed 7 wire transfers totaling $67,700 to Baltic Trade Holdings OU (Estonia) over 14 days. Each transfer was deliberately kept below the $10,000 CTR threshold. Pattern consistent with structuring (31 USC § 5324). Counterparty is a shell company with no verifiable business operations.",
        recommended_action: "escalate_for_sar",
        red_flags: [
          "All amounts between $9,400-$9,900 — just below $10K CTR threshold",
          "Same foreign counterparty for all 7 transfers",
          "Estonian shell company with opaque ownership",
          "Accelerated cadence (daily near end of sequence)",
        ],
      },
      triaged_by: actorId,
      triaged_at: hoursAgo(6),
    })
    .select("id")
    .single();

  const { data: kase } = await sb
    .from("cases")
    .insert({
      tenant_id: tenantId,
      case_number: "CASE-2026-0042",
      case_type: "aml_investigation",
      title: "Structuring investigation — Viktor Petrov",
      description: "Potential structuring via sub-$10K wire transfers to Baltic entity.",
      status: "under_review",
      priority: "high",
      entity_id: pid,
      assigned_to: actorId,
      due_date: daysAgo(-7).split("T")[0],
    })
    .select("id")
    .single();

  if (alert && kase) {
    await sb.from("alerts").update({ case_id: kase.id }).eq("id", alert.id);
  }

  await auditLog("aml_triage_completed", "alert", alert?.id, {
    ai_model_used: "gpt-4o",
    decision: "escalate",
    created_at: hoursAgo(6),
    after_state: { status: "escalated", risk_score: 87 },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2: PEP Layering — Politically Exposed Person with complex transfers
// ══════════════════════════════════════════════════════════════════════════════
async function seedPEPScenario() {
  console.log("  \u25b8 Scenario 2: PEP Layering");

  const { data: person } = await sb
    .from("persons")
    .insert({
      tenant_id: tenantId,
      full_name: "Amara Okafor",
      nationality: "NG",
      pep_status: true,
      sanctions_hit: false,
      risk_score: 92,
    })
    .select("id")
    .single();

  const pid = person?.id || randomUuid();

  const { data: company } = await sb
    .from("companies")
    .insert({
      tenant_id: tenantId,
      name: "Sahara Bridge Consulting Ltd",
      jurisdiction: "BVI",
      company_type: "limited",
      status: "active",
      risk_score: 85,
      risk_tier: "high",
    })
    .select("id")
    .single();

  const cid = company?.id || randomUuid();

  await sb
    .from("ownership_relationships")
    .insert({
      tenant_id: tenantId,
      parent_entity_id: pid,
      parent_entity_type: "person",
      child_entity_id: cid,
      child_entity_type: "company",
      ownership_percentage: 35,
      relationship_type: "beneficial_owner",
      verified: false,
    });

  const txData = [
    { amount: 250000, counterparty: "Sahara Bridge Consulting Ltd", direction: "debit" as const, desc: "Consulting fee payment" },
    { amount: 180000, counterparty: "Atlas Maritime SA", direction: "debit" as const, desc: "Maritime services" },
    { amount: 420000, counterparty: "Sahara Bridge Consulting Ltd", direction: "credit" as const, desc: "Loan repayment from affiliate" },
    { amount: 75000, counterparty: "Okafor Family Trust", direction: "debit" as const, desc: "Trust distribution" },
  ];

  const txIds: string[] = [];
  for (let i = 0; i < txData.length; i++) {
    const t = txData[i];
    const { data: tx } = await sb
      .from("transactions")
      .insert({
        tenant_id: tenantId,
        transaction_id: `ACH-2026-${String(6100 + i).padStart(5, "0")}`,
        source_system: "core_banking",
        amount: t.amount,
        currency: "USD",
        direction: t.direction,
        counterparty_name: t.counterparty,
        account_number: "****3291",
        transaction_date: daysAgo(21 - i * 3),
        description: t.desc,
        category: "corporate_transfer",
      })
      .select("id")
      .single();
    if (tx) txIds.push(tx.id);
  }

  const { data: alert } = await sb
    .from("alerts")
    .insert({
      tenant_id: tenantId,
      alert_number: "20260428-0003",
      alert_type: "pep_layering",
      source: "kyc_screening",
      severity: "critical",
      status: "triaging",
      risk_score: 92,
      description: "PEP Amara Okafor (former Nigerian petroleum minister) conducting layered transfers through BVI shell company. $925K moved in 21 days.",
      entity_name: "Amara Okafor",
      entity_type: "person",
      entity_id: pid,
      transaction_ids: txIds,
    })
    .select("id")
    .single();

  await auditLog("aml_triage_completed", "alert", alert?.id, {
    ai_model_used: "gpt-4o",
    decision: "escalate",
    created_at: hoursAgo(18),
    after_state: { status: "triaging", risk_score: 92 },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Sanctions Near-Miss — Entity with partial match to SDN list
// ══════════════════════════════════════════════════════════════════════════════
async function seedSanctionsScenario() {
  console.log("  \u25b8 Scenario 3: Sanctions Near-Miss");

  const { data: company } = await sb
    .from("companies")
    .insert({
      tenant_id: tenantId,
      name: "Nordgas Energy Trading FZCO",
      jurisdiction: "UAE",
      company_type: "free_zone",
      status: "active",
      risk_score: 68,
      risk_tier: "medium",
      gleif_lei: "5493001KJTIIGC8Y1R12",
    })
    .select("id")
    .single();

  const cid = company?.id || randomUuid();

  const { data: alert } = await sb
    .from("alerts")
    .insert({
      tenant_id: tenantId,
      alert_number: "20260429-0007",
      alert_type: "sanctions_near_match",
      source: "sanctions_screening",
      severity: "high",
      status: "new",
      risk_score: 71,
      description: "Partial name match (87.3% similarity) to OFAC SDN entry 'Nordgaz Energy Trading LLC' (SDN# 34821). Same UAE free zone registration pattern. Awaiting manual review.",
      entity_name: "Nordgas Energy Trading FZCO",
      entity_type: "company",
      entity_id: cid,
    })
    .select("id")
    .single();

  await auditLog("case_created", "alert", alert?.id, {
    created_at: hoursAgo(12),
    after_state: { status: "new", severity: "high" },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4: False Positive — Unusual but legitimate activity
// ══════════════════════════════════════════════════════════════════════════════
async function seedFalsePositiveScenario() {
  console.log("  \u25b8 Scenario 4: False Positive (closed)");

  const { data: person } = await sb
    .from("persons")
    .insert({
      tenant_id: tenantId,
      full_name: "Sarah Mitchell",
      nationality: "US",
      pep_status: false,
      sanctions_hit: false,
      risk_score: 22,
    })
    .select("id")
    .single();

  const pid = person?.id || randomUuid();

  const txIds: string[] = [];
  const amounts = [15000, 15000, 15000];
  for (let i = 0; i < amounts.length; i++) {
    const { data: tx } = await sb
      .from("transactions")
      .insert({
        tenant_id: tenantId,
        transaction_id: `ACH-2026-${String(7300 + i).padStart(5, "0")}`,
        source_system: "core_banking",
        amount: amounts[i],
        currency: "USD",
        direction: "credit",
        counterparty_name: "Mitchell Family Revocable Trust",
        account_number: "****5521",
        transaction_date: daysAgo(30 - i * 7),
        description: "Trust distribution — quarterly",
        category: "trust_distribution",
      })
      .select("id")
      .single();
    if (tx) txIds.push(tx.id);
  }

  const { data: alert } = await sb
    .from("alerts")
    .insert({
      tenant_id: tenantId,
      alert_number: "20260415-0012",
      alert_type: "unusual_volume",
      source: "transaction_monitoring",
      severity: "medium",
      status: "false_positive",
      risk_score: 22,
      description: "3 large credits from family trust. Pattern consistent with quarterly trust distributions per account history.",
      entity_name: "Sarah Mitchell",
      entity_type: "person",
      entity_id: pid,
      transaction_ids: txIds,
      triage_result: {
        risk_assessment: "LOW",
        is_false_positive: true,
        narrative: "Sarah Mitchell received 3 quarterly trust distributions of $15,000 each from the Mitchell Family Revocable Trust. This pattern is consistent with the customer's 3-year account history showing identical quarterly distributions. Trust documentation verified. No red flags identified.",
        recommended_action: "close_false_positive",
        red_flags: [],
      },
      triaged_by: actorId,
      triaged_at: daysAgo(2),
    })
    .select("id")
    .single();

  await auditLog("aml_triage_completed", "alert", alert?.id, {
    ai_model_used: "gpt-4o",
    decision: "false_positive",
    created_at: daysAgo(2),
    after_state: { status: "false_positive", risk_score: 22 },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5: SAR Filing — Completed SAR with FinCEN narrative
// ══════════════════════════════════════════════════════════════════════════════
async function seedSARScenario() {
  console.log("  \u25b8 Scenario 5: SAR Filing (completed)");

  const { data: person } = await sb
    .from("persons")
    .insert({
      tenant_id: tenantId,
      full_name: "Dmitri Volkov",
      nationality: "BY",
      pep_status: false,
      sanctions_hit: false,
      risk_score: 81,
    })
    .select("id")
    .single();

  const pid = person?.id || randomUuid();

  const { data: kase } = await sb
    .from("cases")
    .insert({
      tenant_id: tenantId,
      case_number: "CASE-2026-0038",
      case_type: "sar_filing",
      title: "SAR — Suspicious wire activity Dmitri Volkov",
      description: "Rapid movement of funds through multiple accounts with no apparent business purpose.",
      status: "filed",
      priority: "high",
      entity_id: pid,
      assigned_to: actorId,
    })
    .select("id")
    .single();

  const caseId = kase?.id || randomUuid();

  const { data: sar } = await sb
    .from("sar_drafts")
    .insert({
      tenant_id: tenantId,
      case_id: caseId,
      fincen_form_type: "SAR-CTR",
      subject_entities: [
        { name: "Dmitri Volkov", type: "individual", role: "primary_subject" },
        { name: "Gamma Holdings LLC", type: "entity", role: "counterparty" },
      ],
      suspicious_activity_type: ["structuring", "layering", "unusual_wire_activity"],
      activity_start_date: daysAgo(45).split("T")[0],
      activity_end_date: daysAgo(5).split("T")[0],
      narrative_draft: `FinCEN SAR Narrative — Case CASE-2026-0038

Section 1: Summary of Suspicious Activity
Between ${daysAgo(45).split("T")[0]} and ${daysAgo(5).split("T")[0]}, Inceptive Capital observed suspicious wire transfer activity conducted by or on behalf of Dmitri Volkov (Subject). The Subject maintained a personal checking account (****4192) and a business operating account for DV Consulting LLC (****7833). During the review period, the Subject executed 23 wire transfers totaling $1,847,500, predominantly directed to Gamma Holdings LLC, a Delaware-registered entity with no verifiable business operations at its registered address.

Section 2: Red Flags
- 18 of 23 wire transfers were in amounts between $48,000 and $49,900, just below the $50,000 enhanced monitoring threshold
- Gamma Holdings LLC was incorporated 3 months prior to the first transfer and has no employees, website, or public business filings beyond Delaware registration
- Wire transfer descriptions contained generic references ("consulting services", "project payment") with no corresponding invoices or contracts
- The Subject's account showed no deposits from legitimate business operations sufficient to justify the outgoing wire volume
- Three transfers were reversed and re-sent with slightly modified amounts within 24 hours, suggesting testing of monitoring thresholds

Section 3: Account and Transaction Details
All 23 wire transfers originated from the Subject's business operating account (****7833) and were sent to Gamma Holdings LLC's account at First National Bank of Delaware (****0091). The transfers occurred on business days, typically between 9:00-10:00 AM ET, suggesting pre-planned rather than spontaneous activity.

Section 4: Investigation Summary
Inceptive Capital's compliance team conducted an enhanced due diligence review. Open-source research revealed Gamma Holdings LLC shares a registered agent with 14 other entities, several of which have been named in prior SAR filings by other financial institutions. The Subject declined to provide supporting documentation for the consulting engagement despite two written requests. The account was placed on monitoring hold pending regulatory filing.

Section 5: Action Taken
Inceptive Capital filed this SAR and placed the Subject's accounts on enhanced monitoring. The account will be restricted pending further regulatory guidance. All relevant transaction records, correspondence, and due diligence documentation have been preserved per 31 CFR § 1010.430.`,
      narrative_version: 2,
      status: "filed",
      filed_at: daysAgo(1),
    })
    .select("id")
    .single();

  await sb
    .from("approval_queue")
    .insert({
      tenant_id: tenantId,
      case_type: "sar_filing",
      entity_id: sar?.id || randomUuid(),
      entity_type: "sar_draft",
      ai_draft: { narrative_version: 2, fincen_form_type: "SAR-CTR" },
      ai_confidence: 0.91,
      citations: [
        { page: null, excerpt: "31 USC § 5318 — Suspicious activity reporting requirements" },
        { page: null, excerpt: "31 CFR § 1010.430 — Record retention for SAR filings" },
      ],
      status: "approved",
      reviewed_by: actorId,
      reviewed_at: daysAgo(1),
      review_notes: "Narrative is thorough and meets FinCEN requirements. Approved for filing.",
    });

  await auditLog("sar_narrative_generated", "sar_draft", sar?.id, {
    ai_model_used: "gpt-4o",
    decision: "approved",
    created_at: daysAgo(3),
    after_state: { status: "filed", narrative_version: 2 },
  });

  await auditLog("approval_queue_approved", "sar_draft", sar?.id, {
    decision: "approved",
    created_at: daysAgo(1),
    after_state: { status: "approved", reviewed_by: actorId },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 6: Policy Vault — Active compliance policies
// ══════════════════════════════════════════════════════════════════════════════
async function seedPolicyScenario() {
  console.log("  \u25b8 Scenario 6: Policy Vault");

  const policies = [
    {
      title: "Anti-Money Laundering Program",
      policy_number: "POL-AML-001",
      category: "aml",
      version: "3.2",
      status: "active",
      content: `# Anti-Money Laundering Program

## 1. Purpose and Scope
This policy establishes Inceptive Capital's Anti-Money Laundering (AML) program in compliance with the Bank Secrecy Act (BSA), USA PATRIOT Act, and FinCEN regulations.

## 2. Customer Due Diligence (CDD)
All customers must undergo risk-based CDD at onboarding:
- **Standard CDD**: Identity verification, beneficial ownership identification for entities with >=25% ownership
- **Enhanced Due Diligence (EDD)**: Required for PEPs, high-risk jurisdictions, and customers with risk scores >=70
- **Ongoing Monitoring**: Continuous transaction monitoring with automated alerting for suspicious patterns

## 3. Suspicious Activity Reporting
- All staff must report suspicious activity to the BSA Officer within 24 hours
- SARs must be filed within 30 calendar days of detection
- No staff member may notify any subject of a SAR filing (tipping off prohibition per 31 USC § 5318)

## 4. Transaction Monitoring Thresholds
- Cumulative transfers >=$10,000 in 24 hours: Automatic CTR review
- Multiple sub-threshold transfers within 72 hours: Structuring analysis
- Wire transfers to high-risk jurisdictions (FATF grey/black list): Enhanced review

## 5. Record Retention
All AML records, including CDD documentation, SAR filings, and transaction records, must be retained for 5 years from the date of filing or account closure, whichever is later.`,
      summary: "Establishes the AML program including CDD/EDD procedures, suspicious activity reporting requirements, and transaction monitoring thresholds.",
      effective_date: daysAgo(-365).split("T")[0],
      review_date: daysAgo(-30).split("T")[0],
      owner: "BSA Officer",
      tags: ["aml", "bsa", "cdd", "edd", "sar"],
    },
    {
      title: "Know Your Customer (KYC) Procedures",
      policy_number: "POL-KYC-001",
      category: "kyc",
      version: "2.1",
      status: "active",
      content: `# Know Your Customer Procedures

## 1. Onboarding Requirements
All new customer relationships require:
- Government-issued photo ID verification
- Proof of address (utility bill, bank statement within 90 days)
- Source of funds declaration for accounts with expected monthly volume >$50,000
- Beneficial ownership certification for legal entities (25% threshold)

## 2. Risk Rating Methodology
Customers are assigned a risk score (0-100) based on:
- Geographic risk (30% weight): FATF list, sanctions jurisdictions
- Product risk (20% weight): Private banking, wire transfers, trade finance
- Customer risk (30% weight): PEP status, industry, entity complexity
- Transaction risk (20% weight): Volume, counterparty jurisdiction, cash intensity

## 3. Periodic Review
- Low risk: Every 3 years
- Medium risk: Annually
- High/Critical risk: Every 6 months

## 4. Adverse Media Screening
Continuous adverse media screening using both automated tools and manual review for all medium and above risk customers.`,
      summary: "Defines KYC onboarding procedures, risk rating methodology, and periodic review schedule for all customer relationships.",
      effective_date: daysAgo(-180).split("T")[0],
      review_date: daysAgo(-60).split("T")[0],
      owner: "Compliance Team",
      tags: ["kyc", "cdd", "risk-rating", "onboarding"],
    },
    {
      title: "Sanctions Screening Policy",
      policy_number: "POL-SANC-001",
      category: "sanctions",
      version: "1.4",
      status: "active",
      content: `# Sanctions Screening Policy

## 1. Screening Requirements
All transactions, customers, and counterparties must be screened against:
- OFAC Specially Designated Nationals (SDN) List
- EU Consolidated Sanctions List
- UK HM Treasury Sanctions List
- UN Security Council Sanctions List

## 2. Match Resolution
- Exact match (100%): Automatic block and escalation
- Strong match (>=90%): Manual review within 4 hours
- Partial match (>=75%): Enhanced due diligence within 24 hours
- Weak match (<75%): Document and monitor

## 3. Real-Time Screening
All wire transfers and ACH transactions >=$3,000 must be screened in real-time prior to execution.

## 4. Re-Screening
Full portfolio re-screening within 24 hours of any sanctions list update.`,
      summary: "Mandates sanctions screening against OFAC, EU, UK, and UN lists with tiered match resolution procedures.",
      effective_date: daysAgo(-90).split("T")[0],
      review_date: daysAgo(-90).split("T")[0],
      owner: "Sanctions Officer",
      tags: ["sanctions", "ofac", "screening", "compliance"],
    },
    {
      title: "Vendor Risk Management Policy",
      policy_number: "POL-VRM-001",
      category: "vendor",
      version: "1.0",
      status: "draft",
      content: `# Vendor Risk Management Policy

## 1. Vendor Classification
Tier 1 (Critical): Vendors with access to customer PII or financial data
Tier 2 (Important): Vendors providing infrastructure or key operational services
Tier 3 (Standard): All other vendors

## 2. Assessment Requirements
- Tier 1: SOC 2 Type II report, penetration test results, annual on-site review
- Tier 2: SOC 2 Type II or equivalent, annual questionnaire
- Tier 3: Self-attestation questionnaire every 2 years

## 3. Ongoing Monitoring
- Continuous financial health monitoring for Tier 1 vendors
- Quarterly business continuity testing for critical vendors
- Annual contract and SLA review for all vendors`,
      summary: "Classifies vendors by risk tier and defines assessment and monitoring requirements for each tier.",
      effective_date: daysAgo(0).split("T")[0],
      review_date: daysAgo(-90).split("T")[0],
      owner: "Procurement",
      tags: ["vendor", "risk", "soc2", "third-party"],
    },
    {
      title: "Transaction Reconciliation Controls",
      policy_number: "POL-REC-001",
      category: "reconciliation",
      version: "2.0",
      status: "active",
      content: `# Transaction Reconciliation Controls

## 1. Daily Reconciliation
All general ledger accounts must be reconciled daily against:
- Core banking system positions
- Payment processor settlement files
- Custodian statements

## 2. Exception Handling
- Exceptions >$10,000: Escalate to CFO within 4 hours
- Exceptions >$1,000: Research and resolve within 2 business days
- Exceptions <$1,000: Resolve within 5 business days

## 3. Break Analysis
All unreconciled breaks must be aged and reported:
- 0-5 days: Standard resolution process
- 6-30 days: Enhanced documentation, manager review
- >30 days: Mandatory escalation to head of operations

## 4. Automation
Reconciliation matching must use automated tools with minimum 95% straight-through match rate target.`,
      summary: "Establishes daily reconciliation procedures, exception handling thresholds, and break aging requirements.",
      effective_date: daysAgo(-120).split("T")[0],
      review_date: daysAgo(-60).split("T")[0],
      owner: "Operations",
      tags: ["reconciliation", "controls", "exceptions", "gl"],
    },
  ];

  for (const p of policies) {
    const { data: pol } = await sb
      .from("policies")
      .insert({ tenant_id: tenantId, ...p })
      .select("id")
      .single();

    await auditLog("policy_created", "policy", pol?.id, {
      created_at: daysAgo(60),
      after_state: { title: p.title, status: p.status },
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 7: Reconciliation — Completed run with exceptions
// ══════════════════════════════════════════════════════════════════════════════
async function seedReconciliationScenario() {
  console.log("  \u25b8 Scenario 7: Reconciliation Run");

  const runDate = daysAgo(1);

  const { data: run } = await sb
    .from("reconciliation_runs")
    .insert({
      tenant_id: tenantId,
      run_number: "REC-2026-0430",
      source_a_name: "Core Banking System",
      source_b_name: "Payment Processor Settlement",
      total_source_a: 1247,
      total_source_b: 1241,
      matched_count: 1238,
      exception_count: 9,
      status: "completed",
      exceptions: [
        {
          transaction_id: "TXN-88421",
          source: "core_banking",
          amount: 45000,
          direction: "credit",
          reason: "No matching settlement record — possible delayed settlement",
          counterparty: "Greenfield Capital LP",
          date: daysAgo(1),
        },
        {
          transaction_id: "TXN-88433",
          source: "core_banking",
          amount: 12875.5,
          direction: "debit",
          reason: "Amount mismatch — settlement shows $12,875.00 vs core $12,875.50",
          counterparty: "Apex Clearing Corp",
          date: daysAgo(1),
        },
        {
          transaction_id: "STL-99201",
          source: "payment_processor",
          amount: 234500,
          direction: "credit",
          reason: "Settlement with no matching core banking record — potential late posting",
          counterparty: "Meridian Trust",
          date: daysAgo(1),
        },
        {
          transaction_id: "TXN-88391",
          source: "core_banking",
          amount: 5600,
          direction: "debit",
          reason: "Duplicate transaction in core system — settlement shows single entry",
          counterparty: "CloudPay Inc",
          date: daysAgo(1),
        },
        {
          transaction_id: "STL-99187",
          source: "payment_processor",
          amount: 89000,
          direction: "credit",
          reason: "Large settlement with no corresponding transactions — awaiting trade confirmation",
          counterparty: "Blackstone Securities",
          date: daysAgo(1),
        },
      ],
      started_at: runDate,
      completed_at: hoursAgo(20),
    })
    .select("id")
    .single();

  await auditLog("reconciliation_completed", "reconciliation_run", run?.id, {
    created_at: hoursAgo(20),
    after_state: {
      matched_count: 1238,
      exception_count: 9,
      match_rate: "99.3%",
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 8: Vendor Assessments — Mixed risk tiers
// ══════════════════════════════════════════════════════════════════════════════
async function seedVendorScenario() {
  console.log("  \u25b8 Scenario 8: Vendor Assessments");

  const vendors = [
    { name: "CloudVault Security Inc", contract_value: 450000, status: "active" },
    { name: "DataStream Analytics Ltd", contract_value: 280000, status: "active" },
    { name: "OffshoreTech Solutions FZCO", contract_value: 120000, status: "under_review" },
    { name: "PayGate Processing LLC", contract_value: 890000, status: "active" },
  ];

  const vendorIds: string[] = [];
  for (const v of vendors) {
    const { data: vendor } = await sb
      .from("vendors")
      .insert({
        name: v.name,
        contract_value: v.contract_value,
        status: v.status,
        contact_email: `compliance@${v.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      })
      .select("id")
      .single();
    if (vendor) vendorIds.push(vendor.id);
  }

  const assessments = [
    {
      vendor_idx: 0,
      assessment_type: "soc2",
      risk_score: 28,
      risk_tier: "low",
      status: "approved",
      findings: [
        { category: "certification", severity: "low", description: "SOC 2 Type II certified with no exceptions", recommendation: "Continue standard monitoring" },
        { category: "certification", severity: "low", description: "ISO 27001 certified", recommendation: "Maintain current certification" },
        { category: "security_testing", severity: "low", description: "Annual penetration testing with remediation within 30 days", recommendation: "Continue annual testing cycle" },
        { category: "governance", severity: "low", description: "Dedicated security team of 12 FTEs", recommendation: "No action needed" },
      ],
      recommendations: "Continue with standard monitoring schedule. No additional controls required.",
      assessed_at: daysAgo(14),
    },
    {
      vendor_idx: 1,
      assessment_type: "security_questionnaire",
      risk_score: 52,
      risk_tier: "medium",
      status: "requires_review",
      findings: [
        { category: "certification", severity: "low", description: "SOC 2 Type I certification obtained", recommendation: "Track Type II certification progress" },
        { category: "encryption", severity: "low", description: "Encrypted data transmission (TLS 1.3)", recommendation: "No action needed" },
        { category: "personnel", severity: "low", description: "Background checks for all employees with data access", recommendation: "Continue current practice" },
        { category: "certification", severity: "high", description: "SOC 2 Type II certification pending — Type I only", recommendation: "Require Type II within 6 months" },
        { category: "security_testing", severity: "high", description: "No independent penetration test in last 12 months", recommendation: "Request penetration test by end of Q2" },
        { category: "vendor_management", severity: "medium", description: "Subprocessor management lacks formal oversight process", recommendation: "Add enhanced monitoring clause to contract" },
        { category: "incident_response", severity: "medium", description: "Incident response plan not tested in last 6 months", recommendation: "Require IR tabletop exercise within 90 days" },
      ],
      recommendations: "Require DataStream to obtain SOC 2 Type II within 6 months. Request penetration test results by end of Q2. Add enhanced monitoring clause to contract renewal.",
      assessed_at: daysAgo(7),
    },
    {
      vendor_idx: 2,
      assessment_type: "soc2",
      risk_score: 81,
      risk_tier: "high",
      status: "pending",
      findings: [
        { category: "encryption", severity: "low", description: "Data encryption at rest and in transit", recommendation: "Verify encryption key management practices" },
        { category: "certification", severity: "high", description: "No SOC 2 certification of any type", recommendation: "Require SOC 2 Type II within 12 months" },
        { category: "jurisdiction", severity: "high", description: "UAE free zone registration with limited regulatory oversight", recommendation: "Apply enhanced due diligence per POL-KYC-001" },
        { category: "audit", severity: "high", description: "No independent audit reports available", recommendation: "Require independent audit within 90 days" },
        { category: "ownership", severity: "high", description: "Beneficial ownership structure is opaque — 3 layers of holding companies", recommendation: "Require full beneficial ownership disclosure" },
        { category: "incident_response", severity: "high", description: "No formal incident response plan documented", recommendation: "Require IR plan before onboarding" },
        { category: "personnel", severity: "medium", description: "Employee background check policy is self-attested only", recommendation: "Require third-party background verification" },
      ],
      recommendations: "Do not onboard for Tier 1 data access. If relationship continues, require: (1) SOC 2 Type II within 12 months, (2) independent penetration test within 90 days, (3) full beneficial ownership disclosure. Escalate to CISO for approval.",
      assessed_at: daysAgo(3),
    },
    {
      vendor_idx: 3,
      assessment_type: "soc2",
      risk_score: 35,
      risk_tier: "low",
      status: "approved",
      findings: [
        { category: "certification", severity: "low", description: "SOC 2 Type II certified with clean opinion", recommendation: "Continue standard monitoring" },
        { category: "certification", severity: "low", description: "PCI DSS Level 1 certified", recommendation: "Maintain compliance" },
        { category: "security_testing", severity: "low", description: "Annual penetration testing by Big 4 firm", recommendation: "No action needed" },
        { category: "incident_response", severity: "low", description: "24/7 SOC with documented incident response", recommendation: "No action needed" },
        { category: "vendor_management", severity: "low", description: "Comprehensive subprocessor governance framework", recommendation: "No action needed" },
        { category: "key_management", severity: "medium", description: "Single point of failure in key management system (remediation planned Q3)", recommendation: "Track key management remediation through Q3 milestone review" },
      ],
      recommendations: "Continue standard monitoring. Track key management remediation through Q3 milestone review.",
      assessed_at: daysAgo(21),
    },
  ];

  for (const a of assessments) {
    const vendorId = vendorIds[a.vendor_idx];
    if (!vendorId) {
      console.error("Missing vendor for assessment", a);
      continue;
    }
    const { data: assessment } = await sb
      .from("vendor_assessments")
      .insert({
        tenant_id: tenantId,
        vendor_id: vendorId,
        assessment_type: a.assessment_type,
        risk_score: a.risk_score,
        risk_tier: a.risk_tier,
        findings: a.findings,
        recommendations: a.recommendations,
        assessed_by: actorId,
        assessed_at: a.assessed_at,
        status: a.status,
      })
      .select("id")
      .single();

    await auditLog("vendor_assessment_completed", "vendor_assessment", assessment?.id, {
      ai_model_used: "gpt-4o",
      decision: a.status === "approved" ? "approved" : a.status === "pending" ? "pending" : "requires_review",
      created_at: a.assessed_at,
      after_state: { risk_tier: a.risk_tier, risk_score: a.risk_score, status: a.status },
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 9: Approval Queue — Pending items requiring human review
// ══════════════════════════════════════════════════════════════════════════════
async function seedApprovalQueueScenario() {
  console.log("  \u25b8 Scenario 9: Approval Queue Items");

  const pendingItems = [
    {
      entity_id: randomUuid(),
      case_type: "vendor_assessment",
      entity_type: "vendor_assessment",
      ai_draft: {
        risk_tier: "high",
        risk_score: 81,
        recommendation: "Do not onboard for Tier 1 data access. Require SOC 2 Type II within 12 months.",
      },
      ai_confidence: 0.87,
      citations: [
        { page: null, excerpt: "SOC 2 Type II required for all Tier 1 vendor access per POL-VRM-001" },
        { page: null, excerpt: "UAE free zone entities require enhanced due diligence per POL-KYC-001 Section 2" },
      ],
      status: "pending",
    },
    {
      entity_id: randomUuid(),
      case_type: "sar_filing",
      entity_type: "alert",
      ai_draft: {
        recommended_action: "file_sar",
        narrative_summary: "PEP layering pattern detected. $925K moved through BVI shell company over 21 days. SAR narrative drafted per FinCEN requirements.",
      },
      ai_confidence: 0.91,
      citations: [
        { page: null, excerpt: "31 USC § 5318 — Suspicious activity reporting requirements" },
        { page: null, excerpt: "PEP enhanced due diligence per POL-AML-001 Section 2" },
      ],
      status: "pending",
    },
    {
      entity_id: randomUuid(),
      case_type: "policy_update",
      entity_type: "policy",
      ai_draft: {
        policy_title: "Crypto Asset Compliance Policy",
        recommended_version: "1.0",
        summary: "New policy required to address increasing crypto-asset transaction volume. FinCEN virtual asset guidance (FIN-2023-G001) requires updated procedures.",
      },
      ai_confidence: 0.78,
      citations: [
        { page: null, excerpt: "FinCEN FIN-2023-G001 — Virtual Asset Service Provider obligations" },
        { page: null, excerpt: "FATF Updated Guidance on Virtual Assets (Oct 2021)" },
      ],
      status: "pending",
    },
  ];

  for (const item of pendingItems) {
    await sb.from("approval_queue").insert({
      tenant_id: tenantId,
      ...item,
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 10: Additional audit trail entries for timeline richness
// ══════════════════════════════════════════════════════════════════════════════
async function seedAuditTrailEntries() {
  console.log("  \u25b8 Scenario 10: Audit Trail History");

  const entries = [
    {
      action_type: "case_created",
      entity_type: "case",
      decision: null,
      created_at: daysAgo(30),
      after_state: { case_number: "CASE-2026-0038", case_type: "sar_filing", status: "open" },
    },
    {
      action_type: "aml_triage_completed",
      entity_type: "alert",
      decision: "escalate",
      ai_model_used: "gpt-4o",
      created_at: daysAgo(28),
      after_state: { alert_number: "20260401-0001", status: "escalated", risk_score: 81 },
    },
    {
      action_type: "approval_queue_approved",
      entity_type: "policy",
      decision: "approved",
      created_at: daysAgo(25),
      after_state: { title: "AML Program v3.2", status: "approved" },
    },
    {
      action_type: "policy_created",
      entity_type: "policy",
      decision: null,
      created_at: daysAgo(20),
      after_state: { title: "Sanctions Screening Policy", status: "active" },
    },
    {
      action_type: "reconciliation_completed",
      entity_type: "reconciliation_run",
      decision: null,
      created_at: daysAgo(18),
      after_state: { run_number: "REC-2026-0412", matched_count: 1156, exception_count: 4 },
    },
    {
      action_type: "vendor_assessment_completed",
      entity_type: "vendor_assessment",
      decision: "approved",
      ai_model_used: "gpt-4o",
      created_at: daysAgo(14),
      after_state: { vendor: "CloudVault Security", risk_tier: "low", risk_score: 28 },
    },
    {
      action_type: "aml_triage_completed",
      entity_type: "alert",
      decision: "false_positive",
      ai_model_used: "gpt-4o",
      created_at: daysAgo(7),
      after_state: { alert_number: "20260422-0009", status: "false_positive", risk_score: 22 },
    },
    {
      action_type: "approval_queue_rejected",
      entity_type: "vendor_assessment",
      decision: "rejected",
      created_at: daysAgo(5),
      after_state: { vendor: "OffshoreTech Solutions", status: "rejected", reason: "Insufficient security certifications" },
    },
    {
      action_type: "sar_narrative_generated",
      entity_type: "sar_draft",
      decision: null,
      ai_model_used: "gpt-4o",
      ai_prompt_hash: "a3f8b2c1d4e5",
      created_at: daysAgo(3),
      after_state: { case_id: "CASE-2026-0038", narrative_version: 1 },
    },
    {
      action_type: "aml_triage_completed",
      entity_type: "alert",
      decision: "escalate",
      ai_model_used: "gpt-4o",
      created_at: daysAgo(2),
      after_state: { alert_number: "20260428-0003", status: "triaging", risk_score: 92 },
    },
  ];

  for (const e of entries) {
    await auditLog(e.action_type, e.entity_type, randomUuid(), {
      decision: e.decision,
      ai_model_used: e.ai_model_used,
      ai_prompt_hash: e.ai_prompt_hash,
      created_at: e.created_at,
      after_state: e.after_state,
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("\n═══ Inceptive Compliance — Seed Script ═══\n");

  await resolveIds();

  console.log("\nSeeding scenarios...");
  await seedStructuringScenario();
  await seedPEPScenario();
  await seedSanctionsScenario();
  await seedFalsePositiveScenario();
  await seedSARScenario();
  await seedPolicyScenario();
  await seedReconciliationScenario();
  await seedVendorScenario();
  await seedApprovalQueueScenario();
  await seedAuditTrailEntries();

  console.log("\n═══ Seed complete ═══\n");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
