"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, FileText, Loader2, Link as LinkIcon, ChevronDown, Download, Zap, Layers, Rocket } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ResearchReport {
  id: string; topic: string; content: string; sources_count: number; created_at: string;
}

type Depth = "Fast" | "Deep Research" | "Ultra";

const DEPTH_OPTIONS: { value: Depth; icon: React.ReactNode; description: string }[] = [
  { value: "Fast", icon: <Zap className="w-3.5 h-3.5" />, description: "Quick overview in seconds" },
  { value: "Deep Research", icon: <Layers className="w-3.5 h-3.5" />, description: "Thorough multi-source analysis" },
  { value: "Ultra", icon: <Rocket className="w-3.5 h-3.5" />, description: "Comprehensive deep dive" },
];

function ThinkingDots() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d >= 3 ? 1 : d + 1));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex items-center gap-3 py-8 justify-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--foreground)" }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -5, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      <span className="text-sm text-[var(--foreground-secondary)]">
        Thinking{".".repeat(dots)}
      </span>
    </div>
  );
}

function DepthDropdown({ depth, onChange }: { depth: Depth; onChange: (d: Depth) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = DEPTH_OPTIONS.find(d => d.value === depth)!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-[52px] px-4 rounded-2xl border text-sm font-medium transition-all duration-150"
        style={{ background: "var(--background-elevated)", borderColor: open ? "rgba(255,255,255,0.3)" : "#38383A", color: "var(--foreground-secondary)" }}
      >
        <span className="text-[var(--foreground)]">{current.icon}</span>
        <span className="text-white whitespace-nowrap">{depth}</span>
        <ChevronDown className="w-3.5 h-3.5 ml-0.5 transition-transform duration-150" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: "#1E1E20", borderColor: "var(--border)", minWidth: "210px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
          >
            {DEPTH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100"
                style={{
                  background: depth === opt.value ? "rgba(255,255,255,0.08)" : "transparent",
                  borderLeft: depth === opt.value ? "2px solid var(--foreground)" : "2px solid transparent",
                }}
                onMouseEnter={e => { if (depth !== opt.value) (e.currentTarget as HTMLButtonElement).style.background = "#2C2C2E"; }}
                onMouseLeave={e => { if (depth !== opt.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ color: "var(--foreground)" }}>{opt.icon}</span>
                <div>
                  <div className="text-sm font-medium text-white">{opt.value}</div>
                  <div className="text-xs text-[var(--foreground-secondary)]">{opt.description}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ResearchPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState<Depth>("Deep Research");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ResearchReport | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  const fetchReports = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("research_reports").select("*").eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) { setAccessToken(session.access_token); if (user) fetchReports(); }
      else setLoading(false);
    };
    init();
  }, [user]);

  const handleRunResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !accessToken || !user) return;

    // Immediately open modal showing thinking state
    setActiveReport(null);
    setIsThinking(true);
    setModalOpen(true);
    setResearching(true);

    try {
      const res = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ topic: topic.trim(), depth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      toast.success("Research complete");
      setTopic("");
      const newReport = data.report;
      setReports(prev => [newReport, ...prev]);
      setActiveReport(newReport);
      setIsThinking(false);
    } catch (err: any) {
      toast.error(err.message);
      setModalOpen(false);
      setIsThinking(false);
    } finally {
      setResearching(false);
    }
  };

  const handleDownload = (report: ResearchReport) => {
    const content = `# ${report.topic}\n\n*Generated by Inceptive Research Engine — ${new Date(report.created_at).toLocaleString()}*\n*Sources: ${report.sources_count}*\n\n---\n\n${report.content}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.topic.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Research Engine</h1>
          <p className="text-sm text-[var(--foreground-secondary)]">Ask anything — get a structured research report powered by live web data.</p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleRunResearch} className="flex gap-3 mb-10">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[var(--border-strong)]" />
            </div>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a research topic…" disabled={researching}
              className="w-full pl-11 rounded-2xl text-sm text-white placeholder:text-[var(--border-strong)]"
              style={{ height: "52px", background: "var(--background-elevated)", border: "1px solid var(--border)" }}
            />
          </div>

          <DepthDropdown depth={depth} onChange={setDepth} />

          <Button type="submit" disabled={researching || !topic.trim() || !accessToken}
            className="px-7 rounded-2xl font-semibold text-sm border-0 transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ height: "52px", background: "var(--foreground)", color: "var(--foreground)" }}>
            {researching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Researching…</> : "Run Research"}
          </Button>
        </form>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl shimmer" />)}
          </div>
        ) : reports.length === 0 && !researching ? (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)" }}>
              <FileText className="h-6 w-6 text-[var(--foreground)]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">No research yet</h3>
            <p className="text-sm text-[var(--foreground-tertiary)] max-w-xs">Enter a topic above to get a structured report with real web sources.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {reports.map((report, i) => (
                <motion.div key={report.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  onClick={() => { setActiveReport(report); setIsThinking(false); setModalOpen(true); }}
                  className="h-48 rounded-2xl border p-5 flex flex-col justify-between cursor-pointer transition-colors duration-150"
                  style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#48484A"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#38383A"; }}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 line-clamp-1">{report.topic}</h3>
                    <p className="text-xs text-[var(--foreground-secondary)] line-clamp-4 leading-relaxed">
                      {report.content.replace(/[#*]/g, "").trim()}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)" }}>
                      <LinkIcon className="h-3 w-3 text-[var(--foreground)]" />
                      <span className="text-[10px] font-semibold text-[var(--foreground)]">{report.sources_count} sources</span>
                    </div>
                    <span className="text-[10px] text-[var(--foreground-tertiary)]">{formatTimeAgo(new Date(report.created_at))}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!researching) { setModalOpen(o); if (!o) { setActiveReport(null); setIsThinking(false); } } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 border"
          style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          {isThinking ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border"
                style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)" }}
                animate={{ boxShadow: ["0 0 20px rgba(255,255,255,0.1)", "0 0 40px rgba(255,255,255,0.25)", "0 0 20px rgba(255,255,255,0.1)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Search className="w-7 h-7 text-[var(--foreground)]" />
              </motion.div>
              <h3 className="text-lg font-semibold text-white mb-2">Researching your topic</h3>
              <p className="text-sm text-[var(--foreground-secondary)] mb-6 max-w-xs">Searching the web, analysing sources, and generating your report…</p>
              <ThinkingDots />
            </div>
          ) : activeReport ? (
            <div>
              <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-start justify-between gap-4"
                style={{ background: "rgba(28,28,30,0.92)", backdropFilter: "blur(20px)", borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white mb-1.5 leading-snug">{activeReport.topic}</h2>
                  <div className="flex items-center gap-3 text-xs text-[var(--foreground-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" />
                      {activeReport.sources_count} sources
                    </div>
                    <span>·</span>
                    <span>{new Date(activeReport.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(activeReport)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-150 shrink-0"
                  style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)", color: "var(--foreground)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
              <div className="p-8">
                <div className="prose-inceptive">
                  <ReactMarkdown>{activeReport.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
