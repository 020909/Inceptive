"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { TaskLog } from "@/lib/chat-context";

type AgentRole =
  | "planner"
  | "ux-designer"
  | "architect"
  | "coder"
  | "critic"
  | "tester"
  | "doc-specialist"
  | "visual-polish"
  | "deployer"
  | "orchestrator";

type AgentStatus = "idle" | "thinking" | "done" | "error";

interface AgentState {
  role: AgentRole;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status: AgentStatus;
  output?: string;
}

const AGENT_DEFINITIONS: AgentState[] = [
  { role: "planner", name: "Planner Agent", shortName: "Plan", icon: ClipboardList, status: "idle" },
  { role: "ux-designer", name: "UX Designer", shortName: "UX", icon: Palette, status: "idle" },
  { role: "architect", name: "Architect", shortName: "Arch", icon: Layers, status: "idle" },
  { role: "coder", name: "Coder Agent", shortName: "Code", icon: Code2, status: "idle" },
  { role: "critic", name: "Critic Agent", shortName: "Critic", icon: ShieldAlert, status: "idle" },
  { role: "tester", name: "Tester Agent", shortName: "Test", icon: TestTube, status: "idle" },
  { role: "doc-specialist", name: "Doc Specialist", shortName: "Docs", icon: FileText, status: "idle" },
  { role: "visual-polish", name: "Visual Polish", shortName: "Polish", icon: Sparkles, status: "idle" },
  { role: "deployer", name: "Deployer", shortName: "Deploy", icon: Rocket, status: "idle" },
  { role: "orchestrator", name: "Orchestrator", shortName: "Synth", icon: Brain, status: "idle" },
];

function parseCouncilLogs(logs: TaskLog[]): AgentState[] {
  const states = AGENT_DEFINITIONS.map((d) => ({ ...d }));
  for (const log of logs) {
    if (!log.details) continue;
    const detail = typeof log.details === "object" ? log.details : {};
    const agentRole = (detail as any).agentRole as AgentRole | undefined;
    const agentStatus = (detail as any).agentStatus as AgentStatus | undefined;
    const agentOutput = (detail as any).agentOutput as string | undefined;
    if (agentRole) {
      const agent = states.find((a) => a.role === agentRole);
      if (agent) {
        if (agentStatus) agent.status = agentStatus;
        if (agentOutput) agent.output = agentOutput;
      }
    }
  }
  return states;
}

function AgentAvatar({ agent, index }: { agent: AgentState; index: number }) {
  const Icon = agent.icon;
  const isActive = agent.status === "thinking";
  const isDone = agent.status === "done";
  const isError = agent.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 20 }}
      className="flex flex-col items-center gap-1 group relative"
      title={`${agent.name}: ${agent.status}`}
    >
      <div
        className={`
          relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300
          ${isActive
            ? "bg-[rgba(245,245,247,0.12)] border border-[rgba(245,245,247,0.4)] animate-pulse-beige"
            : isDone
              ? "bg-[var(--success-soft)] border border-[var(--success)]"
              : isError
                ? "bg-[var(--destructive-soft)] border border-[var(--destructive)]"
                : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
          }
        `}
      >
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-lg border border-[rgba(245,245,247,0.5)]"
            animate={{ opacity: [0.35, 0.85, 0.35], scale: [1, 1.12, 1] }}
            transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
          />
        )}
        <Icon
          size={14}
          className={`relative z-10 transition-colors duration-200 ${
            isActive
              ? "text-[#F5F5F7]"
              : isDone
                ? "text-[var(--success)]"
                : isError
                  ? "text-[var(--destructive)]"
                  : "text-[var(--fg-muted)]"
          }`}
        />
      </div>
      <span
        className={`text-[9px] tracking-wide font-medium transition-colors duration-200 ${
          isActive
            ? "text-[#F5F5F7]"
            : isDone
              ? "text-[var(--fg-secondary)]"
              : "text-[var(--fg-muted)]"
        }`}
      >
        {agent.shortName}
      </span>
    </motion.div>
  );
}

interface AgentCouncilPanelProps {
  logs: TaskLog[];
  isActive: boolean;
}

export function AgentCouncilPanel({ logs, isActive }: AgentCouncilPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const agents = parseCouncilLogs(logs);
  const activeAgents = agents.filter((a) => a.status !== "idle");
  const hasCouncilActivity = activeAgents.length > 0;

  if (!isActive && !hasCouncilActivity) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Agent avatar strip */}
      <div className="px-3 py-2.5 flex items-center gap-1">
        <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
          {agents.map((agent, i) => (
            <AgentAvatar key={agent.role} agent={agent} index={i} />
          ))}
        </div>
        {hasCouncilActivity && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-2 p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition-colors shrink-0"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Expanded: debate transcript */}
      <AnimatePresence>
        {expanded && hasCouncilActivity && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border-subtle)] px-3 py-2 max-h-[200px] overflow-y-auto space-y-2">
              {activeAgents.map((agent) => (
                <div key={agent.role} className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                      agent.status === "done"
                        ? "bg-[var(--success-soft)]"
                        : agent.status === "thinking"
                          ? "bg-[rgba(245,245,247,0.12)]"
                          : "bg-[var(--destructive-soft)]"
                    }`}
                  >
                    <agent.icon
                      size={10}
                      className={
                        agent.status === "done"
                          ? "text-[var(--success)]"
                          : agent.status === "thinking"
                            ? "text-[#F5F5F7]"
                            : "text-[var(--destructive)]"
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-[var(--fg-secondary)]">
                      {agent.name}
                      <span className="ml-1.5 font-normal text-[var(--fg-muted)]">
                        {agent.status === "thinking" ? "analyzing..." : agent.status}
                      </span>
                    </p>
                    {agent.output && (
                      <p className="text-[10px] text-[var(--fg-tertiary)] mt-0.5 line-clamp-2">
                        {agent.output}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Compact inline version — shows just the active agent indicator in the progress bar.
 */
export function AgentStatusInline({ logs }: { logs: TaskLog[] }) {
  const agents = parseCouncilLogs(logs);
  const thinking = agents.filter((a) => a.status === "thinking");
  const done = agents.filter((a) => a.status === "done");

  if (thinking.length === 0 && done.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {thinking.length > 0 && (
        <span className="flex items-center gap-1 text-[#F5F5F7]">
          <motion.span
            className="inline-block w-1.5 h-1.5 rounded-full bg-[#F5F5F7]"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          {thinking.map((a) => a.shortName).join(", ")}
        </span>
      )}
      {done.length > 0 && (
        <span className="text-[var(--fg-muted)]">
          {done.length}/{agents.length} done
        </span>
      )}
    </div>
  );
}
