"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingGrid } from "@/components/ui/loading-skeleton";
import type { ResearchReport } from "@/types/database";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

function ResearchCard({ report }: { report: ResearchReport }) {
  // Extract executive summary
  const execSummaryMatch = report.content.match(/Executive Summary[\s\S]*?(?=\n\n|\n[A-Z][a-z]+)/i);
  let execSummary = execSummaryMatch ? execSummaryMatch[0].replace(/Executive Summary:?\s*/i, "").trim() : "";
  if (!execSummary) {
    execSummary = report.content.split("\n\n")[0] || report.content.substring(0, 150) + "...";
  }

  // Count key findings
  const findingsMatch = report.content.match(/Key Findings[\s\S]*?(?=\n\n(?:Market Size|Main Players|Key Trends|Risks|Sources))/i);
  let keyFindingsCount = 0;
  if (findingsMatch) {
    const bulletPoints = findingsMatch[0].match(/[-*•]|\d+\./g);
    keyFindingsCount = bulletPoints ? bulletPoints.length : 0;
  }

  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 transition-all duration-200 hover:border-[#333333] flex flex-col h-full">
      <h3 className="text-base font-semibold text-white mb-4 line-clamp-2">{report.topic}</h3>

      <div className="space-y-4 flex-1">
        <div>
          <p className="text-[10px] font-medium text-[#555555] uppercase tracking-wider mb-1">
            Executive Summary
          </p>
          <p className="text-sm text-[#888888] leading-relaxed line-clamp-3">
            {execSummary}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#1F1F1F] shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-medium text-[#555555] uppercase tracking-wider mb-0.5">
              Findings
            </p>
            <p className="text-sm text-white font-medium">
              {keyFindingsCount || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#555555] uppercase tracking-wider mb-0.5">
              Sources
            </p>
            <p className="text-sm text-white font-medium">
              {report.sources_count || "—"}
            </p>
          </div>
        </div>
        <span className="text-xs text-[#555555]">
          {new Date(report.created_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </span>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [isResearching, setIsResearching] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchReports = async () => {
      const { data } = await supabase
        .from("research_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setReports((data as ResearchReport[]) || []);
      setLoading(false);
    };

    fetchReports();
  }, [user, supabase]);

  const handleRunResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isResearching) return;

    setIsResearching(true);
    try {
      const response = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to run research");
      }

      setReports((prev) => [data, ...prev]);
      setTopic("");
      toast.success("Research completed successfully");
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsResearching(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              Overnight Research
            </h1>
            <p className="text-sm text-[#888888]">
              Deep research conducted by your AI while you slept
            </p>
          </div>
          <LoadingGrid count={6} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Research Agent
          </h1>
          <p className="text-sm text-[#888888]">
            Instant deep-dive research into any topic powered by your AI agent
          </p>
        </div>

        <div className="mb-8 p-4 rounded-xl border border-[#1F1F1F] bg-[#0D0D0D]">
          <form onSubmit={handleRunResearch} className="flex gap-3">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic to research (e.g., 'Current trends in EV battery technology')"
              disabled={isResearching}
              className="flex-1 h-11 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200 shadow-none hover:border-[#555555]"
            />
            <Button
              type="submit"
              disabled={isResearching || !topic.trim()}
              className="h-11 min-w-[140px] bg-white text-black hover:bg-white/90 rounded-lg font-medium transition-all duration-200 px-6 shrink-0"
            >
              {isResearching ? (
                <div className="flex items-center gap-2">
                  <span className="flex gap-1">
                    <motion.span
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      className="w-1.5 h-1.5 bg-black rounded-full block"
                    />
                    <motion.span
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-black rounded-full block"
                    />
                    <motion.span
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-black rounded-full block"
                    />
                  </span>
                </div>
              ) : (
                "Run Research"
              )}
            </Button>
          </form>
        </div>

        {reports.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No research reports yet"
            description="Your AI agent will compile detailed research reports here on topics you assign."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <ResearchCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
