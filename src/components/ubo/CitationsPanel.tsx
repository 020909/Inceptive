"use client";

import React, { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export type Citation = { excerpt: string; source?: string; page?: number };

export type ExtractedEntity = {
  id: string;
  name: string;
  type?: string;
  sanctionsHit?: boolean;
  confidence?: number;
  citations?: Citation[];
};

export function CitationsPanel({
  open,
  onOpenChange,
  entity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: ExtractedEntity | null;
}) {
  const radius = 6;
  const citations = useMemo(() => entity?.citations ?? [], [entity]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            height: "100vh",
            width: "min(520px, 95vw)",
            background: "var(--surface-bright)",
            borderLeft: "1px solid var(--border-strong)",
            padding: 16,
            outline: "none",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs label-caps">Citations</div>
              <Dialog.Title
                className="mt-2 text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {entity ? entity.name : "No entity selected"}
              </Dialog.Title>
              <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {entity
                  ? `${entity.type ?? "Entity"} • ${citations.length} excerpt${
                      citations.length === 1 ? "" : "s"
                    }`
                  : "Select an entity to view supporting excerpts."}
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="focus-ring"
                style={{
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  borderRadius: radius,
                  padding: "6px 10px",
                  color: "var(--text-primary)",
                }}
              >
                <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <X size={14} />
                  Close
                </span>
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4" style={{ height: "calc(100vh - 92px)", overflow: "auto" }}>
            {entity ? (
              citations.length > 0 ? (
                <div className="space-y-3">
                  {citations.map((c, idx) => (
                    <div
                      key={`${idx}-${c.page ?? "na"}-${c.source ?? "src"}`}
                      style={{
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface-container)",
                        borderRadius: radius,
                        padding: 12,
                      }}
                    >
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-mono">
                          {c.source ?? "source"}
                          {c.page ? ` • p.${c.page}` : ""}
                        </span>
                      </div>
                      <pre
                        className="mt-2 font-mono text-xs whitespace-pre-wrap"
                        style={{
                          color: "var(--text-primary)",
                          background: "var(--surface-primary)",
                          border: "1px solid var(--border-faint)",
                          borderRadius: radius,
                          padding: 10,
                          lineHeight: 1.55,
                        }}
                      >
                        {c.excerpt}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: radius,
                    background: "var(--surface-container)",
                    padding: 14,
                    color: "var(--text-secondary)",
                  }}
                >
                  <div className="text-sm">No citations available for this entity.</div>
                </div>
              )
            ) : (
              <div
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: radius,
                  background: "var(--surface-container)",
                  padding: 14,
                  color: "var(--text-secondary)",
                }}
              >
                <div className="text-sm">Select an entity to view citations.</div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

