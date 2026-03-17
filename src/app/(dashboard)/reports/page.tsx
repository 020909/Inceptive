"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, BarChart3, Target } from "lucide-react";
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
      toast.success("Sample report generated");
      fetchReports(accessToken);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Weekly Reports</h1>
          <Button disabled className="bg-[#2C2C2E] text-[#8E8E93] h-10 px-4">
            <TrendingUp className="h-4 w-4 mr-2" /> Generate Report
          </Button>
        </div>
        <div className="rounded-xl border border-[#38383A] bg-[#242426] p-10 skeleton h-[400px]" />
      </PageTransition>
    );
  }

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Weekly Reports</h1>
            <p className="text-sm text-[#8E8E93]">Analytics and insights from your AI</p>
          </div>
          {reports.length > 0 && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleGenerateSample}
                disabled={generating}
                className="bg-[#2A2A2C] border border-[#38383A] text-white hover:bg-[#38383A] rounded-lg h-10 px-4 text-sm font-medium transition-all"
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                Generate Latest
              </Button>
            </motion.div>
          )}
        </motion.div>

        {reports.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-32 text-center border border-[#38383A] rounded-xl bg-[#242426]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2C2C2E] border border-[#38383A] mb-6">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No reports generated</h3>
            <p className="text-[#8E8E93] mb-6 max-w-sm">
              Generate your first weekly report to see analytics based on your real platform data.
            </p>
            <Button
              onClick={handleGenerateSample}
              disabled={generating}
              className="bg-[#007AFF] text-white hover:bg-[#0A84FF]"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Generate Sample Report"}
            </Button>
          </motion.div>
        ) : (
          latestReport && (
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Main Report Card */}
              <div className="rounded-2xl border border-[#38383A] bg-[#1C1C1E] overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                <div className="p-8 md:p-12 relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                    <div>
                      <h2 className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-[0.2em] mb-3">Inceptive Weekly Report</h2>
                      <p className="text-2xl md:text-3xl font-light text-white">{latestReport.date_range_str}</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#30D158]/20 bg-[#30D158]/10 w-fit">
                      <div className="h-2 w-2 rounded-full bg-[#30D158] animate-pulse" />
                      <span className="text-xs font-semibold tracking-wide text-[#30D158] uppercase">All systems running</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 mb-12">
                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-[#38383A] pb-4">
                        <span className="text-[#8E8E93] text-sm">Hours worked by your AI</span>
                        <span className="text-white font-mono text-xl">{latestReport.hours_worked}h</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[#38383A] pb-4">
                        <span className="text-[#8E8E93] text-sm">Tasks completed</span>
                        <span className="text-white font-mono text-xl">{latestReport.tasks_completed}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[#38383A] pb-4">
                        <span className="text-[#8E8E93] text-sm">Emails sent</span>
                        <span className="text-white font-mono text-xl">{latestReport.emails_sent}</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-[#38383A] pb-4">
                        <span className="text-[#8E8E93] text-sm">Research reports</span>
                        <span className="text-white font-mono text-xl">{latestReport.research_reports}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[#38383A] pb-4">
                        <span className="text-[#8E8E93] text-sm">Social posts scheduled</span>
                        <span className="text-white font-mono text-xl">{latestReport.social_posts}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-[#38383A] pb-4">
                        <span className="text-[#8E8E93] text-sm">Goals active</span>
                        <span className="text-white font-mono text-xl">{latestReport.goals_active}</span>
                      </div>
                    </div>
                  </div>

                  {topGoal && (
                    <div className="bg-[#242426] border border-[#38383A] rounded-xl p-6 mb-12">
                      <div className="flex items-center gap-3 mb-4">
                        <Target className="h-5 w-5 text-white" />
                        <h3 className="text-sm font-semibold text-white">Current Priority Focus</h3>
                      </div>
                      <p className="text-white mb-4 text-lg">{topGoal.title}</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-1.5 bg-[#38383A] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#007AFF] rounded-full"
                            style={{ width: `${topGoal.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-white min-w-[3ch]">{topGoal.progress_percent}%</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-[#38383A] flex justify-between items-center text-xs text-[#636366]">
                    <span>Every Sunday. Delivered to your inbox.</span>
                    <span>Inceptive AI</span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              {latestReport.chart_data && latestReport.chart_data.length > 0 && (
                <div className="rounded-2xl border border-[#38383A] bg-[#1C1C1E] p-8">
                  <h3 className="text-sm font-bold text-white mb-8">Tasks Completed (Past 8 Weeks)</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={latestReport.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#38383A" vertical={false} />
                        <XAxis
                          dataKey="week"
                          stroke="#636366"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          stroke="#636366"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          dx={-10}
                        />
                        <Tooltip
                          cursor={{ fill: '#2C2C2E' }}
                          contentStyle={{ backgroundColor: '#242426', border: '1px solid #38383A', borderRadius: '8px', color: '#FFF' }}
                          itemStyle={{ color: '#FFF' }}
                        />
                        <Bar
                          dataKey="tasks_completed"
                          fill="#007AFF"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </motion.div>
          )
        )}
      </div>
    </PageTransition>
  );
}
