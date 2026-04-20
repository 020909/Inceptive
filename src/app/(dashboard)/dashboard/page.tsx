"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCheck,
  CheckCircle2,
  FileText,
  Flag,
  Loader2,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type GoalSummary = {
  id: string;
  title: string;
  progress_percent: number;
};

type RecentTask = {
  id: string;
  title: string;
  completed_at: string;
};

type ActivityPoint = {
  label: string;
  date: string;
  count: number;
};

type AgentRun = {
  id: string;
  task: string;
  status: "completed" | "running" | "failed";
  durationMs: number;
  timestamp: string;
};

type DashboardState = {
  totalJobs: number;
  activeJobs: number;
  failedJobs: number;
  tasksCompleted: number;
  hoursSaved: number;
  reportCount: number;
  activeGoalsCount: number;
  activity: ActivityPoint[];
  topGoal: GoalSummary | null;
  recentTasks: RecentTask[];
  agentRuns: AgentRun[];
};

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function getDayKey(value: Date) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function buildActivity(values?: Array<{ completed_at?: string | null }>) {
  const start = startOfDay(addDays(new Date(), -6));
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: getDayKey(date),
      count: 0,
    };
  });

  if (!values?.length) return points;

  const counts = new Map<string, number>();
  values.forEach((task) => {
    if (!task.completed_at) return;
    const key = getDayKey(new Date(task.completed_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const withCounts = points.map((point) => ({
    ...point,
    count: counts.get(point.date) ?? 0,
  }));

  return withCounts;
}

function formatDuration(durationMs: number) {
  if (durationMs < 60_000) {
    return `${Math.max(1, Math.round(durationMs / 1000))}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanizeJobKind(kind: string) {
  return kind
    .split(".")
    .map((part) => part.replace(/-/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" / ");
}

function createEmptyState(): DashboardState {
  return {
    totalJobs: 0,
    activeJobs: 0,
    failedJobs: 0,
    tasksCompleted: 0,
    hoursSaved: 0,
    reportCount: 0,
    activeGoalsCount: 0,
    activity: buildActivity(),
    topGoal: null,
    recentTasks: [],
    agentRuns: [],
  };
}

function StatusBadge({ status }: { status: AgentRun["status"] }) {
  const tone =
    status === "completed"
      ? "bg-[rgba(52,199,89,0.12)] text-[#7dff9d]"
      : status === "running"
        ? "bg-[rgba(245,165,36,0.12)] text-[#ffbe5c]"
        : "bg-[rgba(255,93,93,0.12)] text-[#ff8b8b]";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {status === "completed" ? "Completed" : status === "running" ? "Running" : "Failed"}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  footer,
  chart,
}: {
  title: string;
  value: string;
  subtitle?: string;
  footer?: React.ReactNode;
  chart?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6",
        "shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]"
      )}
    >
      <p className="text-sm text-[var(--fg-muted)]">{title}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)]">{value}</p>
          {subtitle ? <p className="mt-1 text-sm text-[var(--fg-muted)]">{subtitle}</p> : null}
        </div>
        {footer}
      </div>
      {chart ? <div className="mt-5 h-16">{chart}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardState>(createEmptyState);
  const [loading, setLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session?.access_token) {
      setDashboard(createEmptyState());
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const supabase = createClient();
      const activityStart = startOfDay(addDays(new Date(), -6)).toISOString();

      const [
        taskCountRes,
        recentTasksRes,
        activityTasksRes,
        goalsRes,
        reportsCountRes,
        weeklyReportRes,
        jobsRes,
      ] = await Promise.allSettled([
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("completed_at", "is", null),
        supabase
          .from("tasks")
          .select("id,title,completed_at")
          .eq("user_id", user.id)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(4),
        supabase
          .from("tasks")
          .select("id,completed_at")
          .eq("user_id", user.id)
          .not("completed_at", "is", null)
          .gte("completed_at", activityStart)
          .order("completed_at", { ascending: true }),
        supabase
          .from("goals")
          .select("id,title,progress_percent")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("progress_percent", { ascending: false })
          .limit(4),
        supabase
          .from("research_reports")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("weekly_reports")
          .select("hours_worked,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1),
        fetch("/api/agent/jobs", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error("Could not load agent jobs");
          }

          return (await response.json()) as {
            jobs?: Array<{
              id: string;
              kind: string;
              status: string;
              created_at: string;
              updated_at: string;
              last_run_at?: string | null;
            }>;
          };
        }),
      ]);

      if (cancelled) return;

      const completedTaskCount =
        taskCountRes.status === "fulfilled" ? taskCountRes.value.count ?? 0 : 0;
      const recentTasks =
        recentTasksRes.status === "fulfilled" ? (recentTasksRes.value.data ?? []) as RecentTask[] : [];
      const activityTasks =
        activityTasksRes.status === "fulfilled" ? (activityTasksRes.value.data ?? []) as Array<{ completed_at?: string | null }> : [];
      const goals =
        goalsRes.status === "fulfilled" ? (goalsRes.value.data ?? []) as GoalSummary[] : [];
      const reportsCount =
        reportsCountRes.status === "fulfilled" ? reportsCountRes.value.count ?? 0 : 0;
      const latestReport =
        weeklyReportRes.status === "fulfilled" ? weeklyReportRes.value.data?.[0] : null;
      const jobs =
        jobsRes.status === "fulfilled" ? jobsRes.value.jobs ?? [] : [];

      const visibleJobs = jobs.filter((job) => !job.kind.endsWith(".stub"));

      const agentRuns: AgentRun[] = visibleJobs
        .filter((job) => job.status !== "failed")
        .slice(0, 8)
        .map((job) => {
          const startedAt = job.last_run_at ? new Date(job.last_run_at).getTime() : new Date(job.created_at).getTime();
          const endedAt = job.status === "running" ? Date.now() : new Date(job.updated_at).getTime();
          const durationMs = Math.max(30_000, endedAt - startedAt);
          return {
            id: job.id,
            task: humanizeJobKind(job.kind),
            status:
              job.status === "running" || job.status === "pending"
                ? "running"
                : job.status === "failed"
                  ? "failed"
                  : "completed",
            durationMs,
            timestamp: job.updated_at || job.created_at,
          };
        });

      const activeJobs = visibleJobs.filter((job) => job.status === "running" || job.status === "pending").length;
      const failedJobs = visibleJobs.filter((job) => job.status === "failed").length;

      setDashboard({
        totalJobs: visibleJobs.length,
        activeJobs,
        failedJobs,
        tasksCompleted: completedTaskCount,
        hoursSaved:
          latestReport && typeof latestReport.hours_worked === "number" && latestReport.hours_worked > 0
            ? latestReport.hours_worked
            : 0,
        reportCount: reportsCount,
        activeGoalsCount: goals.length,
        activity: buildActivity(activityTasks),
        topGoal: goals[0] ?? null,
        recentTasks,
        agentRuns,
      });
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session?.access_token, user]);

  const sparklineData = dashboard.activity.slice(-7);
  const goalStatusLabel = dashboard.topGoal
    ? dashboard.topGoal.progress_percent >= 65
      ? "On track"
      : "Needs attention"
    : "No active goal";
  const hasActivity = dashboard.activity.some((point) => point.count > 0);

  return (
    <div className="animate-fade-in-up page-enter">
      <div className="page-frame max-w-[94rem]">
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">
            <Sparkles size={12} />
            Analytics Overview
          </div>
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] md:text-4xl">
              Your AI operations, at a glance.
            </h1>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Agent Jobs"
            value={String(dashboard.totalJobs)}
            subtitle={
              dashboard.totalJobs > 0
                ? `${dashboard.activeJobs} running • ${dashboard.failedJobs} failed`
                : "No agent runs yet"
            }
            footer={<Sparkles className="h-5 w-5 text-[var(--accent)]" />}
          />

          <StatCard
            title="Tasks Completed"
            value={String(dashboard.tasksCompleted)}
            chart={
              chartsReady ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={64}>
                  <LineChart data={sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={false}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-lg bg-[var(--bg-elevated)]" />
              )
            }
          />

          <StatCard
            title="Hours Saved by AI"
            value={String(dashboard.hoursSaved)}
            subtitle={dashboard.hoursSaved > 0 ? "from latest weekly report" : "No weekly report yet"}
            footer={<CheckCheck className="h-5 w-5 text-[var(--accent)]" />}
          />

          <StatCard
            title="Research Reports"
            value={String(dashboard.reportCount)}
            footer={<FileText className="h-5 w-5 text-[var(--fg-secondary)]" />}
          />

          <StatCard
            title="Active Goals"
            value={String(dashboard.activeGoalsCount)}
            footer={
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--fg-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                {goalStatusLabel}
              </span>
            }
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <section className="rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
            <div className="mb-6">
              <p className="text-sm text-[var(--fg-muted)]">Task Volume</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--fg-primary)]">Completed tasks — last 7 days</h2>
            </div>
            <div className="h-[320px]">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
                  <BarChart data={dashboard.activity} barCategoryGap={10}>
                    <CartesianGrid vertical={false} stroke="var(--border-default)" strokeDasharray="0" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#87867f", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#87867f", fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                      contentStyle={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "12px",
                        color: "var(--fg-primary)",
                      }}
                      labelStyle={{ color: "var(--fg-secondary)" }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--fg-secondary)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-2xl bg-[var(--bg-elevated)]" />
              )}
            </div>
            {!hasActivity ? (
              <p className="mt-4 text-sm text-[var(--fg-muted)]">
                No completed tasks have been recorded in the last 7 days.
              </p>
            ) : null}
          </section>

          <section className="rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
            <div className="mb-6">
              <p className="text-sm text-[var(--fg-muted)]">Current Priority</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--fg-primary)]">
                {dashboard.topGoal?.title ?? "No active goal selected"}
              </h2>
            </div>

            {dashboard.topGoal ? (
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm text-[var(--fg-secondary)]">
                    <Flag size={16} className="text-[var(--accent)]" />
                    Goal progress
                  </span>
                  <span className="text-sm font-medium text-[var(--fg-primary)]">
                    {dashboard.topGoal.progress_percent}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-overlay)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${dashboard.topGoal.progress_percent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--fg-muted)]">
                Create or activate a goal to track progress here.
              </div>
            )}

            <div className="mt-6">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Recently completed by Inceptive
              </p>
              {dashboard.recentTasks.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.recentTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(52,199,89,0.14)] text-[var(--success)]">
                          <CheckCircle2 size={15} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--fg-primary)]">{task.title}</p>
                          <p className="mt-1 text-xs text-[var(--fg-muted)]">
                            {formatTimeAgo(new Date(task.completed_at))}
                          </p>
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-xs text-[var(--fg-muted)]">
                        {formatTimestamp(task.completed_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-6 text-sm text-[var(--fg-muted)]">
                  Completed tasks will appear here after Inceptive finishes work for you.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
          <div className="mb-5">
            <p className="text-sm text-[var(--fg-muted)]">Agent Activity Log</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--fg-primary)]">Live Agent Activity</h2>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.agentRuns.length > 0 ? (
                dashboard.agentRuns.slice(0, 8).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium text-[var(--fg-primary)]">{run.task}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>{formatDuration(run.durationMs)}</TableCell>
                    <TableCell>{formatTimestamp(run.timestamp)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-[var(--fg-muted)]">
                    No agent activity has been recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
