"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingCard } from "@/components/ui/loading-skeleton";
import type { WeeklyReport } from "@/types/database";
import { FileBarChart } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function LatestReportCard({ report }: { report: WeeklyReport }) {
  const stats = [
    {
      label: "Hours worked by your AI",
      value: `${report.hours_worked}h`,
    },
    { label: "Tasks completed", value: report.tasks_completed },
    { label: "Emails sent", value: report.emails_sent },
    {
      label: "Research reports delivered",
      value: (report.report_json as Record<string, number>)?.research_reports || 0,
    },
    {
      label: "Social media posts scheduled",
      value: (report.report_json as Record<string, number>)?.social_posts || 0,
    },
    { label: "Goals active", value: report.goals_active },
  ];

  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
          Inceptive Weekly Report
        </h2>
        <span className="text-xs text-[#555555]">
          {new Date(report.week_start).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}{" "}
          —{" "}
          {new Date(report.week_end).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="space-y-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between py-2 border-b border-[#1F1F1F] last:border-b-0"
          >
            <span className="text-sm text-[#888888]">{stat.label}</span>
            <span className="text-sm font-semibold text-white">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-[#1F1F1F]">
        <p className="text-xs text-[#555555] text-center">
          Every Sunday. Delivered to your inbox.
        </p>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg px-3 py-2">
        <p className="text-xs text-[#888888]">{label}</p>
        <p className="text-sm font-semibold text-white">
          {payload[0].value} tasks
        </p>
      </div>
    );
  }
  return null;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchReports = async () => {
      const { data } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(8);

      setReports((data as WeeklyReport[]) || []);
      setLoading(false);
    };

    fetchReports();
  }, [user, supabase]);

  const chartData = [...reports]
    .reverse()
    .map((r) => ({
      week: new Date(r.week_start).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      tasks: r.tasks_completed,
    }));

  if (loading) {
    return (
      <PageTransition>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Weekly Reports
          </h1>
          <p className="text-sm text-[#888888] mb-6">
            Your AI&apos;s productivity summary, delivered weekly
          </p>
          <LoadingCard />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Weekly Reports</h1>
        <p className="text-sm text-[#888888] mb-6">
          Your AI&apos;s productivity summary, delivered weekly
        </p>

        {reports.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title="No reports yet"
            description="Weekly reports will appear here every Sunday with a full summary of your AI's activity."
          />
        ) : (
          <>
            <LatestReportCard report={reports[0]} />

            {/* Bar chart */}
            {chartData.length > 1 && (
              <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
                <h3 className="text-sm font-semibold text-white mb-6">
                  Tasks Completed Over Time
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1F1F1F"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: "#888888", fontSize: 12 }}
                      axisLine={{ stroke: "#1F1F1F" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#888888", fontSize: 12 }}
                      axisLine={{ stroke: "#1F1F1F" }}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="tasks"
                      fill="#ffffff"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
