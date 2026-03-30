"use client";
import React from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { TaskLog } from "@/lib/chat-context";
import { motion, AnimatePresence } from "framer-motion";

export function ProgressIndicator({ logs }: { logs: TaskLog[] }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-2 w-full">
      <AnimatePresence>
        {logs.map((log) => {
          let Icon = Loader2;
          let colorClass = "text-[var(--fg-tertiary)]";
          let spin = false;

          if (log.status === "running") {
            Icon = Loader2;
            colorClass = "text-[var(--fg-secondary)]";
            spin = true;
          } else if (log.status === "done") {
            Icon = CheckCircle2;
            colorClass = "text-emerald-500";
          } else if (log.status === "error") {
            Icon = AlertCircle;
            colorClass = "text-red-500";
          }

          return (
            <motion.div
              layout
              key={log.id}
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm shadow-sm overflow-hidden"
            >
              <div className={`p-1.5 rounded-lg bg-[var(--bg-elevated)] shrink-0 ${colorClass}`}>
                <Icon size={16} className={spin ? "animate-spin" : ""} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[var(--fg-primary)] font-medium truncate block">
                  {log.action || "Working..."}
                </span>
              </div>
              {log.icon && (
                <span className="text-lg opacity-70 shrink-0 pl-2 border-l border-[var(--border-subtle)]">
                  {log.icon}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
