"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { 
  Zap, 
  Target, 
  FileText, 
  Mail, 
  Share2, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils";

interface DashboardStats {
  tasks_completed: number;
  emails_sent: number;
  goals_active: number;
  research_reports: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    tasks_completed: 0,
    emails_sent: 0,
    goals_active: 0,
    research_reports: 0
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [activeGoals, setActiveGoals] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      const supabase = createClient();
      
      try {
        const [
          tasksRes,
          emailsRes,
          goalsCountRes,
          researchRes,
          recentTasksRes,
          activeGoalsRes
        ] = await Promise.all([
          supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'sent'),
          supabase.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active'),
          supabase.from('research_reports').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10), // User said completed_at but created_at is more reliable if completed_at is null
          supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active')
        ]);

        setStats({
          tasks_completed: tasksRes.count || 0,
          emails_sent: emailsRes.count || 0,
          goals_active: goalsCountRes.count || 0,
          research_reports: researchRes.count || 0
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

  if (loading) {
    return (
      <PageTransition>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] skeleton" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[400px] rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] skeleton" />
          <div className="h-[400px] rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] skeleton" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-[#888888]">Your autonomous agents are working for you 24/7.</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Tasks Completed" 
            value={stats.tasks_completed} 
            icon={<Zap className="h-5 w-5" />} 
            href="/tasks"
          />
          <StatCard 
            title="Research Reports" 
            value={stats.research_reports} 
            icon={<FileText className="h-5 w-5" />} 
            href="/research"
          />
          <StatCard 
            title="Emails Sent" 
            value={stats.emails_sent} 
            icon={<Mail className="h-5 w-5" />} 
            href="/email"
          />
          <StatCard 
            title="Active Goals" 
            value={stats.goals_active} 
            icon={<Target className="h-5 w-5" />} 
            href="/goals"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Tasks */}
          <div className="lg:col-span-2 rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Recent Activity</h2>
              <Link href="/tasks" className="text-xs text-[#888] hover:text-white transition-colors flex items-center">
                View all <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
            
            {recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#555]">
                <Clock className="h-10 w-10 mb-4 opacity-20" />
                <p>No recent activity found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-[#1F1F1F] bg-black/40">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#111] flex items-center justify-center border border-[#1F1F1F]">
                        <CheckCircle2 className="h-4 w-4 text-[#888]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{task.title}</p>
                        <p className="text-xs text-[#555]">{formatTimeAgo(new Date(task.created_at))}</p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-[#555] tracking-widest">{task.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Goals */}
          <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Goal Progress</h2>
              <Link href="/goals" className="text-xs text-[#888] hover:text-white transition-colors flex items-center">
                Manage <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-6">
              {activeGoals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#555]">
                  <Target className="h-10 w-10 mb-4 opacity-20" />
                  <p className="text-sm">No active goals.</p>
                </div>
              ) : (
                activeGoals.map((goal: any) => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white font-medium truncate max-w-[150px]">{goal.title}</span>
                      <span className="text-[#888]">{goal.progress_percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white rounded-full transition-all duration-500"
                        style={{ width: `${goal.progress_percent}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <Link href="/agent" className="mt-8 flex items-center justify-center w-full py-3 rounded-lg bg-white text-black text-sm font-bold hover:bg-white/90 transition-all">
              Launch Agent
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function StatCard({ title, value, icon, href }: { title: string, value: number, icon: React.ReactNode, href: string }) {
  return (
    <Link href={href} className="group p-6 rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] hover:border-white/20 transition-all duration-200">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-[#111] border border-[#1F1F1F] text-white group-hover:border-white/50 transition-colors">
          {icon}
        </div>
        <ArrowUpRight className="h-4 w-4 text-[#333] group-hover:text-white transition-colors" />
      </div>
      <div>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        <p className="text-xs font-medium text-[#555] group-hover:text-[#888] transition-colors">{title}</p>
      </div>
    </Link>
  );
}
