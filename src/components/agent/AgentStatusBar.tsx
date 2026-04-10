"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Pause, Play, Moon, Sun, Clock, Activity,
  AlertCircle, CheckCircle2, Zap
} from "lucide-react";
import { AgentStatus } from "@/lib/agent-context";
import { cn } from "@/lib/utils";

interface AgentStatusBarProps {
  status: AgentStatus;
  onPause: () => void;
  onResume: () => void;
  taskCount: number;
}

export function AgentStatusBar({ status, onPause, onResume, taskCount }: AgentStatusBarProps) {
  const statusConfig = {
    active: {
      icon: Sun,
      label: "Active",
      color: "text-[var(--success)]",
      bg: "bg-[var(--success)]/10",
      border: "border-[var(--success)]/20",
      animate: true,
    },
    sleeping: {
      icon: Moon,
      label: "Sleeping",
      color: "text-[var(--foreground-tertiary)]",
      bg: "bg-[var(--foreground-muted)]/10",
      border: "border-[var(--foreground-muted)]/20",
      animate: false,
    },
    paused: {
      icon: Pause,
      label: "Paused",
      color: "text-[var(--warning)]",
      bg: "bg-[var(--warning)]/10",
      border: "border-[var(--warning)]/20",
      animate: false,
    },
    working: {
      icon: Zap,
      label: "Working",
      color: "text-[var(--accent)]",
      bg: "bg-[var(--accent)]/10",
      border: "border-[var(--accent)]/20",
      animate: true,
    },
    error: {
      icon: AlertCircle,
      label: "Error",
      color: "text-[var(--destructive)]",
      bg: "bg-[var(--destructive)]/10",
      border: "border-[var(--destructive)]/20",
      animate: false,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="h-14 border-b border-[var(--border)] bg-[var(--background-elevated)] flex items-center justify-between px-4 shrink-0">
      {/* Left: Status Indicator */}
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border",
          config.bg,
          config.border
        )}>
          <div className={cn(
            "relative",
            config.animate && "status-indicator"
          )}
          >
            <Icon className={cn("w-4 h-4", config.color)} />
            {config.animate && (
              <>
                <span className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-75",
                  status === "working" ? "bg-[var(--accent)]" : "bg-[var(--success)]"
                )} />
              </>
            )}
          </div>
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label}
          </span>
          {taskCount > 0 && (
            <span className="text-[10px] text-[var(--foreground-muted)]">
              • {taskCount} task{taskCount !== 1 && "s"}
            </span>
          )}
        </div>

        {/* Quick Stats */}
        <div className="hidden sm:flex items-center gap-4 text-[var(--foreground-tertiary)]">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">24/7</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-xs">Low CPU</span>
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {status === "paused" ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onResume}
            className="btn-premium flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--success)] text-[var(--bg-base)] text-xs font-medium hover:opacity-90 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Resume
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onPause}
            disabled={status === "sleeping"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] text-xs font-medium hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-30"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </motion.button>
        )}
      </div>
    </div>
  );
}
