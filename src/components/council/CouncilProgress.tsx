"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ClipboardList,
  Palette,
  Layers,
  Code2,
  ShieldAlert,
  TestTube,
  FileText,
  Sparkles,
  Rocket,
  Brain,
  Check,
  Loader2,
  CircleCheck,
} from "lucide-react";
import type { AgentResult, CouncilState } from "@/hooks/useCouncil";

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  planner: ClipboardList,
  ux_designer: Palette,
  architect: Layers,
  coder: Code2,
  critic: ShieldAlert,
  tester: TestTube,
  document_specialist: FileText,
  visual_polish: Sparkles,
  deployer: Rocket,
  orchestrator: Brain,
};

interface Props {
  agents: AgentResult[];
  currentAgent: string | null;
  status: CouncilState["status"];
  finalOutput: string | null;
  error: string | null;
  onCancel?: () => void;
}

function statusLine(agent: AgentResult, isActive: boolean): string {
  if (agent.status === "running" || (isActive && agent.status === "waiting")) return "Running…";
  if (agent.status === "done") return "Completed";
  if (agent.status === "error") return "Could not complete this step";
  return "Waiting…";
}

export function CouncilProgress({
  agents,
  currentAgent,
  status,
  finalOutput,
  error,
  onCancel,
}: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (status === "running") setOpen(true);
  }, [status]);

  const headerSummary = useMemo(() => {
    const done = agents.filter((a) => a.status === "done").map((a) => a.label);
    if (status === "running") {
      if (done.length === 0) return "Working…";
      return done.join(", ");
    }
    if (status === "done") {
      return done.length ? done.join(", ") : "Done";
    }
    if (status === "error") return "Council stopped";
    return "";
  }, [agents, status]);

  const anyRunning = agents.some((a) => a.status === "running");
  const finished = status === "done" || status === "error";

  if (status === "idle") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="mb-3 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/72 shadow-[0_12px_40px_rgba(0,0,0,0.35)] overflow-hidden"
    >
      <div className="flex w-full items-stretch gap-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--bg-overlay)]/60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(245,245,247,0.12)] bg-[rgba(245,245,247,0.06)]">
            {status === "running" && anyRunning ? (
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-[var(--fg-primary)]" />
            ) : status === "done" ? (
              <CircleCheck size={18} className="text-[var(--success)]" strokeWidth={1.5} />
            ) : (
              <Brain size={16} className="text-[var(--fg-muted)]" strokeWidth={1.5} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">Council</div>
            <div className="truncate text-sm font-medium text-[var(--fg-primary)]">{headerSummary}</div>
          </div>
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-[var(--fg-secondary)] shrink-0" />
          </motion.span>
        </button>
        {status === "running" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 px-3.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors border-l border-[var(--border-subtle)] hover:bg-[var(--bg-overlay)]/40"
          >
            Cancel
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-[var(--border-subtle)]"
          >
            <div className="relative px-3 py-3">
              <div
                className="pointer-events-none absolute left-[27px] top-3 bottom-12 w-px bg-[linear-gradient(180deg,rgba(245,245,247,0.14),rgba(245,245,247,0.04))]"
                aria-hidden
              />
              <ul className="space-y-0.5">
                {agents.map((agent, idx) => {
                  const Icon = AGENT_ICONS[agent.agent] || Brain;
                  const isActive = agent.agent === currentAgent;
                  const thinking = agent.status === "running" || (isActive && agent.status === "waiting");
                  const done = agent.status === "done";
                  const err = agent.status === "error";

                  return (
                    <motion.li
                      key={`${agent.agent}-${idx}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, type: "spring", stiffness: 400, damping: 32 }}
                      className="relative flex gap-3 pl-1"
                    >
                      <div
                        className={`relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          thinking
                            ? "border-[rgba(245,245,247,0.35)] bg-[rgba(245,245,247,0.08)] shadow-[0_0_20px_rgba(245,245,247,0.08)]"
                            : done
                              ? "border-[var(--success)]/35 bg-[var(--success-soft)]"
                              : err
                                ? "border-[var(--destructive)]/40 bg-[var(--destructive-soft)]"
                                : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                        }`}
                      >
                        {thinking ? (
                          <Loader2 size={14} className="animate-spin text-[var(--fg-primary)]" />
                        ) : (
                          <Icon
                            size={14}
                            className={
                              done ? "text-[var(--success)]" : err ? "text-[var(--destructive)]" : "text-[var(--fg-muted)]"
                            }
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-2 pt-0.5">
                        <div className="text-[13px] font-medium text-[var(--fg-primary)]">{agent.label}</div>
                        <div className="text-[11px] text-[var(--fg-muted)]">{statusLine(agent, isActive)}</div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>

              {finished && (
                <div className="relative flex gap-3 pl-1 pt-1">
                  <div className="relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--success)]/35 bg-[var(--success-soft)]">
                    <Check size={14} className="text-[var(--success)]" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1 pb-1 pt-1">
                    <div className="text-[13px] font-medium text-[var(--fg-primary)]">Done</div>
                    <div className="text-[11px] text-[var(--fg-muted)]">
                      {status === "error" ? "Stopped with errors" : "Council finished"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="border-t border-[var(--border-subtle)] px-3.5 py-3">
          <div className="rounded-lg border border-[var(--destructive)]/35 bg-[var(--destructive-soft)] p-3">
            <p className="text-xs text-[var(--destructive)]">{error}</p>
          </div>
        </div>
      )}

      {finalOutput && (
        <div className="border-t border-[var(--border-subtle)] px-3.5 py-3">
          <p className="text-[11px] text-[var(--fg-muted)] mb-2 uppercase tracking-wide font-medium">Final output</p>
          <pre className="text-xs text-[var(--fg-secondary)] whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
            {finalOutput}
          </pre>
        </div>
      )}
    </motion.div>
  );
}
