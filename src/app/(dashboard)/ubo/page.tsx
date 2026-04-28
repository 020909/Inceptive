"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { DocumentUpload } from "@/components/ubo/DocumentUpload";
import { OwnershipTree } from "@/components/ubo/OwnershipTree";
import { CitationsPanel, type ExtractedEntity } from "@/components/ubo/CitationsPanel";
import { ChevronRight, FileSearch, Send, ShieldAlert } from "lucide-react";

type ApprovalQueueRow = {
  id: string;
  status: "pending" | "approved" | "rejected" | string;
  metadata?: Record<string, unknown> | null;
};

type UploadResult = {
  queue_id?: string;
  entities?: Array<{
    id?: string;
    name: string;
    type?: string;
    sanctions_hit?: boolean;
    confidence?: number;
    citations?: Array<{ excerpt: string; source?: string; page?: number }>;
  }>;
  ownership_tree?: unknown;
  confidence?: number;
  screening_status?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asExtractedEntities(result: UploadResult | null): ExtractedEntity[] {
  const raw = result?.entities ?? [];
  return raw.map((e, idx) => ({
    id: e.id ?? `${idx}`,
    name: e.name,
    type: e.type,
    sanctionsHit: e.sanctions_hit,
    confidence: e.confidence,
    citations: e.citations ?? [],
  }));
}

function getProcessingStepIndex(row: ApprovalQueueRow | null, steps: string[]) {
  if (!row) return 0;
  if (row.status === "approved" || row.status === "rejected") return steps.length - 1;

  const meta = row.metadata ?? {};
  const phase = (meta as any)?.current_phase ?? (meta as any)?.phase ?? (meta as any)?.step_index;
  if (typeof phase === "number" && Number.isFinite(phase)) return clamp(Math.floor(phase), 0, steps.length - 1);

  const stepName = (meta as any)?.processing_step ?? (meta as any)?.step ?? (meta as any)?.status;
  if (typeof stepName === "string") {
    const idx = steps.findIndex((s) => s.toLowerCase() === stepName.toLowerCase());
    if (idx >= 0) return idx;
  }

  return 1;
}

function Stepper({ steps, activeIndex, statusText }: { steps: string[]; activeIndex: number; statusText?: string }) {
  const radius = 6;
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: radius, background: "var(--surface-container)", padding: 12 }}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs label-caps">Processing</div>
        {statusText ? (
          <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            {statusText}
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {steps.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          const color = active
            ? "var(--text-primary)"
            : done
              ? "var(--text-secondary)"
              : "rgba(138, 154, 168, 0.55)";
          const dotBg = active ? "var(--text-primary)" : done ? "var(--border-strong)" : "var(--border-subtle)";
          return (
            <div key={s} className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: 9999, background: dotBg, border: "1px solid var(--border-subtle)" }} />
              <div className="text-xs" style={{ color }}>
                {s}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UboPage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [queueRow, setQueueRow] = useState<ApprovalQueueRow | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [citationsOpen, setCitationsOpen] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const entities = useMemo(() => asExtractedEntities(uploadResult), [uploadResult]);
  const selectedEntity = useMemo(
    () => (selectedEntityId ? entities.find((e) => e.id === selectedEntityId) ?? null : null),
    [entities, selectedEntityId]
  );

  const ownershipData = (uploadResult?.ownership_tree as any) ?? null;
  const confidence = uploadResult?.confidence;
  const screeningStatus = uploadResult?.screening_status;

  const steps = useMemo(
    () => ["Uploaded", "Parsing", "Extracting entities", "Building ownership tree", "Screening", "Queued for review", "Complete"],
    []
  );
  const activeStep = useMemo(() => getProcessingStepIndex(queueRow, steps), [queueRow, steps]);

  useEffect(() => {
    if (!queueId) return;
    const supabase = createClient();
    setQueueError(null);

    const fetchRow = async () => {
      const { data, error } = await supabase.from("approval_queue").select("*").eq("id", queueId).maybeSingle();
      if (error) {
        setQueueError("Failed to load processing status.");
        return;
      }
      setQueueRow((data as any) ?? null);
    };
    void fetchRow();

    const channel = supabase
      .channel(`approval_queue:ubo:${queueId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "approval_queue", filter: `id=eq.${queueId}` },
        (payload: any) => {
          if (payload?.new) setQueueRow(payload.new as ApprovalQueueRow);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queueId]);

  const onUploaded = useCallback((result: any) => {
    const r = result as UploadResult;
    setUploadResult(r);
    setQueueId(r.queue_id ?? null);
    setQueueRow(null);
    setQueueError(null);
    setSelectedEntityId(null);
    setCitationsOpen(false);

    // Onboarding: mark first workflow run (UBO upload)
    try {
      localStorage.setItem("inceptive:onboarding:ran_workflow", "true");
    } catch {
      // ignore
    }
  }, []);

  const openCitationsFor = useCallback((id: string) => {
    setSelectedEntityId(id);
    setCitationsOpen(true);
  }, []);

  const sendToQueue = useCallback(async () => {
    if (!queueId) return;
    setSending(true);
    try {
      await fetch("/api/ubo/send-to-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: queueId }),
      });
    } finally {
      setSending(false);
    }
  }, [queueId]);

  const radius = 6;

  return (
    <div className="flex flex-col gap-4" style={{ padding: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, lineHeight: 1.2 }}>
          Beneficial ownership extraction
        </h2>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 3fr", alignItems: "start" }}>
        <div className="flex flex-col gap-4">
          <DocumentUpload onUploaded={onUploaded} />
          <Stepper steps={steps} activeIndex={activeStep} statusText={queueId ? `queue_id=${queueId}` : "—"} />

          {queueError ? (
            <div style={{ border: "1px solid rgba(220, 38, 38, 0.35)", borderRadius: radius, background: "var(--signal-negative-bg)", padding: 12, color: "var(--signal-negative)" }}>
              <div className="text-xs font-semibold tracking-wide uppercase">Realtime</div>
              <div className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                {queueError}
              </div>
            </div>
          ) : null}

          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: radius, background: "var(--surface-container)", padding: 12 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs label-caps">Extracted entities</div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Click an entity to open citations.
                </div>
              </div>
              <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                {entities.length}
              </div>
            </div>

            {entities.length === 0 ? (
              <div className="mt-3" style={{ border: "1px solid var(--border-faint)", borderRadius: radius, background: "var(--surface-primary)", padding: 12, color: "var(--text-secondary)" }}>
                <div className="flex items-center gap-2 text-sm">
                  <FileSearch size={16} />
                  No entities yet. Upload a document to begin.
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {entities.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openCitationsFor(e.id)}
                    className="focus-ring"
                    style={{
                      border: e.sanctionsHit ? "1px solid rgba(220, 38, 38, 0.45)" : "1px solid var(--border-subtle)",
                      borderRadius: radius,
                      background: e.sanctionsHit ? "var(--signal-negative-bg)" : "var(--surface-primary)",
                      padding: 10,
                      textAlign: "left",
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{e.name}</div>
                      <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-mono">
                          {e.type ?? "entity"}
                          {typeof e.confidence === "number" ? ` • conf=${e.confidence.toFixed(2)}` : ""}
                          {e.citations?.length ? ` • cites=${e.citations.length}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {e.sanctionsHit ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--signal-negative)", border: "1px solid rgba(220, 38, 38, 0.35)", background: "rgba(220, 38, 38, 0.08)", borderRadius: radius, padding: "4px 8px" }}>
                          <ShieldAlert size={14} />
                          hit
                        </span>
                      ) : null}
                      <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <OwnershipTree data={ownershipData} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3" style={{ border: "1px solid var(--border-subtle)", borderRadius: radius, background: "var(--surface-container)", padding: 12 }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs label-caps">Status</div>
          <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            conf={typeof confidence === "number" ? confidence.toFixed(2) : "—"} • screening={screeningStatus ?? "—"}
            {queueRow?.status ? ` • queue_status=${queueRow.status}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={sendToQueue}
          disabled={!queueId || sending}
          className="focus-ring"
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: radius,
            padding: "8px 14px",
            background: !queueId ? "transparent" : "var(--text-primary)",
            color: !queueId ? "var(--text-muted)" : "var(--text-inverse)",
            opacity: sending ? 0.8 : 1,
            cursor: !queueId ? "not-allowed" : "pointer",
          }}
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <Send size={14} />
            {sending ? "Sending…" : "Send to queue"}
          </span>
        </button>
      </div>

      <CitationsPanel open={citationsOpen} onOpenChange={setCitationsOpen} entity={selectedEntity} />
    </div>
  );
}

