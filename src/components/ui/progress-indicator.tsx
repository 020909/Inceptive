"use client";

import React from "react";
import type { TaskLog } from "@/lib/chat-context";
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
} from "lucide-react";

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

function AgentDot({ role, status }: { role: string; status: string }) {
  const Icon = AGENT_ICONS[role];
  if (!Icon) return null;
  const isThinking = status === "thinking";
  const isDone = status === "done";

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`w-5 h-5 rounded flex items-center justify-center ${
        isThinking
          ? "bg-[var(--accent-soft)]"
          : isDone
            ? "bg-[var(--success-soft)]"
            : "bg-[var(--destructive-soft)]"
      }`}
    >
      <Icon
        size={10}
        className={
          isThinking
            ? "text-[var(--accent)]"
            : isDone
              ? "text-[var(--success)]"
              : "text-[var(--destructive)]"
        }
      />
    </motion.div>
  );
}

export function ProgressIndicator({ logs }: { logs: TaskLog[] }) {
  if (!logs || logs.length === 0) return null;

  // Check if this is a council session
  const councilLogs = logs.filter(
    (l) => l.details && typeof l.details === "object" && (l.details as any).agentRole
  );
  const isCouncilActive = councilLogs.length > 0;

  // Deduplicate: keep latest status per agent
  const agentStates = new Map<string, { role: string; name: string; status: string }>();
  for (const log of councilLogs) {
    const d = log.details as any;
    agentStates.set(d.agentRole, {
      role: d.agentRole,
      name: d.agentName || d.agentRole,
      status: d.agentStatus || log.status,
    });
  }

  const nonCouncilLogs = logs.filter(
    (l) => !l.details || typeof l.details !== "object" || !(l.details as any).agentRole
  );

  return (
    <div className="mb-2 flex flex-col gap-1.5 w-full">
      {/* Council agent strip */}
      {isCouncilActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-center gap-1 flex-wrap mb-1"
        >
          {Array.from(agentStates.values()).map((agent) => (
            <motion.div
              key={agent.role}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1 pr-2"
            >
              <AgentDot role={agent.role} status={agent.status} />
              <span
                className={`text-[10px] font-medium ${
                  agent.status === "thinking"
                    ? "text-[var(--accent)]"
                    : agent.status === "done"
                      ? "text-[var(--fg-muted)]"
                      : "text-[var(--destructive)]"
                }`}
              >
                {agent.name.replace(" Agent", "")}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Standard task logs */}
      <AnimatePresence>
        {nonCouncilLogs.map((log) => (
          <motion.div
            layout
            key={log.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 py-1 text-[13px] text-[#9a9aaa]"
          >
            {log.status === "running" && (
              <motion.span
                className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
            <span>{log.action || "Working..."}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
