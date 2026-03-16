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

interface DashboardData {
  stats: {
    tasks: number;
    emails: number;
    research: number;
    social: number;
  };
  goals: any[];
  recentTasks: any[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch("/api/dashboard", {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const d = await res.json();
          setData(d);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchDashboard();
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
            value={data?.stats.tasks || 0} 
            icon={<Zap className="h-5 w-5" />} 
            href="/tasks"
          />
          <StatCard 
            title="Research Reports" 
            value={data?.stats.research || 0} 
            icon={<FileText className="h-5 w-5" />} 
            href="/research"
          />
          <StatCard 
            title="Emails Sent" 
            value={data?.stats.emails || 0} 
            icon={<Mail className="h-5 w-5" />} 
            href="/email"
          />
          <StatCard 
            title="Social Posts" 
            value={data?.stats.social || 0} 
            icon={<Share2 className="h-5 w-5" />} 
            href="/social"
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
            
            {data?.recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#555]">
                <Clock className="h-10 w-10 mb-4 opacity-20" />
                <p>No recent activity found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.recentTasks.map((task: any) => (
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
              <h2 className="text-lg font-bold text-white">Active Goals</h2>
              <Link href="/goals" className="text-xs text-[#888] hover:text-white transition-colors flex items-center">
                Manage <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-6">
              {data?.goals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#555]">
                  <Target className="h-10 w-10 mb-4 opacity-20" />
                  <p className="text-sm">No active goals.</p>
                </div>
              ) : (
                data?.goals.map((goal: any) => (
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
