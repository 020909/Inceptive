'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Globe, FileText, Clock, History, Loader2, X, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

interface Report {
  id: string;
  topic: string;
  content: string;
  sources_count: number;
  created_at: string;
}

interface ResearchSession {
  id: string;
  status: string;
  provider_used?: string | null;
  created_at: string;
}

/** Plain preview for PDF and collapsed cards (no rich layout). */
function cleanReportContent(content: string): string {
  return content
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\*\s+/gm, "• ")
    .replace(/^-\s+/gm, "• ")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInlineSegments(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--fg-primary)]">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (/^https?:\/\//.test(p)) {
      return (
        <a
          key={i}
          href={p}
          className="text-blue-400 hover:underline break-all"
          target="_blank"
          rel="noopener noreferrer"
        >
          {p}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function ReportBody({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-0">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) {
          return (
            <p
            key={i}
              className="font-semibold text-[15px] leading-snug text-[var(--fg-primary)] mt-5 first:mt-0 mb-2 tracking-[-0.02em]"
            >
              {trimmed}
            </p>
          );
        }
        return (
          <p key={i} className="text-[15px] leading-relaxed text-[var(--fg-secondary)] mb-2">
            {renderInlineSegments(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function downloadReportAsPdf(report: Report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(report.topic, margin, y);
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated ${new Date(report.created_at).toLocaleString()}`, margin, y);
  y += 18;
  const lines = doc.splitTextToSize(cleanReportContent(report.content), 515);
  doc.setFontSize(11);
  doc.text(lines, margin, y);
  doc.save(`${report.topic.replace(/[^\w\d-]+/g, '_').slice(0, 60)}.pdf`);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ReportCard({ report, index, onOpen }: { report: Report; index: number; onOpen: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="group rounded-2xl bg-[var(--bg-surface)] card-elevated card-hover overflow-hidden cursor-pointer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="w-full p-5 text-left">
        <div className="flex items-start justify-between mb-2">
          <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
            <BookOpen size={16} className="text-[var(--fg-tertiary)]" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadReportAsPdf(report);
              }}
              className="h-7 w-7 rounded-md border border-[var(--border-subtle)] flex items-center justify-center text-[var(--fg-tertiary)] hover:bg-[var(--bg-elevated)]"
              title="Download PDF"
            >
              <Download size={13} />
            </button>
      <button
        type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="h-7 w-7 rounded-md border border-[var(--border-subtle)] flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]"
              title={expanded ? "Collapse preview" : "Expand preview"}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
          </div>
        </div>
        <h3 className="text-[var(--fg-primary)] font-medium text-sm tracking-[-0.01em] mb-1.5">{report.topic}</h3>
        <div className="flex items-center gap-3 text-[11px] text-[var(--fg-muted)]">
          <span className="flex items-center gap-1"><Globe size={11} />{report.sources_count} sources</span>
          <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(report.created_at)}</span>
        </div>
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
            <div className="px-5 pb-5 border-t border-[var(--border-subtle)] pt-4">
              <div className="max-w-none text-[13px] leading-relaxed">
                <ReportBody content={report.content} />
              </div>
                </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ResearchPage() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [depth, setDepth] = useState<'Fast' | 'Deep Research' | 'Ultra'>('Deep Research');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const fetchReports = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/agent/research", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setSessions(data.sessions || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [session?.access_token]);

  const handleSearch = async () => {
    const topic = query.trim();
    if (!topic || !session?.access_token) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ topic, depth }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Research failed");
        return;
      }
      toast.success("Research complete!");
      setQuery('');
      if (data.report) {
        setReports((prev) => [data.report, ...prev]);
        setSelectedReport(data.report);
      }
      if (data.session_id) {
        setSessions((prev) => [
          { id: data.session_id, status: "completed", provider_used: "unknown", created_at: new Date().toISOString() },
          ...prev,
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || "Research failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="page-frame max-w-6xl">
        <div className="mb-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-[0_18px_36px_rgba(0,0,0,0.18)] animate-fade-in-up">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)] mb-3">
            <Search size={12} />
            Deep Research Engine
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] mb-2">
            Intelligence on demand.
          </h1>
          <p className="text-[var(--fg-muted)] text-sm max-w-xl">
            Inceptive researches any topic end-to-end — competitor moves, market sizing, industry trends — and returns a structured report you can share, save, or act on.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Market sizing analysis", "Competitor deep dive", "Industry trend report", "Technology landscape", "Investment thesis research"].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--fg-secondary)] transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)] hover:text-[var(--fg-primary)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

      {/* Search */}
        <motion.div className="max-w-2xl mx-auto mb-12" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="relative mb-3">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Research any topic..."
              disabled={generating}
              className="command-surface w-full pl-12 pr-28 py-4 rounded-2xl text-[var(--fg-primary)] text-base placeholder:text-[var(--fg-muted)] focus:outline-none disabled:opacity-50"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {generating ? (
                <Loader2 size={16} className="animate-spin text-[var(--fg-tertiary)]" />
              ) : (
                <button
                  onClick={handleSearch}
                  disabled={!query.trim()}
                  className="btn-accent-glow px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-30 transition-opacity"
                >
                  Research
                </button>
              )}
            </div>
          </div>

          {/* Depth selector + quick topics */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['Fast', 'Deep', 'Ultra'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDepth((d === 'Deep' ? 'Deep Research' : d) as 'Fast' | 'Deep Research' | 'Ultra')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    (depth === 'Deep Research' ? 'Deep' : depth) === d
                      ? 'bg-[var(--fg-primary)] text-[var(--bg-base)]'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {['Market Analysis', 'Competitor Research', 'Tech Trends'].map((topic) => (
                <button
                  key={topic}
                  onClick={() => setQuery(topic)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-muted)] text-[11px] hover:text-[var(--fg-secondary)] transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

      {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Reports', value: String(reports.length), icon: FileText },
            { label: 'Total Sources', value: String(reports.reduce((sum, r) => sum + (r.sources_count || 0), 0)), icon: Globe },
            { label: 'Runs', value: String(sessions.length), icon: History },
            { label: 'Last Engine', value: sessions[0]?.provider_used || '—', icon: Search },
            { label: 'Latest', value: reports.length > 0 ? timeAgo(reports[0].created_at) : '—', icon: Clock },
          ].map((s) => (
            <div key={s.label} className="page-kpi flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                <s.icon size={15} className="text-[var(--fg-tertiary)]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--fg-primary)] tracking-[-0.02em]">{s.value}</p>
                <p className="text-[var(--fg-muted)] text-[11px]">{s.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

      {/* Reports */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--fg-secondary)] flex items-center gap-2">
            <History size={15} className="text-[var(--fg-tertiary)]" />Research Reports
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl shimmer" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-[var(--bg-surface)] card-elevated">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
              <Search size={20} className="text-[var(--fg-tertiary)]" />
            </div>
            <p className="text-sm text-[var(--fg-primary)] font-medium mb-1">No research yet</p>
            <p className="text-xs text-[var(--fg-muted)]">Enter a topic above to generate your first AI research report.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {reports.map((r, i) => (
              <ReportCard key={r.id} report={r} index={i} onOpen={() => setSelectedReport(r)} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedReport && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
              onClick={() => setSelectedReport(null)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl rounded-2xl bg-[var(--bg-surface)] card-elevated max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
              >
                <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
                  <div className="min-w-0 pr-4">
                    <h3 className="text-xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em] leading-tight">
                      {selectedReport.topic}
                    </h3>
                    <p className="text-xs text-[var(--fg-muted)] mt-2">
                      {new Date(selectedReport.created_at).toLocaleString()} · {selectedReport.sources_count} sources
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadReportAsPdf(selectedReport)}
                      className="h-8 px-3 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] text-xs font-medium flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      Download PDF
                    </button>
                    <button onClick={() => setSelectedReport(null)} className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--fg-tertiary)]">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                  <ReportBody content={selectedReport.content} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
