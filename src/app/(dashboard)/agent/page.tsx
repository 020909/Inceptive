'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Play, Pause, Clock, Plus, RefreshCw, MoreHorizontal, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AgentJob {
  id: string;
  kind: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload: Record<string, any> | null;
  result: any;
  logs: string[] | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

const JOB_PRESETS = [
  { kind: "browser.probe", label: "Browser Probe", description: "Test browser connectivity" },
  { kind: "connector.health", label: "Connector Health", description: "Check all connector status" },
  { kind: "inbox.monitor.stub", label: "Inbox Monitor", description: "Scan email inbox" },
  { kind: "computer.use.stub", label: "Computer Use", description: "Run screen automation" },
];

const STATUS_CONFIG = {
  pending:   { icon: Clock,         color: "text-[var(--fg-tertiary)]", bg: "bg-[var(--bg-elevated)]", label: "Pending" },
  running:   { icon: Play,          color: "text-[var(--accent)]",      bg: "bg-[var(--accent-muted)]", label: "Running" },
  completed: { icon: CheckCircle2,  color: "text-[var(--success)]",     bg: "bg-[var(--success-soft)]", label: "Done" },
  failed:    { icon: XCircle,       color: "text-[var(--destructive)]", bg: "bg-[var(--destructive-soft)]", label: "Failed" },
};

function StatusBadge({ status }: { status: AgentJob['status'] }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${c.bg}`}>
      <Icon size={11} className={c.color} />
      <span className={`text-[11px] font-medium ${c.color}`}>{c.label}</span>
    </div>
  );
}

function JobCard({ job, index }: { job: AgentJob; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors duration-150 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
            <Bot size={16} className="text-[var(--fg-tertiary)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[var(--fg-primary)] font-medium text-sm tracking-[-0.01em]">{job.kind}</p>
            <p className="text-[var(--fg-muted)] text-[11px]">
              {new Date(job.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] space-y-2">
              {job.logs && job.logs.length > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--fg-muted)] uppercase tracking-wider mb-1">Logs</p>
                  <div className="space-y-0.5">
                    {job.logs.slice(-5).map((log, i) => (
                      <p key={i} className="text-[11px] text-[var(--fg-tertiary)] font-mono">{log}</p>
                    ))}
                  </div>
                </div>
              )}
              {job.result && (
                <div>
                  <p className="text-[10px] text-[var(--fg-muted)] uppercase tracking-wider mb-1">Result</p>
                  <p className="text-[11px] text-[var(--fg-secondary)] font-mono break-all">
                    {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2).slice(0, 200)}
                  </p>
                </div>
              )}
              <p className="text-[10px] text-[var(--fg-muted)]">Attempts: {job.attempts}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AgentPage() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [enqueuing, setEnqueuing] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/jobs");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      /* silently fail — shows empty state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const enqueue = async (kind: string) => {
    setEnqueuing(kind);
    try {
      const res = await fetch("/api/agent/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success("Job queued");
      fetchJobs();
    } catch (e: any) {
      toast.error(e.message || "Failed to queue job");
    } finally {
      setEnqueuing(null);
    }
  };

  const counts = {
    total: jobs.length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">AI Agents</h1>
          <p className="text-[var(--fg-tertiary)] text-sm mt-0.5">Autonomous task execution and monitoring</p>
        </div>
        <button
          onClick={fetchJobs}
          className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] hover:border-[var(--border-default)] transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-3 mb-8"
      >
        {[
          { label: "Total", value: counts.total },
          { label: "Running", value: counts.running },
          { label: "Completed", value: counts.completed },
          { label: "Failed", value: counts.failed },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <p className="text-[11px] text-[var(--fg-tertiary)] uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-xl font-semibold text-[var(--fg-primary)] tracking-[-0.02em]">{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Quick launch */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider mb-3">Quick launch</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {JOB_PRESETS.map(p => (
            <button
              key={p.kind}
              onClick={() => enqueue(p.kind)}
              disabled={!!enqueuing}
              className="group p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] text-left transition-colors disabled:opacity-50"
            >
              <p className="text-[var(--fg-primary)] text-sm font-medium mb-0.5">{p.label}</p>
              <p className="text-[var(--fg-muted)] text-[11px]">{p.description}</p>
              {enqueuing === p.kind && <Loader2 size={12} className="animate-spin text-[var(--fg-tertiary)] mt-1" />}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Job list */}
      <div>
        <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider mb-3">Recent jobs</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-[var(--fg-muted)]" size={20} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <Bot size={32} className="text-[var(--fg-muted)] mx-auto mb-3" />
            <p className="text-[var(--fg-tertiary)] text-sm">No agent jobs yet</p>
            <p className="text-[var(--fg-muted)] text-xs mt-1">Use Quick Launch above to start a task</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job, i) => (
              <JobCard key={job.id} job={job} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
