"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Shield,
  ChevronDown,
  ChevronUp,
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

const PHASE_ORDER = [1, 2, 3, 4];

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

function parseTrustScore(logs: TaskLog[]): number | null {
  for (const log of [...logs].reverse()) {
    if (log.details && typeof log.details === "object" && (log.details as any).trustScore != null) {
      return (log.details as any).trustScore;
    }
  }
  return null;
}

/** Animated agent avatar with ring effect */
function AgentAvatarPremium({ role, status, index }: { role: string; status: AgentStatus; index: number }) {
  const Icon = AGENT_ICON_MAP[role] || Brain;
  const isThinking = status === "thinking";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 300, damping: 20 }}
      className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
        isThinking
          ? "bg-[var(--accent-soft)] border border-[var(--accent)] agent-ring-active"
          : isDone
            ? "bg-[var(--success-soft)] border border-[var(--success)]/30"
            : isError
              ? "bg-[var(--destructive-soft)] border border-[var(--destructive)]/30"
              : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
      }`}
    >
      {isThinking && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{ boxShadow: "0 0 12px rgba(10, 132, 255, 0.2)" }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
      <Icon
        size={12}
        className={`relative z-10 ${
          isThinking ? "text-[var(--accent)]"
            : isDone ? "text-[var(--success)]"
            : isError ? "text-[var(--destructive)]"
            : "text-[var(--fg-muted)]"
        }`}
      />
    </motion.div>
  );
}

/** Phase progress bar */
function PhaseProgress({ events }: { events: ParsedAgentEvent[] }) {
  const maxPhase = events.length > 0 ? Math.max(...events.map((e) => e.phase)) : 0;
  const currentThinking = events.filter((e) => e.status === "thinking");
  const activePhase = currentThinking.length > 0 ? Math.max(...currentThinking.map((e) => e.phase)) : maxPhase;

  return (
    <div className="flex items-center gap-1 w-full">
      {PHASE_ORDER.map((phase, i) => {
        const phaseEvents = events.filter((e) => e.phase === phase);
        const allDone = phaseEvents.length > 0 && phaseEvents.every((e) => e.status === "done");
        const isActive = phase === activePhase && currentThinking.length > 0;
        const isPending = phase > maxPhase;

        return (
          <React.Fragment key={phase}>
            <div className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-[3px] rounded-full transition-all duration-500 ${
                  allDone ? "bg-[var(--success)]"
                    : isActive ? "bg-[var(--accent)]"
                    : "bg-[var(--border-subtle)]"
                }`}
              >
                {isActive && (
                  <motion.div
                    className="h-full bg-[var(--accent)] rounded-full"
                    initial={{ width: "20%" }}
                    animate={{ width: "80%" }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                  />
                )}
              </div>
              <span className={`text-[8px] font-medium uppercase tracking-wider ${
                allDone ? "text-[var(--success)]"
                  : isActive ? "text-[var(--accent)]"
                  : "text-[var(--fg-muted)]"
              }`}>
                {PHASE_LABELS[phase]?.split(" ")[0]}
              </span>
            </div>
            {i < PHASE_ORDER.length - 1 && <div className="w-0.5" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Trust Score Badge */
function TrustScoreBadge({ score }: { score: number }) {
  const cls = score >= 70 ? "trust-high" : score >= 40 ? "trust-medium" : "trust-low";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`trust-badge ${cls}`}
    >
      <Shield size={9} />
      {score}/100
    </motion.div>
  );
}

function AgentEventRow({ event, isLast }: { event: ParsedAgentEvent; isLast: boolean }) {
  const Icon = AGENT_ICON_MAP[event.role] || Brain;
  const isThinking = event.status === "thinking";
  const isDone = event.status === "done";
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className={`py-2 ${!isLast ? "border-b border-[var(--border-subtle)]" : ""}`}
    >
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => event.output && setExpanded(!expanded)}>
        <div
          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
            isThinking ? "bg-[var(--accent-soft)]"
              : isDone ? "bg-[var(--success-soft)]"
              : "bg-[var(--destructive-soft)]"
          }`}
        >
          <Icon size={10} className={
            isThinking ? "text-[var(--accent)]"
              : isDone ? "text-[var(--success)]"
              : "text-[var(--destructive)]"
          } />
        </div>
        <span className="text-[11px] font-semibold text-[var(--fg-secondary)] flex-1 truncate">{event.name}</span>
        {isThinking && (
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
        {event.output && (
          <span className="text-[var(--fg-muted)]">
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </span>
        )}
      </div>
      <AnimatePresence>
        {expanded && event.output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[10px] text-[var(--fg-tertiary)] mt-1.5 ml-7 leading-relaxed line-clamp-6 whitespace-pre-wrap">
              {event.output}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 btn-premium
        ${isOpen
          ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 glow-accent"
          : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] border border-transparent"
        }
      `}
      title="Toggle Studio Mode — view live agent debate"
    >
      {isOpen ? <EyeOff size={13} /> : <Eye size={13} />}
      Studio
      {eventCount > 0 && !isOpen && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent)] text-[9px] font-bold text-white"
        >
          {eventCount > 9 ? "9+" : eventCount}
        </motion.span>
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
  const trustScore = parseTrustScore(logs);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Deduplicate: keep latest state per agent
  const agentMap = new Map<string, { status: AgentStatus }>();
  for (const e of events) {
    agentMap.set(e.role, { status: e.status as AgentStatus });
  }

  const thinkingCount = Array.from(agentMap.values()).filter((a) => a.status === "thinking").length;
  const doneCount = Array.from(agentMap.values()).filter((a) => a.status === "done").length;

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="h-full border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col shrink-0 glass-panel"
        >
          {/* Header */}
          <div className="px-3 py-3 border-b border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-[var(--fg-primary)] tracking-widest uppercase">
                Agent Council
              </h3>
              {trustScore !== null && <TrustScoreBadge score={trustScore} />}
            </div>

            {/* Agent avatar strip */}
            <div className="flex items-center gap-1 mb-2.5 overflow-x-auto scrollbar-hide">
              {Object.keys(AGENT_ICON_MAP).map((role, i) => (
                <AgentAvatarPremium
                  key={role}
                  role={role}
                  status={(agentMap.get(role)?.status as AgentStatus) || "idle"}
                  index={i}
                />
              ))}
            </div>

            {/* Phase progress */}
            {events.length > 0 && <PhaseProgress events={events} />}

            {/* Stats */}
            <div className="flex items-center gap-3 mt-2">
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
                <span className="text-[10px] text-[var(--success)]">{doneCount} complete</span>
              )}
            </div>
          </div>

          {/* Event feed */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[var(--fg-muted)]">
                <Brain size={18} className="mb-2 opacity-30" />
                <p className="text-[11px]">Waiting for council...</p>
                <p className="text-[9px] mt-0.5 opacity-60">Submit a task to activate agents</p>
              </div>
            ) : (
              events.map((event, i) => (
                <AgentEventRow key={`${event.role}-${i}`} event={event} isLast={i === events.length - 1} />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
