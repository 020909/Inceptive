"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, FileText, Loader2, Link as LinkIcon, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils";

interface ResearchReport {
  id: string;
  topic: string;
  content: string;
  sources_count: number;
  created_at: string;
}

export default function ResearchPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [topic, setTopic] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReports = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('research_reports')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAccessToken(session.access_token);
        if (user) fetchReports();
      } else {
        setLoading(false);
      }
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
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ topic: topic.trim(), user_id: user.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");

      toast.success("Research complete");
      setTopic("");
      setReports([data.report, ...reports]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResearching(false);
    }
  };

  const openReport = (report: ResearchReport) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto">
        {/* Header & Search */}
        <div className="mb-10 w-full max-w-3xl">
          <h1 className="text-2xl font-bold text-white mb-6">Research Engine</h1>
          <form onSubmit={handleRunResearch} className="flex gap-3 w-full relative">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-[#555555]" />
              </div>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a research topic..."
                disabled={researching}
                className="w-full h-14 pl-12 bg-[#0D0D0D] border-[#1F1F1F] text-white text-base placeholder:text-[#555555] rounded-xl focus:border-white focus:ring-0 transition-all duration-200"
              />
            </div>
            <Button
              type="submit"
              disabled={researching || !topic.trim() || !accessToken}
              className="h-14 px-8 bg-white text-black hover:bg-white/90 rounded-xl text-base font-medium transition-all duration-200 shrink-0"
            >
              {!accessToken ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Syncing session...
                </>
              ) : researching ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                "Run Research"
              )}
            </Button>
          </form>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[200px] rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 skeleton" />
            ))}
          </div>
        ) : reports.length === 0 && !researching ? (
          <div className="flex flex-col items-center justify-center py-32 text-center border border-[#1F1F1F] rounded-xl bg-[#0D0D0D]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#111111] border border-[#333333] mb-6">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No research reports yet</h3>
            <p className="text-[#888888] mb-6 max-w-sm">
              Ask Inceptive to research anything overnight, or run a manual query above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {researching && (
              <div className="h-[200px] rounded-xl border border-[#1F1F1F] bg-[#111111] p-6 flex flex-col justify-between overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent shimmer" />
                <div>
                  <div className="h-6 w-3/4 bg-[#1F1F1F] rounded mb-3" />
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-[#1F1F1F] rounded" />
                    <div className="h-4 w-5/6 bg-[#1F1F1F] rounded" />
                    <div className="h-4 w-4/6 bg-[#1F1F1F] rounded" />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-6">
                  <div className="h-6 w-20 bg-[#1F1F1F] rounded-full" />
                  <div className="h-4 w-16 bg-[#1F1F1F] rounded" />
                </div>
              </div>
            )}

            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => openReport(report)}
                className="h-[200px] rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#111111] p-6 flex flex-col justify-between cursor-pointer transition-all duration-200 group"
              >
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-white transition-colors">
                    {report.topic}
                  </h3>
                  <p className="text-sm text-[#888888] line-clamp-3 leading-relaxed">
                    {report.content.replace(/[#*]/g, '').trim()}
                  </p>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#1F1F1F] bg-[#050505]">
                    <LinkIcon className="h-3 w-3 text-[#555555]" />
                    <span className="text-xs font-medium text-[#888888]">
                      {report.sources_count} sources
                    </span>
                  </div>
                  <span className="text-xs text-[#555555]">
                    {formatTimeAgo(new Date(report.created_at))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Report Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#050505] border-[#1F1F1F] text-white sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {selectedReport && (
            <div className="flex flex-col h-full">
              <div className="sticky top-0 z-10 bg-[#050505]/80 backdrop-blur-xl border-b border-[#1F1F1F] px-8 py-6 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedReport.topic}</h2>
                  <div className="flex items-center gap-4 text-sm text-[#888888]">
                    <div className="flex items-center gap-1.5">
                      <LinkIcon className="h-4 w-4" />
                      <span>{selectedReport.sources_count} sources analyzed</span>
                    </div>
                    <span>•</span>
                    <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                <div className="prose prose-invert prose-p:text-[#888888] prose-headings:text-white prose-li:text-[#888888] max-w-none">
                  <ReactMarkdown>
                    {selectedReport.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
