"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
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
  Shield,
  Check,
  Loader2,
} from "lucide-react";
import type { TaskLog } from "@/lib/chat-context";

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  planner: ClipboardList,
  "ux-designer": Palette,
  architect: Layers,
  coder: Code2,
  critic: ShieldAlert,
  tester: TestTube,
  "doc-specialist": FileText,
  "visual-polish": Sparkles,
  deployer: Rocket,
  orchestrator: Brain,
};

export function isCouncilTaskLog(log: TaskLog): boolean {
  return Boolean(log.details && typeof log.details === "object" && (log.details as { agentRole?: string }).agentRole);
}

function normalizeSteps(logs: TaskLog[]) {
  const council = logs.filter(isCouncilTaskLog);
  const byRole = new Map<string, TaskLog>();
  for (const log of council) {
    const role = String((log.details as { agentRole?: string }).agentRole || "");
    if (!role) continue;
    byRole.set(role, log);
  }
  const ordered = Array.from(byRole.values()).sort(
    (a, b) =>
      Number((a.details as { phase?: number }).phase || 0) - Number((b.details as { phase?: number }).phase || 0)
  );
  return { ordered };
}

export function CouncilActivityTimeline({
  logs,
  isStreaming,
  isLastAssistant,
}: {
  logs: TaskLog[];
  isStreaming: boolean;
  isLastAssistant: boolean;
}) {
  const councilPresent = logs.some(isCouncilTaskLog);
  const { ordered } = useMemo(
    () => (councilPresent ? normalizeSteps(logs) : { ordered: [] as TaskLog[] }),
    [logs, councilPresent]
  );

  const activeLive = isStreaming && isLastAssistant;
  const [open, setOpen] = useState(activeLive);
  const prevStream = useRef(isStreaming);

  useEffect(() => {
    if (prevStream.current && !isStreaming && isLastAssistant) {
      setOpen(false);
    }
    if (!prevStream.current && isStreaming && isLastAssistant) {
      setOpen(true);
    }
    prevStream.current = isStreaming;
  }, [isStreaming, isLastAssistant]);

  const doneCount = ordered.filter((l) => (l.details as { agentStatus?: string }).agentStatus === "done").length;
  const errCount = ordered.filter((l) => (l.details as { agentStatus?: string }).agentStatus === "error").length;
  const anyThinking = ordered.some((l) => (l.details as { agentStatus?: string }).agentStatus === "thinking");
  const finished = !isStreaming && isLastAssistant;

  const headerStatus = finished
    ? errCount > 0
      ? `Finished · ${errCount} specialist step(s) could not reach the model (check OpenRouter key / rate limits)`
      : `Done · ${doneCount} specialist pass(es)`
    : anyThinking
      ? "Working…"
      : "In progress…";

  if (!councilPresent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="mb-3 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/72 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.35)] overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--bg-overlay)]/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(245,245,247,0.12)] bg-[rgba(245,245,247,0.06)]">
          {activeLive ? (
            <motion.span
              className="text-[var(--fg-primary)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles size={18} strokeWidth={1.5} />
            </motion.span>
          ) : finished ? (
            <Check size={18} className="text-[var(--success)]" strokeWidth={2} />
          ) : (
            <Shield size={16} className="text-[var(--fg-muted)]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">Council</div>
          <div className="truncate text-sm font-medium text-[var(--fg-primary)]">{headerStatus}</div>
        </div>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          {open ? (
            <ChevronDown size={18} className="text-[var(--fg-secondary)]" />
          ) : (
            <ChevronRight size={18} className="text-[var(--fg-secondary)]" />
          )}
        </motion.span>
      </button>

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
                className="pointer-events-none absolute left-[27px] top-3 bottom-3 w-px bg-[linear-gradient(180deg,rgba(245,245,247,0.14),rgba(245,245,247,0.04))]"
                aria-hidden
              />
              <ul className="space-y-0.5">
                {ordered.length === 0 && (
                  <li className="relative flex gap-3 pl-1 py-2 text-[12px] text-[var(--fg-muted)]">
                    <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin opacity-80" />
                    Warming up Council agents…
                  </li>
                )}
                {ordered.map((log, idx) => {
                  const d = log.details as {
                    agentRole?: string;
                    agentName?: string;
                    agentStatus?: string;
                    phase?: number;
                  };
                  const role = d.agentRole || "";
                  const Icon = AGENT_ICONS[role] || Brain;
                  const st =
                    d.agentStatus || (log.status === "running" ? "thinking" : log.status) || "idle";
                  const thinking = st === "thinking" || st === "running";
                  const done = st === "done";
                  const err = st === "error";

                  return (
                    <motion.li
                      key={`${role}-${idx}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 32 }}
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
                        <div className="text-[13px] font-medium text-[var(--fg-primary)]">
                          {d.agentName?.replace(/\s+Agent$/i, "") || role}
                        </div>
                        <div className="text-[11px] text-[var(--fg-muted)]">
                          {thinking
                            ? "Running…"
                            : done
                              ? "Completed"
                              : err
                                ? "Could not complete this step (often API key, rate limit, or provider). Others may still finish the build."
                                : log.action}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
