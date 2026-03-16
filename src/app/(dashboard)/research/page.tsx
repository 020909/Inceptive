"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingGrid } from "@/components/ui/loading-skeleton";
import type { ResearchReport } from "@/types/database";
import { Search } from "lucide-react";

function ResearchCard({ report }: { report: ResearchReport }) {
  // Extract a key finding from the content (first sentence or first 100 chars)
  const keyFinding = report.content.split(".")[0] + ".";

  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 transition-all duration-200 hover:border-[#333333]">
      <h3 className="text-base font-semibold text-white mb-4">{report.topic}</h3>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-medium text-[#555555] uppercase tracking-wider mb-1">
            Key Finding
          </p>
          <p className="text-sm text-[#888888] leading-relaxed line-clamp-3">
            {keyFinding}
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#1F1F1F]">
          <div>
            <p className="text-[10px] font-medium text-[#555555] uppercase tracking-wider mb-0.5">
              Sources
            </p>
            <p className="text-sm text-white font-medium">
              {report.sources_count}
            </p>
          </div>
          <span className="text-xs text-[#555555]">
            {report.sources_count} sources reviewed at{" "}
            {new Date(report.created_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <PageTransition>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Overnight Research
          </h1>
          <p className="text-sm text-[#888888] mb-6">
            Deep research conducted by your AI while you slept
          </p>
          <LoadingGrid count={6} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">
          Overnight Research
        </h1>
        <p className="text-sm text-[#888888] mb-6">
          Deep research conducted by your AI while you slept
        </p>

        {reports.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No research reports yet"
            description="Your AI agent will compile detailed research reports here overnight on topics you assign."
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
