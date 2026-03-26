"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, BarChart3, Target, FileText, Download, Share2, Zap, MoreHorizontal, Clock } from "lucide-react";
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

interface WeeklyReport {
  id: string;
  week_start: string;
  date_range_str: string;
  hours_worked: string;
  tasks_completed: number;
  emails_sent: number;
  research_reports: number;
  social_posts: number;
  goals_active: number;
  chart_data: any[];
  created_at: string;
}

interface Report {
  id: string;
  title: string;
  description: string;
  type: 'analytics' | 'performance' | 'financial' | 'custom';
  createdAt: string;
  fileSize: string;
}

const mockReports: Report[] = [
  { id: '1', title: 'Weekly Performance Summary', description: 'Comprehensive analysis of AI agent performance and user engagement metrics.', type: 'performance', createdAt: '2 hours ago', fileSize: '2.4 MB' },
  { id: '2', title: 'User Growth Analysis', description: 'Month-over-month user acquisition and retention trends with projections.', type: 'analytics', createdAt: '1 day ago', fileSize: '4.1 MB' },
  { id: '3', title: 'Q4 Financial Overview', description: 'Revenue, expenses, and runway analysis for Q4 2024.', type: 'financial', createdAt: '3 days ago', fileSize: '1.8 MB' },
  { id: '5', title: 'Competitor Benchmark Report', description: 'Detailed comparison against Claude Cowork, Perplexity, and Manus.', type: 'custom', createdAt: '1 week ago', fileSize: '5.2 MB' },
];

function TypeBadge({ type }: { type: Report['type'] }) {
  const configs = {
    analytics: { icon: BarChart3, color: 'text-white', bg: 'bg-white/[0.06]', label: 'Analytics' },
    performance: { icon: Zap, color: 'text-white/80', bg: 'bg-white/[0.06]', label: 'Performance' },
    financial: { icon: TrendingUp, color: 'text-white', bg: 'bg-white/[0.06]', label: 'Financial' },
    custom: { icon: FileText, color: 'text-white/80', bg: 'bg-white/[0.06]', label: 'Custom' },
  };
  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
      <Icon size={12} className={config.color} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

function ReportCard({ report, index }: { report: Report; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="group p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100, damping: 20 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
          <FileText size={20} className="text-white/70" />
        </div>
        <TypeBadge type={report.type} />
      </div>

      <h3 className="text-white font-medium tracking-[-0.02em] mb-2">{report.title}</h3>
      <p className="text-white/40 text-sm mb-4 line-clamp-2">{report.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-white/30">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {report.createdAt}
          </span>
          <span>{report.fileSize}</span>
        </div>

        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <button className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors">
            <Download size={14} className="text-white/50" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors">
            <Share2 size={14} className="text-white/50" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors">
            <MoreHorizontal size={14} className="text-white/50" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
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

  const handleGenerateSample = async () => {
    if (!accessToken || !user) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      toast.success("Report generated!");
      if (data.report) setReports(prev => [data.report, ...prev]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen flex flex-col">
          <div className="h-20 shimmer rounded-xl mx-8 mt-8" />
          <div className="flex-1 p-8">
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-32 shimmer rounded-xl" />)}
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-[-0.02em]">Reports</h1>
            <p className="text-white/40 text-sm">AI-generated insights and analytics</p>
          </div>
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[#1E1E1C] font-medium text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerateSample}
            disabled={generating}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Generate Report
          </motion.button>
        </header>

        {/* Content */}
        <div className="flex-1 p-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <motion.div
              className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <FileText size={16} className="text-white/60" />
                </div>
                <span className="text-white/40 text-xs">Total Reports</span>
              </div>
              <p className="text-2xl font-semibold text-white tracking-[-0.03em]">{reports.length + mockReports.length}</p>
            </motion.div>
            <motion.div
              className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Zap size={16} className="text-white/60" />
                </div>
                <span className="text-white/40 text-xs">Generated This Week</span>
              </div>
              <p className="text-2xl font-semibold text-white tracking-[-0.03em]">5</p>
            </motion.div>
            <motion.div
              className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Share2 size={16} className="text-white/60" />
                </div>
                <span className="text-white/40 text-xs">Shared</span>
              </div>
              <p className="text-2xl font-semibold text-white tracking-[-0.03em]">12</p>
            </motion.div>
            <motion.div
              className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <BarChart3 size={16} className="text-white/60" />
                </div>
                <span className="text-white/40 text-xs">Storage Used</span>
              </div>
              <p className="text-2xl font-semibold text-white tracking-[-0.03em]">48 MB</p>
            </motion.div>
          </div>

          {/* Report Templates */}
          <div className="mb-6">
            <h2 className="text-white font-medium tracking-[-0.02em] mb-4">Quick Generate</h2>
            <div className="flex gap-3">
              {['Weekly Summary', 'User Analytics', 'Performance', 'Competitor Analysis'].map((template, index) => (
                <motion.button
                  key={template}
                  className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 text-sm hover:bg-white/[0.08] hover:border-white/[0.10] hover:text-white transition-all"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                <div className="p-8 md:p-12 relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                    <div>
                      <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3">Inceptive Weekly Report</h2>
                      <p className="text-2xl md:text-3xl font-light text-white">{latestReport.date_range_str}</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.10] bg-white/[0.06] w-fit">
                      <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      <span className="text-xs font-semibold tracking-wide text-white uppercase">All systems running</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 mb-12">
                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4">
                        <span className="text-white/60 text-sm">Hours worked by your AI</span>
                        <span className="text-white font-mono text-xl">{latestReport.hours_worked}h</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4">
                        <span className="text-white/60 text-sm">Tasks completed</span>
                        <span className="text-white font-mono text-xl">{latestReport.tasks_completed}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4">
                        <span className="text-white/60 text-sm">Emails sent</span>
                        <span className="text-white font-mono text-xl">{latestReport.emails_sent}</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4">
                        <span className="text-white/60 text-sm">Research reports</span>
                        <span className="text-white font-mono text-xl">{latestReport.research_reports}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4">
                        <span className="text-white/60 text-sm">Social posts scheduled</span>
                        <span className="text-white font-mono text-xl">{latestReport.social_posts}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4">
                        <span className="text-white/60 text-sm">Goals active</span>
                        <span className="text-white font-mono text-xl">{latestReport.goals_active}</span>
                      </div>
                    </div>
                  </div>

                  {topGoal && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-12">
                      <div className="flex items-center gap-3 mb-4">
                        <Target className="h-5 w-5 text-white/60" />
                        <h3 className="text-sm font-medium text-white">Current Priority Focus</h3>
                      </div>
                      <p className="text-white mb-4 text-lg">{topGoal.title}</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full"
                            style={{ width: `${topGoal.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-white min-w-[3ch]">{topGoal.progress_percent}%</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-white/[0.06] flex justify-between items-center text-xs text-white/40">
                    <span>Every Sunday. Delivered to your inbox.</span>
                    <span>Inceptive AI</span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              {latestReport.chart_data && latestReport.chart_data.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8">
                  <h3 className="text-white font-medium tracking-[-0.02em] mb-8">Tasks Completed (Past 8 Weeks)</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={latestReport.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                          dataKey="week"
                          stroke="rgba(255,255,255,0.4)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          stroke="rgba(255,255,255,0.4)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          dx={-10}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                          contentStyle={{ backgroundColor: '#262624', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#FFF' }}
                          itemStyle={{ color: '#FFF' }}
                        />
                        <Bar
                          dataKey="tasks_completed"
                          fill="white"
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

          {/* Recent Reports Grid */}
          <h2 className="text-white font-medium tracking-[-0.02em] mb-4">Recent Reports</h2>
          <div className="grid grid-cols-2 gap-4">
            {mockReports.map((report, index) => (
              <ReportCard key={report.id} report={report} index={index} />
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
