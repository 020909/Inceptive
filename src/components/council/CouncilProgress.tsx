"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Sparkles,
} from "lucide-react";
import type { AgentResult, CouncilState } from "@/hooks/useCouncil";

interface Props {
  agents: AgentResult[];
  currentAgent: string | null;
  status: CouncilState["status"];
  finalOutput: string | null;
  error: string | null;
  onCancel?: () => void;
}

function statusLine(agent: AgentResult, isActive: boolean): string {
  if (agent.status === "running" || (isActive && agent.status === "waiting")) return "Running";
  if (agent.status === "done") return "Completed";
  if (agent.status === "error") return "Error";
  return "Waiting";
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

  const finished = status === "done" || status === "error";

  if (status === "idle") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="mb-3 w-full overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--ide-border)",
        background: "var(--ide-panel)",
        boxShadow: "0_18px_60px_rgba(0,0,0,0.55)",
      }}
    >
      <div className="flex w-full items-stretch gap-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#3b82f6]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">
                Council
              </span>
              <span
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(59,130,246,0.8), rgba(168,85,247,0.5), rgba(0,0,0,0))",
                }}
              />
            </div>
            <div className="truncate text-[12px] font-medium text-white/80">{headerSummary}</div>
          </div>
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="shrink-0 text-white/60" />
          </motion.span>
        </button>
        {status === "running" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 px-3.5 text-xs transition-colors border-l"
            style={{ borderColor: "var(--ide-border)", color: "var(--ide-muted)" }}
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
            className="border-t"
            style={{ borderColor: "var(--ide-border)" }}
          >
            <div className="relative px-3 py-3">
              <ul className="space-y-0.5">
                {agents.map((agent, idx) => {
                  const isActive = agent.agent === currentAgent;
                  const running = agent.status === "running" || (isActive && agent.status === "waiting");
                  const done = agent.status === "done";
                  const waiting = agent.status === "waiting" && !isActive;

                  return (
                    <motion.li
                      key={`${agent.agent}-${idx}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, type: "spring", stiffness: 400, damping: 32 }}
                      className="relative"
                    >
                      <div
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                        style={{
                          border: "1px solid var(--ide-border)",
                          background: running ? "rgba(59,130,246,0.05)" : "rgba(255,255,255,0.02)",
                          boxShadow: isActive ? "inset 0 0 0 1px rgba(59,130,246,0.18)" : "none",
                          borderLeft: running ? "2px solid #3b82f6" : "2px solid transparent",
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative h-6 w-6 shrink-0">
                            {done ? (
                              <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                            ) : running ? (
                              <>
                                <motion.span
                                  className="absolute left-[7px] top-[7px] h-3.5 w-3.5 rounded-full border border-[#3b82f6]"
                                  animate={{ opacity: [0.35, 0.9, 0.35], scale: [1, 1.3, 1] }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                              </>
                            ) : (
                              <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full border border-white/35 bg-transparent" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className={`text-[13px] font-medium truncate ${done ? "line-through text-white/45" : "text-white/80"}`}>
                              {agent.label}
                            </div>
                            <div className="text-[11px]" style={{ color: running ? "#3b82f6" : "var(--ide-muted)" }}>
                              {statusLine(agent, isActive)}
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] font-medium" style={{ color: running ? "#3b82f6" : done ? "#22c55e" : "var(--ide-muted2)" }}>
                          {done ? "Done" : running ? "Running" : waiting ? "Waiting" : agent.status}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>

              {finished ? null : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--ide-border)" }}>
          <div className="rounded-lg border p-3" style={{ borderColor: "rgba(255,93,93,0.25)", background: "rgba(255,93,93,0.08)" }}>
            <p className="text-xs text-red-200/90">{error}</p>
          </div>
        </div>
      )}

      {finalOutput && (
        <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--ide-border)" }}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-white/60">Final output</p>
          <pre className="max-h-64 overflow-y-auto rounded-lg border p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap" style={{ borderColor: "var(--ide-border)", background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.72)" }}>
            {finalOutput}
          </pre>
        </div>
      )}
    </motion.div>
  );
}
