"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Loader2, AlertCircle, Clock, ChevronRight,
  FileText, Globe, Mail, Code, Database
} from "lucide-react";
import { Task } from "@/lib/agent-context";
import { cn } from "@/lib/utils";

interface TaskVisualizationProps {
  tasks: Task[];
}

const toolIcons: Record<string, React.ReactNode> = {
  search: <Globe className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  code: <Code className="w-3.5 h-3.5" />,
  file: <FileText className="w-3.5 h-3.5" />,
  database: <Database className="w-3.5 h-3.5" />,
  default: <ChevronRight className="w-3.5 h-3.5" />,
};

function TaskStep({ task, index }: { task: Task; index: number }) {
  const getStatusIcon = () => {
    switch (task.status) {
      case "completed":
        return <Check className="w-3.5 h-3.5 text-[var(--success)]" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-[var(--destructive)]" />;
      case "running":
        return <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />;
      case "paused":
        return <Clock className="w-3.5 h-3.5 text-[var(--warning)]" />;
      default:
        return <span className="w-3.5 h-3.5 rounded-full border border-[var(--border-strong)]" />;
    }
  };

  const getStatusClass = () => {
    switch (task.status) {
      case "completed":
        return "border-l-2 border-l-[var(--success)]";
      case "failed":
        return "border-l-2 border-l-[var(--destructive)]";
      case "running":
        return "border-l-2 border-l-[var(--accent)] bg-[var(--accent-subtle)]";
      case "paused":
        return "border-l-2 border-l-[var(--warning)]";
      default:
        return "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "p-3 rounded-lg transition-all hover:bg-[var(--background-overlay)]",
        getStatusClass()
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getStatusIcon()}</div>
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "text-sm font-medium truncate",
            task.status === "completed" && "text-[var(--foreground-secondary)] line-through",
            task.status === "failed" && "text-[var(--destructive)]",
            task.status === "running" && "text-[var(--foreground)]"
          )}>
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-[var(--foreground-tertiary)] mt-0.5 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Progress Bar for running tasks */}
          {task.status === "running" && task.progress !== undefined && (
            <div className="mt-2">
              <div className="h-1 bg-[var(--background)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${task.progress}%` }}
                  className="h-full bg-[var(--accent)] rounded-full"
                />
              </div>
              <span className="text-[10px] text-[var(--foreground-muted)] mt-1">
                {task.progress}%
              </span>
            </div>
          )}

          {/* Output Preview */}
          {task.output && task.status === "completed" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2 p-2 bg-[var(--background)] rounded border border-[var(--border)] text-[11px] text-[var(--foreground-secondary)] font-mono line-clamp-3"
            >
              {task.output}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function TaskVisualization({ tasks }: TaskVisualizationProps) {
  const runningTasks = tasks.filter(t => t.status === "running");
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const failedTasks = tasks.filter(t => t.status === "failed");

  return (
    <div className="h-full flex flex-col">
      {/* Task Summary */}
      {tasks.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {runningTasks.length > 0 && (
                <span className="text-[var(--accent)]">
                  {runningTasks.length} running
                </span>
              )}
              {pendingTasks.length > 0 && (
                <span className="text-[var(--foreground-tertiary)]">
                  {pendingTasks.length} pending
                </span>
              )}
              {completedTasks.length > 0 && (
                <span className="text-[var(--success)]">
                  {completedTasks.length} done
                </span>
              )}
              {failedTasks.length > 0 && (
                <span className="text-[var(--destructive)]">
                  {failedTasks.length} failed
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center mb-3">
              <Check className="w-4 h-4 text-[var(--foreground-muted)]" />
            </div>
            <p className="text-xs text-[var(--foreground-tertiary)]">
              No active tasks
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              Start a conversation to create tasks
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {tasks.map((task, index) => (
                <TaskStep key={task.id} task={task} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
