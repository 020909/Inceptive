"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Terminal, Check, AlertCircle, Info, ArrowRight,
  Clock, Globe, FileText, Code, Mail
} from "lucide-react";
import { LogEntry } from "@/lib/agent-context";
import { cn } from "@/lib/utils";

interface ActivityLogProps {
  logs: LogEntry[];
}

const toolIcons: Record<string, React.ReactNode> = {
  web_search: <Globe className="w-3.5 h-3.5" />,
  file_read: <FileText className="w-3.5 h-3.5" />,
  file_write: <FileText className="w-3.5 h-3.5" />,
  code_execute: <Code className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
};

function LogItem({ log, index }: { log: LogEntry; index: number }) {
  const getIcon = () => {
    switch (log.level) {
      case "success":
        return <Check className="w-3.5 h-3.5 text-[var(--success)]" />;
      case "error":
        return <AlertCircle className="w-3.5 h-3.5 text-[var(--destructive)]" />;
      case "warning":
        return <Info className="w-3.5 h-3.5 text-[var(--warning)]" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-[var(--foreground-muted)]" />;
    }
  };

  const getLevelColor = () => {
    switch (log.level) {
      case "success":
        return "text-[var(--success)]";
      case "error":
        return "text-[var(--destructive)]";
      case "warning":
        return "text-[var(--warning)]";
      default:
        return "text-[var(--foreground-secondary)]";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="group flex items-start gap-3 py-2 px-4 hover:bg-[var(--background-elevated)] transition-colors"
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">{getIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs", getLevelColor())}>{log.message}</span>
        </div>
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div className="mt-1 text-[10px] text-[var(--foreground-muted)] font-mono">
            {JSON.stringify(log.metadata, null, 2).slice(0, 100)}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-[var(--foreground-muted)] tabular-nums shrink-0">
        {log.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
    </motion.div>
  );
}

export function ActivityLog({ logs }: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Log List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] flex items-center justify-center mb-3">
              <Clock className="w-4 h-4 text-[var(--foreground-muted)]" />
            </div>
            <p className="text-xs text-[var(--foreground-tertiary)]">
              Activity log is empty
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              Agent actions will appear here
            </p>
          </div>
        ) : (
          <div className="py-2">
            {logs.map((log, index) => (
              <LogItem key={log.id} log={log} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
