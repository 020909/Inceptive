import { z } from "zod";

export const EntityTypeSchema = z.enum(["company", "person"]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const RiskTierSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const CaseStatusSchema = z.enum(["open", "under_review", "escalated", "closed", "filed"]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

export const CasePrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export type CasePriority = z.infer<typeof CasePrioritySchema>;

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "escalated"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const DocumentParsingStatusSchema = z.enum(["pending", "processing", "complete", "failed"]);
export type DocumentParsingStatus = z.infer<typeof DocumentParsingStatusSchema>;

export const CitationSchema = z.object({
  page: z.number().int().nonnegative().nullable(),
  excerpt: z.string().min(1),
});
export type Citation = z.infer<typeof CitationSchema>;

// ── DB row shapes (compliance ontology) ───────────────────────────────────────

export const CompanyRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  registration_number: z.string().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  incorporation_date: z.string().nullable().optional(),
  company_type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  risk_score: z.number().nullable().optional(),
  risk_tier: z.string().nullable().optional(),
  gleif_lei: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CompanyRow = z.infer<typeof CompanyRowSchema>;

export const PersonRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string().min(1),
  date_of_birth: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  id_document_type: z.string().nullable().optional(),
  id_document_number: z.string().nullable().optional(),
  pep_status: z.boolean().optional(),
  sanctions_hit: z.boolean().optional(),
  risk_score: z.number().nullable().optional(),
  created_at: z.string(),
});
export type PersonRow = z.infer<typeof PersonRowSchema>;

export const DocumentRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  entity_id: z.string().uuid().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  file_name: z.string().min(1),
  file_url: z.string().min(1),
  file_type: z.string().nullable().optional(),
  parsed_content: z.string().nullable().optional(),
  parsing_status: DocumentParsingStatusSchema.nullable().optional(),
  uploaded_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
});
export type DocumentRow = z.infer<typeof DocumentRowSchema>;

export const OwnershipRelationshipRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  parent_entity_id: z.string().uuid(),
  parent_entity_type: EntityTypeSchema,
  child_entity_id: z.string().uuid(),
  child_entity_type: EntityTypeSchema,
  ownership_percentage: z.number().nullable().optional(),
  relationship_type: z.string().nullable().optional(),
  source_document_id: z.string().uuid().nullable().optional(),
  verified: z.boolean().optional(),
  created_at: z.string(),
});
export type OwnershipRelationshipRow = z.infer<typeof OwnershipRelationshipRowSchema>;

export const ApprovalQueueRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  case_type: z.string().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  ai_draft: z.unknown(),
  ai_confidence: z.number().nullable().optional(),
  citations: z.unknown().nullable().optional(),
  status: ApprovalStatusSchema.nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  reviewed_by: z.string().uuid().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  review_notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApprovalQueueRow = z.infer<typeof ApprovalQueueRowSchema>;

export const AuditLogRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  actor_email: z.string().min(1),
  action_type: z.string().min(1),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  before_state: z.unknown().nullable().optional(),
  after_state: z.unknown().nullable().optional(),
  ai_model_used: z.string().nullable().optional(),
  ai_prompt_hash: z.string().nullable().optional(),
  decision: z.string().nullable().optional(),
  citations: z.unknown().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  created_at: z.string(),
});
export type AuditLogRow = z.infer<typeof AuditLogRowSchema>;

export const CaseRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  case_number: z.string().min(1),
  case_type: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CaseRow = z.infer<typeof CaseRowSchema>;

export const SarDraftRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  case_id: z.string().uuid().nullable().optional(),
  fincen_form_type: z.string().nullable().optional(),
  subject_entities: z.unknown().nullable().optional(),
  suspicious_activity_type: z.array(z.string()).nullable().optional(),
  activity_start_date: z.string().nullable().optional(),
  activity_end_date: z.string().nullable().optional(),
  narrative_draft: z.string().nullable().optional(),
  narrative_version: z.number().int().optional(),
  status: z.string().nullable().optional(),
  filed_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type SarDraftRow = z.infer<typeof SarDraftRowSchema>;

// ── UBO extraction payloads (Phase 3) ─────────────────────────────────────────

export const UboExtractedCompanySchema = z.object({
  name: z.string().min(1),
  registration_number: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  company_type: z.string().nullable(),
  citation: CitationSchema,
});

export const UboExtractedPersonSchema = z.object({
  full_name: z.string().min(1),
  role: z.string().nullable(),
  nationality: z.string().nullable(),
  citation: CitationSchema,
});

export const UboExtractedRelationshipSchema = z.object({
  parent_name: z.string().min(1),
  child_name: z.string().min(1),
  ownership_percentage: z.number().nullable(),
  relationship_type: z.enum(["direct", "indirect", "nominee", "unknown"]),
  citation: CitationSchema,
});

export const UboExtractionResultSchema = z.object({
  companies: z.array(UboExtractedCompanySchema),
  persons: z.array(UboExtractedPersonSchema),
  ownership_relationships: z.array(UboExtractedRelationshipSchema),
  extraction_confidence: z.number().min(0).max(1).optional(),
});
export type UboExtractionResult = z.infer<typeof UboExtractionResultSchema>;

export const AlertSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const AlertStatusSchema = z.enum(["new", "triaging", "escalated", "closed", "false_positive"]);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

export const AlertRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  alert_number: z.string().min(1),
  alert_type: z.string().min(1),
  source: z.string().nullable().optional(),
  severity: AlertSeveritySchema,
  status: AlertStatusSchema,
  risk_score: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  entity_name: z.string().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  transaction_ids: z.array(z.string().uuid()).nullable().optional(),
  triage_result: z.unknown().nullable().optional(),
  triaged_by: z.string().uuid().nullable().optional(),
  triaged_at: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  case_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AlertRow = z.infer<typeof AlertRowSchema>;

export const TransactionRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  transaction_id: z.string().min(1),
  source_system: z.string(),
  amount: z.number(),
  currency: z.string().default("USD"),
  direction: z.enum(["credit", "debit"]),
  counterparty_name: z.string().nullable().optional(),
  counterparty_account: z.string().nullable().optional(),
  account_number: z.string().nullable().optional(),
  transaction_date: z.string(),
  posted_date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  matched: z.boolean().default(false),
  match_group_id: z.string().uuid().nullable().optional(),
  reconciliation_run_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
});
export type TransactionRow = z.infer<typeof TransactionRowSchema>;

export const PolicyRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  title: z.string().min(1),
  policy_number: z.string().nullable().optional(),
  category: z.string().default("general"),
  version: z.string().default("1.0"),
  status: z.enum(["draft", "active", "archived", "deprecated"]).default("active"),
  content: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  effective_date: z.string().nullable().optional(),
  review_date: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  file_url: z.string().nullable().optional(),
  file_name: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PolicyRow = z.infer<typeof PolicyRowSchema>;

export const ReconciliationRunRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  run_number: z.string().min(1),
  source_a_name: z.string().min(1),
  source_b_name: z.string().min(1),
  total_source_a: z.number().int().default(0),
  total_source_b: z.number().int().default(0),
  matched_count: z.number().int().default(0),
  exception_count: z.number().int().default(0),
  status: z.enum(["running", "completed", "failed"]).default("running"),
  exceptions: z.unknown().nullable().optional(),
  started_at: z.string(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type ReconciliationRunRow = z.infer<typeof ReconciliationRunRowSchema>;

export const VendorAssessmentRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  assessment_type: z.enum(["soc2", "security_questionnaire", "penetration_test", "financial_review"]).default("soc2"),
  risk_score: z.number().nullable().optional(),
  risk_tier: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
  findings: z.unknown().nullable().optional(),
  recommendations: z.string().nullable().optional(),
  report_url: z.string().nullable().optional(),
  report_file_name: z.string().nullable().optional(),
  assessed_by: z.string().uuid().nullable().optional(),
  assessed_at: z.string().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected", "requires_review"]).default("pending"),
  created_at: z.string(),
  updated_at: z.string(),
});
export type VendorAssessmentRow = z.infer<typeof VendorAssessmentRowSchema>;

