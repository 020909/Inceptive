import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BeneficialOwner {
  name: string;
  nationality?: string;
  date_of_birth?: string;
  ownership_percentage: number;
  ownership_type: "direct" | "indirect";
  ownership_path: string;
  company_name?: string;
  jurisdiction?: string;
}

export interface EnrichedOwner extends BeneficialOwner {
  sanctions_hit: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  sanctions_matches?: SanctionsMatch[];
}

export interface SanctionsMatch {
  name: string;
  list_name: string;
  match_score: number;
}

export interface CompanyNode {
  name: string;
  registration_number?: string;
  jurisdiction?: string;
  ownership_percentage?: number;
  owners: (CompanyNode | EnrichedOwner)[];
}

export interface UBOExtractionResult {
  beneficial_owners: BeneficialOwner[];
  ownership_tree: CompanyNode;
  confidence: "high" | "medium" | "low";
  needs_review: boolean;
  notes: string;
  sanctions_matches: SanctionsMatch[];
}

export interface AgentLog {
  timestamp: string;
  phase: number;
  message: string;
  level: "info" | "warning" | "error";
}

// ─── UBO Agent Class ─────────────────────────────────────────────────────────

export class UBOAgent {
  private supabase: SupabaseClient;
  private agent_run_id: string;
  private logs: AgentLog[] = [];

  constructor(agent_run_id: string, supabase: SupabaseClient) {
    this.agent_run_id = agent_run_id;
    this.supabase = supabase;
  }

  // ─── Main Execute Method ─────────────────────────────────────────────────

  async execute(
    case_id: string,
    org_id: string,
    document_ids: string[]
  ): Promise<UBOExtractionResult> {
    try {
      this.log(1, "Starting UBO Unwrapper agent execution", "info");

      // Phase 1: Document Ingestion
      const parsed_texts = await this.phase1Ingest(document_ids);

      // Phase 2: LLM Extraction
      const extraction = await this.phase2Extract(parsed_texts);

      // Phase 3: Enrichment
      const enriched = await this.phase3Enrich(extraction.beneficial_owners);

      // Phase 4: Compilation & Storage
      await this.phase4Store(case_id, org_id, extraction, enriched);

      this.log(4, "UBO Unwrapper execution completed successfully", "info");

      // Update agent run status
      await this.updateAgentRun("completed");

      return {
        ...extraction,
        beneficial_owners: enriched,
        sanctions_matches: enriched.flatMap((o) => o.sanctions_matches || []),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.log(0, `Agent execution failed: ${message}`, "error");
      await this.updateAgentRun("failed");
      throw error;
    }
  }

  // ─── Phase 1: Document Ingestion ────────────────────────────────────────────

  private async phase1Ingest(document_ids: string[]): Promise<string[]> {
    this.log(1, `Ingesting ${document_ids.length} documents`, "info");

    const { data: documents, error } = await this.supabase
      .from("case_documents")
      .select("id, file_name, parsed_text, parsing_status")
      .in("id", document_ids);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    const parsed_texts: string[] = [];

    for (const doc of documents || []) {
      if (doc.parsing_status === "completed" && doc.parsed_text) {
        parsed_texts.push(doc.parsed_text);
        this.log(1, `Ingested document: ${doc.file_name}`, "info");
      } else {
        this.log(
          1,
          `Document not parsed yet: ${doc.file_name}`,
          "warning"
        );
      }
    }

    this.log(1, `Successfully ingested ${parsed_texts.length} parsed documents`, "info");

    if (parsed_texts.length === 0) {
      throw new Error("No parsed documents found");
    }

    return parsed_texts;
  }

  // ─── Phase 2: LLM Extraction ──────────────────────────────────────────────

  private async phase2Extract(parsed_texts: string[]): Promise<UBOExtractionResult> {
    this.log(2, "Starting LLM extraction via OpenRouter", "info");

    const combined_text = parsed_texts.join("\n\n---\n\n");

    const prompt = `You are an expert compliance analyst specializing in Beneficial Ownership (UBO) extraction.

Analyze the following documents and extract all beneficial owners. Return ONLY valid JSON with no markdown formatting.

Documents:
${combined_text.slice(0, 10000)}

Extract and return in this EXACT format:
{
  "beneficial_owners": [
    {
      "name": "Full legal name",
      "nationality": "Country of nationality",
      "date_of_birth": "YYYY-MM-DD or null",
      "ownership_percentage": number (e.g., 25.5),
      "ownership_type": "direct" or "indirect",
      "ownership_path": "e.g., Company A → Trust B → Person",
      "company_name": "Associated company name or null",
      "jurisdiction": "Company jurisdiction or null"
    }
  ],
  "confidence": "high" or "medium" or "low",
  "needs_review": true or false,
  "notes": "Any additional observations or concerns"
}

Rules:
- A beneficial owner is any natural person who ultimately owns or controls 25% or more of the entity
- Include indirect ownership through trusts, holding companies, etc.
- Be precise with ownership percentages
- Flag any suspicious or unclear ownership structures`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Inceptive Compliance",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from LLM");
    }

    // Parse JSON response
    let extracted: UBOExtractionResult;
    try {
      // Clean up potential markdown formatting
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      extracted = {
        beneficial_owners: parsed.beneficial_owners || [],
        ownership_tree: parsed.ownership_tree || this.buildOwnershipTree(parsed.beneficial_owners || []),
        confidence: parsed.confidence || "low",
        needs_review: parsed.needs_review || false,
        notes: parsed.notes || "",
        sanctions_matches: [],
      };
    } catch (e) {
      this.log(2, `Failed to parse LLM response: ${content.slice(0, 200)}`, "error");
      throw new Error("Failed to parse LLM extraction response");
    }

    this.log(2, `Extracted ${extracted.beneficial_owners.length} beneficial owners`, "info");
    this.log(2, `Confidence level: ${extracted.confidence}`, "info");

    return extracted;
  }

  // ─── Phase 3: Enrichment (Sanctions Check) ─────────────────────────────────

  private async phase3Enrich(owners: BeneficialOwner[]): Promise<EnrichedOwner[]> {
    this.log(3, "Starting sanctions screening", "info");

    const enriched: EnrichedOwner[] = [];

    for (const owner of owners) {
      // Check sanctions list
      const { data: sanctions, error } = await this.supabase
        .from("sanctions_list")
        .select("*")
        .ilike("name", `%${owner.name}%`);

      if (error) {
        this.log(3, `Error checking sanctions for ${owner.name}: ${error.message}`, "error");
      }

      const sanctions_matches: SanctionsMatch[] =
        sanctions?.map((s) => ({
          name: s.name,
          list_name: s.list_name,
          match_score: 0.8, // Simplified scoring
        })) || [];

      const has_sanctions_hit = sanctions_matches.length > 0;

      // Calculate risk level
      let risk_level: "low" | "medium" | "high" | "critical" = "low";
      if (has_sanctions_hit) {
        risk_level = "critical";
      } else if (owner.ownership_percentage > 50) {
        risk_level = "high";
      } else if (owner.ownership_path.split("→").length > 3) {
        risk_level = "medium";
      }

      enriched.push({
        ...owner,
        sanctions_hit: has_sanctions_hit,
        risk_level,
        sanctions_matches,
      });

      if (has_sanctions_hit) {
        this.log(3, `⚠️ SANCTIONS HIT: ${owner.name}`, "warning");
      }
    }

    const hits = enriched.filter((o) => o.sanctions_hit).length;
    this.log(3, `Screened ${enriched.length} persons, found ${hits} sanctions hits`, "info");

    return enriched;
  }

  // ─── Phase 4: Compilation & Storage ─────────────────────────────────────────

  private async phase4Store(
    case_id: string,
    org_id: string,
    extraction: UBOExtractionResult,
    enriched: EnrichedOwner[]
  ): Promise<void> {
    this.log(4, "Storing extraction results", "info");

    // Build ownership tree from enriched owners
    const ownership_tree = this.buildOwnershipTree(enriched);

    // Store in ubo_extractions
    const { error: extractionError } = await this.supabase
      .from("ubo_extractions")
      .insert({
        case_id,
        org_id,
        extracted_json: enriched,
        ownership_tree,
        confidence: extraction.confidence,
        sanctions_matches: enriched.flatMap((o) => o.sanctions_matches || []),
        needs_review: extraction.needs_review || enriched.some((o) => o.sanctions_hit),
        status: extraction.needs_review ? "needs_review" : "approved",
      });

    if (extractionError) {
      throw new Error(`Failed to store extraction: ${extractionError.message}`);
    }

    // Create approval_queue entry if needed
    if (extraction.needs_review || enriched.some((o) => o.sanctions_hit)) {
      const { error: queueError } = await this.supabase.from("approval_queue").insert({
        org_id,
        item_type: "ubo_extraction",
        item_id: case_id,
        status: "pending",
        priority: enriched.some((o) => o.sanctions_hit) ? "high" : "medium",
        requested_by: (await this.supabase.auth.getUser()).data.user?.id,
        metadata: {
          beneficial_owners_count: enriched.length,
          sanctions_hits: enriched.filter((o) => o.sanctions_hit).length,
          confidence: extraction.confidence,
        },
      });

      if (queueError) {
        throw new Error(`Failed to create approval queue entry: ${queueError.message}`);
      }

      this.log(4, "Created approval queue entry for review", "info");
    }

    // Log to audit_trail
    await this.supabase.from("audit_trail").insert({
      org_id,
      action: "UBO_EXTRACTION_COMPLETED",
      entity_type: "case",
      entity_id: case_id,
      details: {
        beneficial_owners: enriched.length,
        sanctions_hits: enriched.filter((o) => o.sanctions_hit).length,
        confidence: extraction.confidence,
      },
    });

    this.log(4, "Results stored successfully", "info");
  }

  // ─── Helper: Build Ownership Tree ──────────────────────────────────────────

  private buildOwnershipTree(owners: EnrichedOwner[]): CompanyNode {
    // Simple tree construction - root is the subject company
    return {
      name: "Subject Entity",
      jurisdiction: "Unknown",
      ownership_percentage: 100,
      owners: owners.map((owner) => ({
        ...owner,
        owners: [],
      })),
    };
  }

  // ─── Helper: Log Updates ───────────────────────────────────────────────────

  private log(phase: number, message: string, level: "info" | "warning" | "error") {
    const log_entry: AgentLog = {
      timestamp: new Date().toISOString(),
      phase,
      message,
      level,
    };

    this.logs.push(log_entry);

    // Update agent run logs in database
    this.supabase
      .from("agent_runs")
      .update({
        logs: this.logs,
        current_phase: phase,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.agent_run_id)
      .then();
  }

  // ─── Helper: Update Agent Run Status ───────────────────────────────────────

  private async updateAgentRun(status: "running" | "completed" | "failed") {
    const { error } = await this.supabase
      .from("agent_runs")
      .update({
        status,
        completed_at: status !== "running" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.agent_run_id);

    if (error) {
      console.error("Failed to update agent run status:", error);
    }
  }
}

export default UBOAgent;
