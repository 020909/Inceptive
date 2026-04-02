'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Play, Clock, Plus, RefreshCw, Loader2, CheckCircle2, XCircle, Trash2, X } from 'lucide-react';
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

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  kind: string;
  payload: Record<string, any> | null;
  created_at: string;
}

const JOB_PRESETS = [
  { kind: "browser.probe", label: "Browser Probe", description: "Test browser connectivity" },
  { kind: "connector.health", label: "Connector Health", description: "Check all connector status" },
  { kind: "inbox.monitor.stub", label: "Inbox Monitor", description: "Scan email inbox" },
  { kind: "computer.use.stub", label: "Computer Use", description: "Run screen automation" },
];

const AGENT_KIND_OPTIONS: { kind: string; label: string; payloadLabel?: string }[] = [
  { kind: "browser.probe", label: "Browser Probe", payloadLabel: "Query (e.g. 'Dhurandar 2 box office collection')" },
  { kind: "connector.health", label: "Connector Health" },
  { kind: "inbox.monitor.stub", label: "Inbox Monitor", payloadLabel: "Optional (not used)" },
  { kind: "computer.use.stub", label: "Computer Use", payloadLabel: "Instruction (e.g. 'open https://... and summarize')" },
  { kind: "slack.ping", label: "Slack Ping", payloadLabel: "Message to post (optional)" },
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
      className="group p-4 rounded-2xl bg-[var(--bg-surface)] card-elevated cursor-pointer"
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
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [agentKind, setAgentKind] = useState(AGENT_KIND_OPTIONS[0]?.kind || "browser.probe");
  const [agentPayloadText, setAgentPayloadText] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

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

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/agent/templates");
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      /* no-op */
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const enqueue = async (kind: string, payload: Record<string, unknown> = {}) => {
    setEnqueuing(kind);
    try {
      const res = await fetch("/api/agent/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, payload }),
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
        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobs}
            className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] hover:border-[var(--border-default)] transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => {
              setAddOpen(true);
              setAgentName("");
              setAgentDescription("");
              setAgentPayloadText("");
              setAgentKind(AGENT_KIND_OPTIONS[0]?.kind || "browser.probe");
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-black border border-white hover:opacity-90 transition-colors text-xs font-semibold"
          >
            <Plus size={14} />
            Add Agent
          </button>
        </div>
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
          <div key={s.label} className="p-4 rounded-2xl bg-[var(--bg-surface)] card-elevated">
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
              className="group p-3 rounded-2xl bg-[var(--bg-surface)] card-elevated text-left disabled:opacity-50"
            >
              <p className="text-[var(--fg-primary)] text-sm font-medium mb-0.5">{p.label}</p>
              <p className="text-[var(--fg-muted)] text-[11px]">{p.description}</p>
              {enqueuing === p.kind && <Loader2 size={12} className="animate-spin text-[var(--fg-tertiary)] mt-1" />}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Custom agents */}
      <div className="mb-8">
        <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider mb-3">Custom agents</p>
        {templatesLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="animate-spin text-[var(--fg-muted)]" size={20} />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center p-6 rounded-2xl bg-[var(--bg-surface)] card-elevated">
            <p className="text-[var(--fg-tertiary)] text-sm">No custom agents yet.</p>
            <p className="text-[var(--fg-muted)] text-xs mt-1">Click &ldquo;Add Agent&rdquo; to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.slice(0, 6).map((t) => (
              <div key={t.id} className="p-4 rounded-2xl bg-[var(--bg-surface)] card-elevated">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[var(--fg-primary)] font-medium text-sm truncate">{t.name}</p>
                    <p className="text-[var(--fg-muted)] text-xs mt-1">{t.kind}</p>
                    {t.description ? (
                      <p className="text-[var(--fg-tertiary)] text-xs mt-2 line-clamp-2">{t.description}</p>
                    ) : null}
                  </div>
                  <button
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-tertiary)]"
                    aria-label="Delete template"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/agent/templates/${t.id}`, { method: "DELETE" });
                        if (!res.ok) throw new Error();
                        toast.success("Template deleted");
                        fetchTemplates();
                      } catch {
                        toast.error("Failed to delete");
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => enqueue(t.kind, (t.payload || {}) as Record<string, unknown>)}
                    disabled={!!enqueuing}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] text-xs font-semibold disabled:opacity-50"
                  >
                    Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

      {/* Add Agent modal */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] card-elevated overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[var(--fg-primary)] text-base font-semibold">Add Agent</h2>
                  <p className="text-[var(--fg-muted)] text-xs mt-1">Create a reusable autonomous job template.</p>
                </div>
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-elevated)] text-[var(--fg-tertiary)]"
                  onClick={() => setAddOpen(false)}
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>

              <form
                className="px-6 py-5 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = agentName.trim();
                  const description = agentDescription.trim();
                  if (!name) {
                    toast.error("Agent name is required");
                    return;
                  }

                  const payload: Record<string, unknown> = {};
                  const kind = agentKind;
                  if (kind === "browser.probe") {
                    const q = agentPayloadText.trim();
                    if (!q) {
                      toast.error("Query is required for Browser Probe");
                      return;
                    }
                    payload.query = q;
                  } else if (kind === "computer.use.stub" || kind === "computer.use") {
                    const instruction = agentPayloadText.trim();
                    if (!instruction) {
                      toast.error("Instruction is required for Computer Use");
                      return;
                    }
                    payload.instruction = instruction;
                  } else if (kind === "slack.ping") {
                    payload.text = agentPayloadText.trim() || "Inceptive agent ✓";
                  } else {
                    // connector.health / inbox.monitor / others currently don't need a payload
                  }

                  setSavingTemplate(true);
                  try {
                    const createRes = await fetch("/api/agent/templates", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, description, kind, payload }),
                    });
                    const createData = await createRes.json().catch(() => ({}));
                    if (!createRes.ok) throw new Error(createData.error || "Failed to save template");

                    toast.success("Template saved");

                    await enqueue(kind, payload);
                    fetchTemplates();
                    setAddOpen(false);
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to create template");
                  } finally {
                    setSavingTemplate(false);
                  }
                }}
              >
                <div>
                  <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">Name</label>
                  <input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)]"
                    placeholder="e.g. DHURANDAR Finder"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">Description</label>
                  <input
                    value={agentDescription}
                    onChange={(e) => setAgentDescription(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)]"
                    placeholder="What should this agent do?"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">Job Type</label>
                  <select
                    value={agentKind}
                    onChange={(e) => setAgentKind(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)]"
                  >
                    {AGENT_KIND_OPTIONS.map((opt) => (
                      <option key={opt.kind} value={opt.kind} className="bg-black text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">
                    {AGENT_KIND_OPTIONS.find((o) => o.kind === agentKind)?.payloadLabel || "Payload (optional)"}
                  </label>
                  <textarea
                    value={agentPayloadText}
                    onChange={(e) => setAgentPayloadText(e.target.value)}
                    rows={3}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)] resize-none"
                    placeholder={
                      agentKind === "browser.probe"
                        ? "e.g. Dhurandar 2 box office collection"
                        : agentKind === "computer.use.stub" || agentKind === "computer.use"
                          ? "e.g. Open https://example.com and summarize the top 5 headlines"
                          : agentKind === "slack.ping"
                            ? "e.g. Post a short update to Slack"
                            : "Not required for this job type"
                    }
                    disabled={
                      !(
                        agentKind === "browser.probe" ||
                        agentKind === "computer.use.stub" ||
                        agentKind === "computer.use" ||
                        agentKind === "slack.ping"
                      )
                    }
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemplate}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Save & Run
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}