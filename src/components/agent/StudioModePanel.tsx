"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
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
  Clock,
  ChevronRight,
} from "lucide-react";
import type { TaskLog } from "@/lib/chat-context";

type AgentRole = string;
type AgentStatus = "idle" | "thinking" | "done" | "error";

interface ParsedAgentEvent {
  role: AgentRole;
  name: string;
  status: AgentStatus;
  phase: number;
  output: string;
  timestamp: string;
}

const AGENT_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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

const PHASE_LABELS: Record<number, string> = {
  1: "Planning",
  2: "Parallel Expertise",
  3: "Review & QA",
  4: "Synthesis",
};

function parseEvents(logs: TaskLog[]): ParsedAgentEvent[] {
  return logs
    .filter((l) => l.details && typeof l.details === "object" && (l.details as any).agentRole)
    .map((l) => {
      const d = l.details as any;
      return {
        role: d.agentRole || "",
        name: d.agentName || "",
        status: d.agentStatus || "idle",
        phase: d.phase || 0,
        output: d.agentOutput || "",
        timestamp: (l as any).created_at || new Date().toISOString(),
      };
    });
}

function AgentEventRow({ event }: { event: ParsedAgentEvent }) {
  const Icon = AGENT_ICON_MAP[event.role] || Brain;
  const isThinking = event.status === "thinking";
  const isDone = event.status === "done";
  const isError = event.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-0"
    >
      <div
        className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
          isThinking
            ? "bg-[var(--accent-soft)]"
            : isDone
              ? "bg-[var(--success-soft)]"
              : isError
                ? "bg-[var(--destructive-soft)]"
                : "bg-[var(--bg-elevated)]"
        }`}
      >
        <Icon
          size={12}
          className={
            isThinking
              ? "text-[var(--accent)]"
              : isDone
                ? "text-[var(--success)]"
                : isError
                  ? "text-[var(--destructive)]"
                  : "text-[var(--fg-muted)]"
          }
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--fg-secondary)]">{event.name}</span>
          <span className="text-[10px] text-[var(--fg-muted)] font-mono">{PHASE_LABELS[event.phase] || `Phase ${event.phase}`}</span>
          {isThinking && (
            <motion.span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
        {event.output && (
          <p className="mt-0.5 text-[11px] text-[var(--fg-tertiary)] line-clamp-3 leading-relaxed">
            {event.output}
          </p>
        )}
      </div>
    </motion.div>
  );
}

interface StudioModeToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  eventCount: number;
}

export function StudioModeToggle({ isOpen, onToggle, eventCount }: StudioModeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
        ${isOpen
          ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30"
          : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]"
        }
      `}
      title="Toggle Studio Mode — view live agent debate"
    >
      {isOpen ? <EyeOff size={13} /> : <Eye size={13} />}
      Studio
      {eventCount > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
          {eventCount > 9 ? "9+" : eventCount}
        </span>
      )}
    </button>
  );
}

interface StudioModePanelProps {
  logs: TaskLog[];
  isOpen: boolean;
}

export function StudioModePanel({ logs, isOpen }: StudioModePanelProps) {
  const events = parseEvents(logs);
  const uniqueAgents = new Set(events.map((e) => e.role));
  const thinkingCount = events.filter((e) => e.status === "thinking").length;
  const doneCount = events.filter((e) => e.status === "done").length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="h-full border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col shrink-0"
        >
          {/* Header */}
          <div className="px-3 py-3 border-b border-[var(--border-subtle)] shrink-0">
            <h3 className="text-xs font-semibold text-[var(--fg-primary)] tracking-wide uppercase">
              Agent Council
            </h3>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] text-[var(--fg-muted)]">
                {uniqueAgents.size} agents
              </span>
              {thinkingCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--accent)]">
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  {thinkingCount} active
                </span>
              )}
              {doneCount > 0 && (
                <span className="text-[10px] text-[var(--success)]">{doneCount} done</span>
              )}
            </div>
          </div>

          {/* Event feed */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[var(--fg-muted)]">
                <Clock size={16} className="mb-2 opacity-40" />
                <p className="text-[11px]">Waiting for council activity...</p>
              </div>
            ) : (
              <div className="space-y-0">
                {events.map((event, i) => (
                  <AgentEventRow key={`${event.role}-${i}`} event={event} />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
