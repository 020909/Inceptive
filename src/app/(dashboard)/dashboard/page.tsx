"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingStats } from "@/components/ui/loading-skeleton";
import type { Task, Goal } from "@/types/database";
import { LayoutDashboard, CheckCircle2 } from "lucide-react";

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 transition-all duration-200 hover:border-[#333333]">
      <p className="text-xs font-medium text-[#888888] uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function MorningReport({ weekDates }: { weekDates: string }) {
  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
          Inceptive Weekly Report
        </h2>
        <span className="text-xs text-[#555555]">{weekDates}</span>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-sm text-emerald-500">All systems running</span>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const typeColors: Record<string, string> = {
    research: "bg-[#1F1F1F] text-[#888888]",
    email: "bg-[#1F1F1F] text-[#888888]",
    social: "bg-[#1F1F1F] text-[#888888]",
    browser: "bg-[#1F1F1F] text-[#888888]",
    general: "bg-[#1F1F1F] text-[#888888]",
  };

  const time = task.completed_at
    ? new Date(task.completed_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1F1F1F] last:border-b-0">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-4 w-4 text-[#555555]" />
        <span className="text-sm text-white">{task.title}</span>
        <span
          className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${
            typeColors[task.type] || typeColors.general
          }`}
        >
          {task.type}
        </span>
      </div>
      <span className="text-xs text-[#555555]">{time}</span>
    </div>
  );
}

function GoalProgressItem({ goal }: { goal: Goal }) {
  return (
    <div className="py-3 border-b border-[#1F1F1F] last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white">{goal.title}</span>
        <span className="text-xs text-[#888888]">{goal.progress_percent}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#1F1F1F]">
        <div
          className="h-full rounded-full bg-white transition-all duration-500"
          style={{ width: `${goal.progress_percent}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState({
    hoursWorked: 0,
    tasksCompleted: 0,
    emailsSent: 0,
    goalsActive: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [tasksRes, goalsRes, emailsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("completed_at", { ascending: false })
          .limit(10),
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("emails")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "sent"),
      ]);

      setTasks((tasksRes.data as Task[]) || []);
      setGoals((goalsRes.data as Goal[]) || []);

      const completedTasks = (tasksRes.data || []).filter(
        (t: Task) => t.completed_at
      );

      setStats({
        hoursWorked: Math.round(completedTasks.length * 1.5),
        tasksCompleted: completedTasks.length,
        emailsSent: emailsRes.data?.length || 0,
        goalsActive: (goalsRes.data || []).length,
      });

      setLoading(false);
    };

    fetchData();
  }, [user, supabase]);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const weekDates = `${startOfWeek.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} — ${endOfWeek.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingStats />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <MorningReport weekDates={weekDates} />

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Hours Worked" value={`${stats.hoursWorked}h`} />
          <StatCard label="Tasks Completed" value={stats.tasksCompleted} />
          <StatCard label="Emails Sent" value={stats.emailsSent} />
          <StatCard label="Goals Active" value={stats.goalsActive} />
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tasks */}
          <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">
              Recent Tasks
            </h3>
            {tasks.length > 0 ? (
              tasks.map((task) => <TaskRow key={task.id} task={task} />)
            ) : (
              <EmptyState
                icon={LayoutDashboard}
                title="No tasks yet"
                description="Your AI agent will log tasks here as it works overnight."
              />
            )}
          </div>

          {/* Goal Progress */}
          <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">
              Goal Progress
            </h3>
            {goals.length > 0 ? (
              goals.map((goal) => (
                <GoalProgressItem key={goal.id} goal={goal} />
              ))
            ) : (
              <EmptyState
                icon={LayoutDashboard}
                title="No active goals"
                description="Set goals to track your AI's progress toward your objectives."
              />
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
