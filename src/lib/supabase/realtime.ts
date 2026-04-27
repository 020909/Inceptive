"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentRunStatus = "running" | "completed" | "failed" | "paused";

export interface AgentRun {
  id: string;
  org_id: string;
  agent_type: string;
  status: AgentRunStatus;
  input_data: Record<string, unknown> | null;
  current_phase: number;
  logs: Array<{
    timestamp: string;
    phase: number;
    message: string;
    level: "info" | "warning" | "error";
  }> | null;
  output_data: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  case_title?: string | null;
}

type ApprovalStatus = "pending" | "approved" | "rejected";
type ApprovalItemType = "ubo_extraction" | "document" | "compliance_check" | "risk_assessment";
type Priority = "high" | "medium" | "low";

export interface ApprovalQueueItem {
  id: string;
  org_id: string;
  item_type: ApprovalItemType;
  item_id: string;
  status: ApprovalStatus;
  priority: Priority;
  requested_by: string;
  requester?: {
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  title?: string;
  ai_recommendation?: string | null;
  metadata?: {
    subject_name?: string;
    confidence?: number;
    extraction_data?: Record<string, unknown>;
  } | null;
}

type DocumentStatus = "pending" | "parsing" | "completed" | "failed";

export interface CaseDocument {
  id: string;
  case_id: string;
  org_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  parsing_status: DocumentStatus;
  parsing_error: string | null;
  parsed_text: string | null;
  parsed_data: Record<string, unknown> | null;
  uploaded_by: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface UBOExtraction {
  id: string;
  case_id: string;
  org_id: string;
  status: string;
  confidence: number;
  extracted_data: {
    beneficial_owners?: Array<{
      name: string;
      ownership_percentage: number;
      address?: string;
      sanctions_match?: boolean;
    }>;
    ownership_tree?: Record<string, unknown>;
    sanctions_matches?: Array<{
      name: string;
      list: string;
      confidence: number;
    }>;
  };
  needs_review: boolean;
  created_at: string;
  updated_at: string;
  case?: {
    subject_name: string;
    subject_address?: string;
  };
}

export interface AuditTrailEntry {
  id: string;
  org_id: string;
  event_type: string;
  event_description: string;
  actor: string | null;
  actor_name?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Subscribe to agent_runs changes for an organization
 * @param orgId - The organization ID to filter by
 * @returns Array of agent runs sorted by creation date (newest first)
 */
export function useAgentRunsRealtime(orgId: string): AgentRun[] {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!orgId) return;

    // Initial fetch
    const fetchRuns = async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching agent runs:", error);
        return;
      }
      setRuns(data || []);
    };

    void fetchRuns();

    // Subscribe to changes
    const channel = supabase
      .channel(`agent_runs:${orgId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: `org_id=eq.${orgId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setRuns((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRuns((prev) =>
              prev.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          } else if (payload.eventType === "DELETE") {
            setRuns((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, supabase]);

  return runs;
}

/**
 * Subscribe to approval_queue changes for an organization
 * @param orgId - The organization ID to filter by
 * @returns Array of approval queue items sorted by creation date (newest first)
 */
export function useApprovalQueueRealtime(orgId: string): ApprovalQueueItem[] {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!orgId) return;

    // Initial fetch
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from("approval_queue")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching approval queue:", error);
        return;
      }
      setItems(data || []);
    };

    void fetchItems();

    // Subscribe to changes
    const channel = supabase
      .channel(`approval_queue:${orgId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "approval_queue",
          filter: `org_id=eq.${orgId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((i) => (i.id === payload.new.id ? payload.new : i))
            );
          } else if (payload.eventType === "DELETE") {
            setItems((prev) => prev.filter((i) => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, supabase]);

  return items;
}

/**
 * Subscribe to case_documents changes for a specific case
 * @param caseId - The case ID to filter by
 * @returns Array of case documents sorted by creation date (newest first)
 */
export function useDocumentsRealtime(caseId: string): CaseDocument[] {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!caseId) return;

    // Initial fetch
    const fetchDocuments = async () => {
      const { data, error } = await supabase
        .from("case_documents")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching documents:", error);
        return;
      }
      setDocuments(data || []);
    };

    void fetchDocuments();

    // Subscribe to changes
    const channel = supabase
      .channel(`case_documents:${caseId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "case_documents",
          filter: `case_id=eq.${caseId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setDocuments((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setDocuments((prev) =>
              prev.map((d) => (d.id === payload.new.id ? payload.new : d))
            );
          } else if (payload.eventType === "DELETE") {
            setDocuments((prev) => prev.filter((d) => d.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caseId, supabase]);

  return documents;
}

/**
 * Subscribe to ubo_extractions changes for a specific case
 * @param caseId - The case ID to filter by
 * @returns Array of UBO extractions sorted by creation date (newest first)
 */
export function useUBOExtractionsRealtime(caseId: string): UBOExtraction[] {
  const [extractions, setExtractions] = useState<UBOExtraction[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!caseId) return;

    // Initial fetch
    const fetchExtractions = async () => {
      const { data, error } = await supabase
        .from("ubo_extractions")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching UBO extractions:", error);
        return;
      }
      setExtractions(data || []);
    };

    void fetchExtractions();

    // Subscribe to changes
    const channel = supabase
      .channel(`ubo_extractions:${caseId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "ubo_extractions",
          filter: `case_id=eq.${caseId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setExtractions((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setExtractions((prev) =>
              prev.map((e) => (e.id === payload.new.id ? payload.new : e))
            );
          } else if (payload.eventType === "DELETE") {
            setExtractions((prev) =>
              prev.filter((e) => e.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caseId, supabase]);

  return extractions;
}

/**
 * Subscribe to audit_trail changes for an organization
 * @param orgId - The organization ID to filter by
 * @returns Array of audit trail entries sorted by creation date (newest first)
 */
export function useAuditTrailRealtime(orgId: string): AuditTrailEntry[] {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!orgId) return;

    // Initial fetch
    const fetchEntries = async () => {
      const { data, error } = await supabase
        .from("audit_trail")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching audit trail:", error);
        return;
      }
      setEntries(data || []);
    };

    void fetchEntries();

    // Subscribe to changes
    const channel = supabase
      .channel(`audit_trail:${orgId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "audit_trail",
          filter: `org_id=eq.${orgId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setEntries((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setEntries((prev) =>
              prev.map((e) => (e.id === payload.new.id ? payload.new : e))
            );
          } else if (payload.eventType === "DELETE") {
            setEntries((prev) => prev.filter((e) => e.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, supabase]);

  return entries;
}
