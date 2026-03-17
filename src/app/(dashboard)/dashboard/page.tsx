"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import { motion, animate } from "framer-motion";
import {
  Zap, Target, FileText, Mail, ArrowUpRight, CheckCircle2,
  Clock, Bot,
} from "lucide-react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils";

interface DashboardStats {
  tasks_completed: number;
  emails_sent: number;
  goals_active: number;
  research_reports: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.25, 0.46, 0.45, 0.94] as any,
      onUpdate: (v: number) => { if (node) node.textContent = Math.round(v).toString(); },
    });
    return controls.stop;
  }, [value]);
  return <span ref={ref}>0</span>;
}

function StatCard({ title, value, icon, href, color }: {
  title: string; value: number; icon: React.ReactNode; href: string; color: string;
}) {
  return (
    <StaggerItem>
      <Link href={href} className="block group">
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="p-5 rounded-2xl border transition-colors duration-200"
          style={{ background: "#242426", borderColor: "#38383A" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
              <div style={{ color }}>{icon}</div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[#48484A] group-hover:text-[#8E8E93] transition-colors duration-150" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            <AnimatedNumber value={value} />
          </div>
          <div className="text-xs font-medium text-[#8E8E93]">{title}</div>
        </motion.div>
      </Link>
    </StaggerItem>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    tasks_completed: 0, emails_sent: 0, goals_active: 0, research_reports: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [activeGoals, setActiveGoals] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const supabase = createClient();
      try {
        const [tasksRes, emailsRes, goalsCountRes, researchRes, recentTasksRes, activeGoalsRes] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("emails").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "sent"),
          supabase.from("goals").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
          supabase.from("research_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
          supabase.from("goals").select("*").eq("user_id", user.id).eq("status", "active"),
        ]);
        setStats({
          tasks_completed: tasksRes.count || 0,
          emails_sent: emailsRes.count || 0,
          goals_active: goalsCountRes.count || 0,
          research_reports: researchRes.count || 0,
        });
        setRecentTasks(recentTasksRes.data || []);
        setActiveGoals(activeGoalsRes.data || []);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const firstName = user?.email?.split("@")[0] || "there";

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-6xl">
          <div className="h-8 w-48 shimmer rounded-lg mb-1" />
          <div className="h-4 w-64 shimmer rounded mb-8" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl shimmer" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 h-[380px] rounded-2xl shimmer" />
            <div className="h-[380px] rounded-2xl shimmer" />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Good {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-[#8E8E93]">Your agents are working for you around the clock.</p>
        </div>

        <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Tasks Completed" value={stats.tasks_completed} icon={<Zap className="h-5 w-5" />} href="/agent" color="#007AFF" />
          <StatCard title="Research Reports" value={stats.research_reports} icon={<FileText className="h-5 w-5" />} href="/research" color="#30D158" />
          <StatCard title="Emails Sent" value={stats.emails_sent} icon={<Mail className="h-5 w-5" />} href="/email" color="#FF9F0A" />
          <StatCard title="Active Goals" value={stats.goals_active} icon={<Target className="h-5 w-5" />} href="/goals" color="#BF5AF2" />
        </StaggerContainer>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="lg:col-span-2 rounded-2xl border p-6"
            style={{ background: "#242426", borderColor: "#38383A" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-white">Recent Activity</h2>
                <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] pulse-dot" />
              </div>
              <Link href="/agent" className="text-xs text-[#8E8E93] hover:text-white transition-colors flex items-center gap-1">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#2A2A2C" }}>
                  <Clock className="h-5 w-5 text-[#48484A]" />
                </div>
                <p className="text-sm text-[#636366] mb-4">No activity yet — launch an agent to begin</p>
                <Link href="/agent"
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity duration-150 hover:opacity-90"
                  style={{ background: "#007AFF", color: "#FFFFFF" }}>
                  Launch Agent
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTasks.map((task: any, i: number) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="flex items-center gap-3 p-3 rounded-xl border transition-colors duration-150"
                    style={{ background: "#1C1C1E", borderColor: "#2C2C2E" }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "#2A2A2C" }}>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#007AFF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{task.title}</p>
                      <p className="text-xs text-[#636366]">{formatTimeAgo(new Date(task.created_at))}</p>
                    </div>
                    <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: "#2A2A2C", color: "#8E8E93" }}>
                      {task.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Goals */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="rounded-2xl border p-6 flex flex-col"
            style={{ background: "#242426", borderColor: "#38383A" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Goal Progress</h2>
              <Link href="/goals" className="text-xs text-[#8E8E93] hover:text-white transition-colors flex items-center gap-1">
                Manage <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="flex-1 space-y-5">
              {activeGoals.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#2A2A2C" }}>
                    <Target className="h-5 w-5 text-[#48484A]" />
                  </div>
                  <p className="text-sm text-[#636366]">No active goals yet</p>
                </div>
              ) : (
                activeGoals.map((goal: any) => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white truncate max-w-[155px]">{goal.title}</span>
                      <span className="text-xs font-semibold text-[#007AFF]">{goal.progress_percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "#2A2A2C" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "#007AFF" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${goal.progress_percent}%` }}
                        transition={{ duration: 0.9, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <Link href="/agent"
              className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity duration-150 hover:opacity-90"
              style={{ background: "#007AFF", color: "#FFFFFF" }}>
              <Bot className="h-4 w-4" />
              Launch Agent
            </Link>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
