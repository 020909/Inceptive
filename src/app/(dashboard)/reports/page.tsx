"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Loader2, BarChart3, Target, FileText, Share2, Zap, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { jsPDF } from "jspdf";

interface WeeklyReport {
  id: string;
  week_start: string;
  date_range_str: string;
  hours_worked: string | number;
  tasks_completed: number;
  emails_sent: number;
  research_reports: number;
  social_posts: number;
  goals_active: number;
  chart_data: any[];
  created_at: string;
}

function downloadWeeklyReportPdf(report: WeeklyReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Inceptive Weekly Report`, margin, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(report.date_range_str, margin, y);
  y += 24;
  const lines = [
    `Hours worked by AI: ${report.hours_worked}h`,
    `Tasks completed: ${report.tasks_completed}`,
    `Emails sent: ${report.emails_sent}`,
    `Research reports: ${report.research_reports}`,
    `Social posts: ${report.social_posts}`,
    `Active goals: ${report.goals_active}`,
  ];
  doc.text(lines, margin, y);
  doc.save(`inceptive_weekly_report_${String(report.week_start).slice(0, 10)}.pdf`);
}

function formatReportWhen(r: WeeklyReport) {
  if (r.date_range_str?.trim()) return r.date_range_str;
  try {
    return new Date(r.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}



export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [topGoal, setTopGoal] = useState<{ title: string; progress_percent: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const fetchReports = async (token: string) => {
    try {
      const res = await fetch("/api/reports", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      setReports(data.reports || []);
      setTopGoal(data.topGoal);
    } catch (error) {
      console.error(error);
      toast.error("Could not load reports");
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
        if (user) fetchReports(session.access_token);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const handleGenerateSample = async (template?: string) => {
    if (!accessToken || !user) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ template: template || "Weekly Summary" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      toast.success(`${template || "Weekly"} report generated!`);
      if (data.report) setReports(prev => [data.report, ...prev]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen flex flex-col">
          <div className="h-28 shimmer rounded-[28px] mx-8 mt-8" />
          <div className="flex-1 p-8">
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-32 shimmer rounded-xl" />)}
            </div>
          </div>
        </div>
      </>
    );
  }

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="page-hero mx-8 mt-8 flex items-center justify-between px-8 py-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">Insights</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.02em]">Reports</h1>
            <p className="text-[var(--fg-muted)] text-sm mt-2">AI-generated summaries, analytics, and downloadable weekly reporting.</p>
          </div>
          <div className="flex items-center gap-2">
            {latestReport && (
              <button
                onClick={() => downloadWeeklyReportPdf(latestReport)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] font-medium text-sm"
              >
                <Download size={15} />
                Download PDF
              </button>
            )}
            <motion.button
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] font-medium text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGenerateSample()}
              disabled={generating}
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              Generate Report
            </motion.button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                  <FileText size={16} className="text-[var(--fg-secondary)]" />
                </div>
                <span className="text-[var(--fg-muted)] text-xs">Total Reports</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{reports.length}</p>
            </motion.div>
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                  <Zap size={16} className="text-[var(--fg-secondary)]" />
                </div>
                <span className="text-[var(--fg-muted)] text-xs">Generated This Week</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{reports.filter(r => new Date(r.created_at) > new Date(Date.now() - 7 * 86400000)).length}</p>
            </motion.div>
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                  <Share2 size={16} className="text-[var(--fg-secondary)]" />
                </div>
                <span className="text-[var(--fg-muted)] text-xs">Shared</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">0</p>
            </motion.div>
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                  <BarChart3 size={16} className="text-[var(--fg-secondary)]" />
                </div>
                <span className="text-[var(--fg-muted)] text-xs">Storage Used</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">—</p>
            </motion.div>
          </div>

          {/* Report Templates */}
          <div className="mb-6">
            <h2 className="text-[var(--fg-primary)] font-medium tracking-[-0.02em] mb-4">Quick Generate</h2>
            <div className="flex gap-3">
              {['Weekly Summary', 'User Analytics', 'Performance', 'Competitor Analysis'].map((template, index) => (
                <motion.button
                  key={template}
                  className="px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)]/70 text-sm hover:bg-[var(--bg-elevated)] hover:border-[var(--border-default)] hover:text-[var(--fg-primary)] transition-all"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleGenerateSample(template)}
                >
                  {template}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Inceptive Weekly Report */}
          {latestReport && (
            <motion.div
              className="space-y-6 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Main Report Card */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                <div className="p-8 md:p-12 relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                    <div>
                      <h2 className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-[0.2em] mb-3">Inceptive Weekly Report</h2>
                      <p className="text-2xl md:text-3xl font-light text-[var(--fg-primary)]">{formatReportWhen(latestReport)}</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] w-fit">
                      <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                      <span className="text-xs font-semibold tracking-wide text-[var(--fg-primary)] uppercase">All systems running</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 mb-12">
                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-4">
                        <span className="text-[var(--fg-secondary)] text-sm">Hours worked by your AI</span>
                        <span className="text-[var(--fg-primary)] font-mono text-xl">{latestReport.hours_worked}h</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-4">
                        <span className="text-[var(--fg-secondary)] text-sm">Tasks completed</span>
                        <span className="text-[var(--fg-primary)] font-mono text-xl">{latestReport.tasks_completed}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-4">
                        <span className="text-[var(--fg-secondary)] text-sm">Emails sent</span>
                        <span className="text-[var(--fg-primary)] font-mono text-xl">{latestReport.emails_sent}</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-4">
                        <span className="text-[var(--fg-secondary)] text-sm">Research reports</span>
                        <span className="text-[var(--fg-primary)] font-mono text-xl">{latestReport.research_reports}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-4">
                        <span className="text-[var(--fg-secondary)] text-sm">Social posts scheduled</span>
                        <span className="text-[var(--fg-primary)] font-mono text-xl">{latestReport.social_posts}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-4">
                        <span className="text-[var(--fg-secondary)] text-sm">Goals active</span>
                        <span className="text-[var(--fg-primary)] font-mono text-xl">{latestReport.goals_active}</span>
                      </div>
                    </div>
                  </div>

                  {topGoal && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 mb-12">
                      <div className="flex items-center gap-3 mb-4">
                        <Target className="h-5 w-5 text-[var(--fg-secondary)]" />
                        <h3 className="text-sm font-medium text-[var(--fg-primary)]">Current Priority Focus</h3>
                      </div>
                      <p className="text-[var(--fg-primary)] mb-4 text-lg">{topGoal.title}</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent)] rounded-full"
                            style={{ width: `${topGoal.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[var(--fg-primary)] min-w-[3ch]">{topGoal.progress_percent}%</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-[var(--border-subtle)] flex justify-between items-center text-xs text-[var(--fg-muted)]">
                    <span>Every Sunday. Delivered to your inbox.</span>
                    <span>Inceptive AI</span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              {latestReport.chart_data && latestReport.chart_data.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8">
                  <h3 className="text-[var(--fg-primary)] font-medium tracking-[-0.02em] mb-8">Tasks Completed (Past 8 Weeks)</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                      <BarChart data={latestReport.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis
                          dataKey="week"
                          stroke="var(--fg-muted)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          stroke="var(--fg-muted)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          dx={-10}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--accent-soft)' }}
                          contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', color: 'var(--fg-primary)' }}
                          itemStyle={{ color: 'var(--fg-primary)' }}
                        />
                        <Bar
                          dataKey="tasks_completed"
                          fill="var(--accent)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {reports.length > 1 && (
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <h2 className="text-[var(--fg-primary)] font-medium tracking-[-0.02em] mb-4">Previous summaries</h2>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                {reports.slice(1).map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
                  >
                    <div className="text-[var(--fg-primary)] font-medium">{formatReportWhen(r)}</div>
                    <div className="flex flex-wrap gap-4 text-[var(--fg-muted)] text-xs">
                      <span>{r.tasks_completed} tasks</span>
                      <span>{r.research_reports} research</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* No reports state */}
          {reports.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
                <FileText size={20} className="text-[var(--fg-tertiary)]" />
              </div>
              <p className="text-sm text-[var(--fg-primary)] font-medium mb-1">No reports yet</p>
              <p className="text-xs text-[var(--fg-muted)]">Click &quot;Generate Report&quot; to create your first weekly summary.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
