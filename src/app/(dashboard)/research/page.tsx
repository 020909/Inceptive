"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, FileText, Loader2, Link as LinkIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ResearchReport {
  id: string; topic: string; content: string; sources_count: number; created_at: string;
}

export default function ResearchPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [topic, setTopic] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);

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
    setResearching(true);
    try {
      const res = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ topic: topic.trim(), user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      toast.success("Research complete");
      setTopic("");
      setReports([data.report, ...reports]);
    } catch (err: any) { toast.error(err.message); }
    finally { setResearching(false); }
  };

  return (
    <PageTransition>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Research Engine</h1>
          <p className="text-sm text-[#8E8E93]">Ask anything — get a structured research report powered by live web data.</p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleRunResearch} className="flex gap-3 mb-10">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#48484A]" />
            </div>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a research topic…" disabled={researching}
              className="w-full h-13 pl-11 rounded-2xl text-sm text-white placeholder:text-[#48484A]"
              style={{ height: "52px", background: "#242426", border: "1px solid #38383A" }}
            />
          </div>
          <Button type="submit" disabled={researching || !topic.trim() || !accessToken}
            className="h-[52px] px-7 rounded-2xl font-semibold text-sm border-0 transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#007AFF", color: "#FFFFFF" }}>
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
            style={{ background: "#242426", borderColor: "#38383A" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#007AFF15", border: "1px solid #007AFF30" }}>
              <FileText className="h-6 w-6 text-[#007AFF]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">No research yet</h3>
            <p className="text-sm text-[#636366] max-w-xs">Enter a topic above to get a structured report with real web sources.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {researching && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-48 rounded-2xl border p-5 flex flex-col justify-between relative overflow-hidden"
                  style={{ background: "#242426", borderColor: "#007AFF30" }}>
                  <div className="absolute inset-0 shimmer opacity-50" />
                  <div className="relative space-y-2">
                    <div className="h-5 w-3/4 rounded-lg shimmer" />
                    <div className="h-4 w-full rounded shimmer" />
                    <div className="h-4 w-5/6 rounded shimmer" />
                  </div>
                  <div className="relative flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                    <span className="text-xs text-[#007AFF] font-medium">Researching…</span>
                  </div>
                </motion.div>
              )}

              {reports.map((report, i) => (
                <motion.div key={report.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedReport(report)}
                  className="h-48 rounded-2xl border p-5 flex flex-col justify-between cursor-pointer transition-colors duration-150"
                  style={{ background: "#242426", borderColor: "#38383A" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#48484A"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#38383A"; }}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 line-clamp-1">{report.topic}</h3>
                    <p className="text-xs text-[#8E8E93] line-clamp-4 leading-relaxed">
                      {report.content.replace(/[#*]/g, "").trim()}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: "#007AFF15", border: "1px solid #007AFF30" }}>
                      <LinkIcon className="h-3 w-3 text-[#007AFF]" />
                      <span className="text-[10px] font-semibold text-[#007AFF]">{report.sources_count} sources</span>
                    </div>
                    <span className="text-[10px] text-[#636366]">{formatTimeAgo(new Date(report.created_at))}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 border"
          style={{ background: "#1C1C1E", borderColor: "#38383A" }}>
          {selectedReport && (
            <div>
              <div className="sticky top-0 z-10 px-8 py-6 border-b"
                style={{ background: "rgba(28,28,30,0.9)", backdropFilter: "blur(20px)", borderColor: "#38383A" }}>
                <h2 className="text-xl font-bold text-white mb-1.5">{selectedReport.topic}</h2>
                <div className="flex items-center gap-3 text-xs text-[#8E8E93]">
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5" />
                    {selectedReport.sources_count} sources
                  </div>
                  <span>·</span>
                  <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="p-8">
                <div className="prose-inceptive">
                  <ReactMarkdown>{selectedReport.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
