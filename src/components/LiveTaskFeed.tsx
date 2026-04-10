"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, ChevronDown, ChevronRight, Undo2, Loader2,
  CheckCircle2, AlertCircle, XCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Types ─── */
export interface TaskLog {
  id: string;
  action: string;
  status: "running" | "done" | "error" | "undone";
  icon: string;
  agent_mode?: string;
  details?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

/* ─── Helpers ─── */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

const STATUS_CONFIG = {
  running: {
    pill: "Running",
    bg: "var(--accent-muted)",
    border: "var(--border-default)",
    text: "var(--fg-primary)",
    Icon: Loader2,
    animate: true,
  },
  done: {
    pill: "Done",
    bg: "var(--bg-overlay)",
    border: "var(--border-default)",
    text: "var(--fg-primary)",
    Icon: CheckCircle2,
    animate: false,
  },
  error: {
    pill: "Failed",
    bg: "rgba(255,59,48,0.12)",
    border: "rgba(255,59,48,0.25)",
    text: "#FF3B30",
    Icon: AlertCircle,
    animate: false,
  },
  undone: {
    pill: "Undone",
    bg: "var(--bg-surface)",
    border: "var(--border-subtle)",
    text: "var(--fg-muted)",
    Icon: XCircle,
    animate: false,
  },
};

const UNDOABLE_ACTIONS = ["draftEmail", "scheduleSocialPost", "saveResearchReport", "sendGmail"];

/* ─── Single task card ─── */
function TaskCard({
  log,
  onUndo,
}: {
  log: TaskLog;
  onUndo: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localStatus, setLocalStatus] = useState(log.status);

  // Sync with upstream log status
  useEffect(() => {
    setLocalStatus(log.status);
  }, [log.status, log.updated_at]);

  // 800ms fallback to mark as done if no update
  useEffect(() => {
    if (localStatus === "running") {
      const timer = setTimeout(() => {
        setLocalStatus("done");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [localStatus]);

  const config = STATUS_CONFIG[localStatus] || STATUS_CONFIG.done;
  const StatusIcon = config.Icon;
  const hasDetails = log.details && Object.keys(log.details).length > 0;
  const toolName = (log.details as any)?.toolName;
  const canUndo = localStatus === "done" && toolName && UNDOABLE_ACTIONS.includes(toolName);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-xl border transition-colors duration-150 overflow-hidden"
      style={{
        background: "var(--background-elevated)",
        borderColor: localStatus === "running" ? "rgba(10,132,255,0.2)" : "var(--border-subtle)",
      }}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-[var(--fg-primary)] leading-snug">
            {log.action}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {/* Status pill */}
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
              style={{ background: config.bg, color: config.text, border: `1px solid ${config.border}` }}
            >
              <StatusIcon className={`w-2.5 h-2.5 ${config.animate ? "animate-spin" : ""}`} />
              {config.pill}
            </span>
            {/* Time */}
            <span className="text-[9px] text-[var(--foreground-tertiary)] font-medium">
              {relativeTime(log.created_at)}
            </span>
            {/* Agent mode */}
            {log.agent_mode && (
              <span className="text-[9px] text-[var(--foreground-secondary)] bg-[var(--background-overlay)] px-1.5 py-0.5 rounded font-medium">
                {log.agent_mode}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {canUndo && (
            <button
              onClick={(e) => { e.stopPropagation(); onUndo(log.id); }}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-[var(--bg-overlay)]"
              title="Undo this action"
            >
              <Undo2 className="w-3 h-3 text-[var(--foreground-secondary)]" />
            </button>
          )}
          {hasDetails && (
            <div className="w-4 h-4 flex items-center justify-center text-[var(--foreground-tertiary)]">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>
          )}
        </div>
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-2.5 pt-0 border-t"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <pre className="text-[10px] text-[var(--foreground-secondary)] leading-relaxed mt-2 whitespace-pre-wrap break-all font-mono">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Main Component ─── */
export default function LiveTaskFeed({ className = "" }: { className?: string }) {
  const { session } = useAuth();
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const prevCountRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/task-logs", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const newLogs = data.logs || [];
      setLogs(newLogs);
      // Flash notification when new logs appear
      if (prevCountRef.current > 0 && newLogs.length > prevCountRef.current) {
        const newest = newLogs[0];
        if (newest?.status === "done") {
          // No toast for individual items — the feed IS the notification
        }
      }
      prevCountRef.current = newLogs.length;
    } catch {
      // silent fail on poll
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  // Initial fetch + polling every 3s
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleUndo = async (id: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/task-logs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status: "undone" }),
      });
      if (res.ok) {
        setLogs((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: "undone" as const } : l))
        );
        toast.success("Action undone");
      }
    } catch {
      toast.error("Failed to undo");
    }
  };

  const runningCount = logs.filter((l) => l.status === "running").length;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-secondary)] font-semibold">
            Live Activity
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {runningCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: "rgba(10,132,255,0.2)", color: "#FFFFFF" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] animate-pulse" />
              {runningCount} active
            </motion.div>
          )}
          <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] pulse-dot" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl shimmer" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8 rounded-xl border"
          style={{
            background: "var(--background-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <p className="text-[11px] text-[var(--foreground-secondary)] font-medium">
            No activity yet
          </p>
          <p className="text-[9px] text-[var(--foreground-tertiary)] mt-0.5">
            Start an agent to see live updates
          </p>
        </motion.div>
      ) : (
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-0.5 scrollbar-thin">
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <TaskCard key={log.id} log={log} onUndo={handleUndo} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
