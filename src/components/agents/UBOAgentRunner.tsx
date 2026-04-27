"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Brain,
  Shield,
  Database,
  Terminal,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentLog {
  timestamp: string;
  phase: number;
  message: string;
  level: "info" | "warning" | "error";
}

interface UBOAgentRunnerProps {
  caseId: string;
  orgId: string;
  documentIds: string[];
  onComplete?: (agentRunId: string) => void;
}

type AgentStatus = "idle" | "running" | "completed" | "failed";

interface Phase {
  number: number;
  name: string;
  icon: React.ElementType;
  description: string;
}

const PHASES: Phase[] = [
  {
    number: 1,
    name: "Document Ingestion",
    icon: FileText,
    description: "Loading and parsing uploaded documents",
  },
  {
    number: 2,
    name: "LLM Extraction",
    icon: Brain,
    description: "Using Claude to extract beneficial ownership",
  },
  {
    number: 3,
    name: "Sanctions Screening",
    icon: Shield,
    description: "Checking extracted names against sanctions lists",
  },
  {
    number: 4,
    name: "Compilation & Storage",
    icon: Database,
    description: "Building ownership tree and storing results",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function UBOAgentRunner({
  caseId,
  orgId,
  documentIds,
  onComplete,
}: UBOAgentRunnerProps) {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ─── Start Agent ───────────────────────────────────────────────────────────

  const startAgent = async () => {
    if (documentIds.length === 0) {
      setError("No documents selected");
      return;
    }

    setStatus("running");
    setError(null);
    setLogs([]);
    setCurrentPhase(1);

    try {
      const response = await fetch("/api/agents/ubo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          org_id: orgId,
          document_ids: documentIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start agent");
      }

      setAgentRunId(data.agent_run_id);
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  // ─── Poll for Status ───────────────────────────────────────────────────────

  const pollStatus = useCallback(async () => {
    if (!agentRunId) return;

    try {
      const response = await fetch(`/api/agents/ubo?agent_run_id=${agentRunId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch status");
      }

      const run = data.agent_run;
      setStatus(run.status);
      setCurrentPhase(run.current_phase || 0);
      setLogs(run.logs || []);

      if (run.status === "completed") {
        onComplete?.(agentRunId);
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, [agentRunId, onComplete]);

  // ─── Polling Effect ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!agentRunId || status === "completed" || status === "failed") {
      return;
    }

    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [agentRunId, status, pollStatus]);

  // ─── Get Log Icon ──────────────────────────────────────────────────────────

  const getLogIcon = (level: AgentLog["level"]) => {
    switch (level) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
  };

  // ─── Format Timestamp ────────────────────────────────────────────────────

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="p-6 bg-[var(--bg-elevated)] border-[var(--border-subtle)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--fg-primary)]">
            UBO Unwrapper Agent
          </h3>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            4-phase AI extraction of beneficial ownership
          </p>
        </div>
        <div>
          {status === "idle" && (
            <Button
              onClick={startAgent}
              disabled={documentIds.length === 0}
              className="bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
            >
              <Play className="w-4 h-4 mr-2" />
              Run Agent
            </Button>
          )}
{status === "running" && (
              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Running
              </Badge>
            )}
            {status === "completed" && (
              <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Completed
              </Badge>
            )}
            {status === "failed" && (
              <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                Failed
              </Badge>
            )}
        </div>
      </div>

      {/* Phase Progress */}
      <div className="mb-6">
        <div className="flex justify-between mb-4">
          {PHASES.map((phase) => (
            <div
              key={phase.number}
              className={cn(
                "flex flex-col items-center flex-1 relative",
                phase.number < currentPhase && "opacity-100",
                phase.number === currentPhase && "opacity-100",
                phase.number > currentPhase && "opacity-40"
              )}
            >
              {/* Connector Line */}
              {phase.number < PHASES.length && (
                <div
                  className={cn(
                    "absolute top-4 left-[50%] w-full h-[2px]",
                    phase.number < currentPhase
                      ? "bg-green-500"
                      : "bg-[var(--border-default)]"
                  )}
                />
              )}

              {/* Phase Icon */}
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                  phase.number < currentPhase &&
                    "bg-green-500 border-green-500",
                  phase.number === currentPhase && status === "running" &&
                    "bg-blue-500 border-blue-500 animate-pulse",
                  phase.number === currentPhase && status !== "running" &&
                    "bg-[var(--accent)] border-[var(--accent)]",
                  phase.number > currentPhase &&
                    "bg-[var(--bg-elevated)] border-[var(--border-default)]"
                )}
              >
                <phase.icon
                  className={cn(
                    "w-5 h-5",
                    phase.number <= currentPhase
                      ? "text-white"
                      : "text-[var(--fg-muted)]"
                  )}
                />
              </div>

              {/* Phase Info */}
              <div className="mt-3 text-center">
                <p className="text-xs font-medium text-[var(--fg-primary)]">
                  Phase {phase.number}
                </p>
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                  {phase.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-[var(--fg-muted)]" />
            <span className="text-sm font-medium text-[var(--fg-primary)]">
              Agent Logs
            </span>
          </div>
          <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-subtle)] p-4 max-h-[200px] overflow-y-auto font-mono text-xs">
            {logs.map((log, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-2 py-1",
                  log.level === "error" && "text-red-400",
                  log.level === "warning" && "text-yellow-400",
                  log.level === "info" && "text-[var(--fg-muted)]"
                )}
              >
                <span className="text-[var(--fg-muted)] shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className="shrink-0">{getLogIcon(log.level)}</span>
                <span>{log.message}</span>
              </div>
            ))}
            {status === "running" && (
              <div className="flex items-center gap-2 py-1 text-[var(--fg-muted)]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export default UBOAgentRunner;
