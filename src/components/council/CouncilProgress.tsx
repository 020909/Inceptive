"use client";

import type { AgentResult, CouncilState } from "@/hooks/useCouncil";

interface Props {
  agents: AgentResult[];
  currentAgent: string | null;
  status: CouncilState["status"];
  finalOutput: string | null;
  error: string | null;
  onCancel?: () => void;
}

export function CouncilProgress({
  agents,
  currentAgent,
  status,
  finalOutput,
  error,
  onCancel,
}: Props) {
  if (status === "idle") return null;

  return (
    <div className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/90 p-5 space-y-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">
          Agent Council
        </h3>
        {status === "running" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors"
          >
            Cancel
          </button>
        )}
        {status === "done" && (
          <span className="text-xs font-medium text-[var(--success)]">Complete</span>
        )}
        {status === "error" && (
          <span className="text-xs font-medium text-[var(--destructive)]">Failed</span>
        )}
      </div>

      <div className="space-y-1.5">
        {agents.map((a) => (
          <AgentRow key={a.agent} agent={a} isActive={a.agent === currentAgent} />
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--destructive)]/35 bg-[var(--destructive-soft)] p-3">
          <p className="text-xs text-[var(--destructive)]">{error}</p>
        </div>
      )}

      {finalOutput && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 max-h-64 overflow-y-auto">
          <p className="text-[11px] text-[var(--fg-muted)] mb-2 uppercase tracking-wide font-medium">
            Final output
          </p>
          <pre className="text-xs text-[var(--fg-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
            {finalOutput}
          </pre>
        </div>
      )}
    </div>
  );
}

function AgentRow({ agent, isActive }: { agent: AgentResult; isActive: boolean }) {
  const statusConfig = {
    waiting: { dot: "bg-[var(--fg-muted)]/30", text: "text-[var(--fg-muted)]", label: "" },
    running: { dot: "bg-[var(--accent)] animate-pulse", text: "text-[var(--accent)]", label: "Running…" },
    done: { dot: "bg-[var(--success)]", text: "text-[var(--success)]", label: "Done" },
    error: { dot: "bg-[var(--destructive)]", text: "text-[var(--destructive)]", label: "Error" },
  }[agent.status];

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        isActive ? "bg-[var(--bg-overlay)]/80" : ""
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusConfig.dot}`} />
      <span
        className={`text-sm flex-1 ${
          agent.status === "waiting" ? "text-[var(--fg-muted)]" : "text-[var(--fg-primary)]"
        }`}
      >
        {agent.label}
      </span>
      {statusConfig.label ? (
        <span className={`text-xs ${statusConfig.text}`}>{statusConfig.label}</span>
      ) : null}
    </div>
  );
}
