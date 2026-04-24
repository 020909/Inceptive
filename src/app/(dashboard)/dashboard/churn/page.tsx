"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BrainCircuit, Clock3, Loader2, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getJobStatus,
  listChurnMemories,
  listChurnSignals,
  runChurnAgent,
  scheduleAgentRun,
  type ChurnAccount,
  type ChurnMemory,
  type ChurnResponse,
  type JobStatusItem,
} from "@/lib/backend-client";
import { formatTimeAgo, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EMPTY_STATE: ChurnResponse = {
  last_run_at: null,
  count: 0,
  accounts: [],
};

function formatTimestamp(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return `${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} (${formatTimeAgo(date)})`;
}

function riskClasses(risk: ChurnAccount["churn_risk"]) {
  if (risk === "high") {
    return "border border-[rgba(255,93,93,0.24)] bg-[rgba(255,93,93,0.12)] text-[#ff9c9c]";
  }
  if (risk === "medium") {
    return "border border-[rgba(245,165,36,0.24)] bg-[rgba(245,165,36,0.12)] text-[#ffd07d]";
  }
  return "border border-[rgba(52,199,89,0.24)] bg-[rgba(52,199,89,0.12)] text-[#91f3ae]";
}

function scoreClasses(score: number) {
  if (score < 40) return "text-[#ff9c9c]";
  if (score < 70) return "text-[#ffd07d]";
  return "text-[#91f3ae]";
}

function planLabel(plan: string | null) {
  if (!plan) return "Unknown";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export default function ChurnDashboardPage() {
  const { session, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ChurnResponse>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [memoryItems, setMemoryItems] = useState<ChurnMemory[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatusItem | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.access_token ?? null;

  const loadSignals = useCallback(async () => {
    if (!accessToken) {
      setData(EMPTY_STATE);
      setLoading(false);
      return;
    }

    setError(null);
    const [next, memories, status] = await Promise.all([
      listChurnSignals(accessToken),
      user ? listChurnMemories(user.id, accessToken) : Promise.resolve({ count: 0, memories: [] }),
      user ? getJobStatus(user.id, "churn_agent", accessToken) : Promise.resolve({ count: 0, jobs: [] }),
    ]);
    setData(next);
    setMemoryItems(memories.memories);
    setJobStatus(status.jobs[0] ?? null);
    setLoading(false);
  }, [accessToken, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setData(EMPTY_STATE);
      return;
    }

    void loadSignals().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to load churn data.");
      setLoading(false);
    });
  }, [authLoading, user, loadSignals]);

  const onRunAgent = useCallback(async () => {
    if (!accessToken) return;
    setRunning(true);
    setError(null);
    try {
      const next = await runChurnAgent(accessToken);
      setData(next);
      if (user) {
        const [memories, status] = await Promise.all([
          listChurnMemories(user.id, accessToken),
          getJobStatus(user.id, "churn_agent", accessToken),
        ]);
        setMemoryItems(memories.memories);
        setJobStatus(status.jobs[0] ?? null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to run churn agent.");
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, [accessToken, user]);

  const onToggleSchedule = useCallback(async (enabled: boolean) => {
    if (!accessToken || !user) return;
    setScheduleLoading(true);
    setError(null);
    try {
      await scheduleAgentRun(
        {
          user_id: user.id,
          agent_id: "churn_agent",
          enabled,
          interval_minutes: 1440,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
        accessToken
      );
      const status = await getJobStatus(user.id, "churn_agent", accessToken);
      setJobStatus(status.jobs[0] ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update schedule.");
    } finally {
      setScheduleLoading(false);
    }
  }, [accessToken, user]);

  const summary = useMemo(() => {
    const healthy = data.accounts.filter((account) => account.churn_risk === "healthy").length;
    const medium = data.accounts.filter((account) => account.churn_risk === "medium").length;
    const high = data.accounts.filter((account) => account.churn_risk === "high").length;
    return { healthy, medium, high };
  }, [data.accounts]);

  const scheduleEnabled = jobStatus?.schedule.enabled ?? false;
  const lastRunLabel = jobStatus?.last_run?.completed_at || jobStatus?.schedule.last_run_at || data.last_run_at;
  const lastRunStatus = jobStatus?.last_run?.status || jobStatus?.schedule.last_run_status || "success";

  return (
    <div className="min-h-full px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(8,12,24,0.94))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.16),transparent_30%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(96,165,250,0.24)] bg-[rgba(59,130,246,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b7d4ff]">
              <Sparkles className="h-3.5 w-3.5" />
              Churn Prevention Agent
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-[2.2rem]">Customer risk radar</h1>
              <p className="mt-2 max-w-2xl text-sm text-[rgba(226,232,240,0.72)]">
                Monitor account health across login recency, weekly usage velocity, and support drag before revenue walks.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[rgba(226,232,240,0.72)]">
              <div className="glass-card rounded-2xl px-4 py-3">
                <span className="block text-[rgba(226,232,240,0.56)]">Last run</span>
                <span className="mt-1 block text-sm font-medium text-white">{formatTimestamp(data.last_run_at)}</span>
              </div>
              <div className="glass-card rounded-2xl px-4 py-3">
                <span className="block text-[rgba(226,232,240,0.56)]">Accounts tracked</span>
                <span className="mt-1 block text-sm font-medium text-white">{data.count}</span>
              </div>
              <div className="glass-card rounded-2xl px-4 py-3">
                <span className="block text-[rgba(226,232,240,0.56)]">Last run badge</span>
                <span className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-white">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      lastRunStatus === "failed"
                        ? "bg-[#ff6b6b]"
                        : lastRunStatus === "running"
                          ? "bg-[#f5a524]"
                          : "bg-[#34c759]"
                    )}
                  />
                  {formatTimestamp(lastRunLabel)} · {lastRunStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="glass-card min-w-[132px] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#91f3ae]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Healthy
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.healthy}</p>
            </div>
            <div className="glass-card min-w-[132px] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#ffd07d]">
                <Activity className="h-3.5 w-3.5" />
                Medium
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.medium}</p>
            </div>
            <div className="glass-card min-w-[132px] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#ff9c9c]">
                <AlertTriangle className="h-3.5 w-3.5" />
                High risk
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.high}</p>
            </div>
            <Button
              onClick={() => void onRunAgent()}
              disabled={running || authLoading || !user}
              className="btn-premium btn-accent-glow h-auto rounded-2xl border border-[rgba(96,165,250,0.24)] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
            >
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              {data.accounts.length === 0 ? "Run your first churn scan" : "Run Agent"}
            </Button>
            <div className="glass-card flex min-w-[220px] items-center justify-between rounded-2xl px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[rgba(226,232,240,0.56)]">Scheduled runs</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {scheduleEnabled ? "Daily auto-runs enabled" : "Auto-runs disabled"}
                </p>
              </div>
              <button
                type="button"
                disabled={scheduleLoading || authLoading || !user}
                onClick={() => void onToggleSchedule(!scheduleEnabled)}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors",
                  scheduleEnabled ? "bg-[var(--accent)]" : "bg-[rgba(255,255,255,0.16)]"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
                    scheduleEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Agent Memory</h2>
              <p className="text-sm text-[var(--fg-muted)]">The last 3 churn memories retrieved for your account.</p>
            </div>
          </div>
          {memoryItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-4 py-8 text-sm text-[var(--fg-muted)]">
              No stored churn memories yet. Run the agent once and this panel will start showing prior findings.
            </div>
          ) : (
            <div className="space-y-3">
              {memoryItems.slice(0, 3).map((memory) => (
                <div key={memory.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-4 py-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--fg-muted)]">
                    <span className="capitalize">{memory.metadata?.scope || "user"} memory</span>
                    <span>{formatTimestamp(memory.updated_at || memory.created_at || null)}</span>
                  </div>
                  <p className="text-sm leading-6 text-[var(--fg-primary)]">{memory.memory}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Scheduled Runs</h2>
              <p className="text-sm text-[var(--fg-muted)]">Daily auto-run status for the churn agent.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">Next run</div>
              <div className="mt-2 text-sm font-medium text-[var(--fg-primary)]">
                {jobStatus?.schedule.next_run_at ? formatTimestamp(jobStatus.schedule.next_run_at) : "Not scheduled"}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">Last run status</div>
              <div className="mt-2 text-sm font-medium text-[var(--fg-primary)]">
                {jobStatus?.last_run?.status || jobStatus?.schedule.last_run_status || "No runs yet"}
              </div>
              {jobStatus?.schedule.last_error ? (
                <p className="mt-2 text-xs text-[#ff9c9c]">{jobStatus.schedule.last_error}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
        {error ? (
          <div className="mb-4 rounded-2xl border border-[rgba(255,93,93,0.18)] bg-[rgba(255,93,93,0.08)] px-4 py-3 text-sm text-[#ff9c9c]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center text-sm text-[var(--fg-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading churn telemetry…
          </div>
        ) : data.accounts.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No churn signals yet"
            description="Run the churn prevention agent to score account health and surface the riskiest customers first."
            actionLabel="Run your first churn scan"
            onAction={() => void onRunAgent()}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Health Score</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Usage Trend</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead>Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.accounts.map((account) => (
                <TableRow key={account.user_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--fg-primary)]">{account.account_name}</span>
                      <span className="text-xs text-[var(--fg-muted)]">{account.email || "No email"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize", riskClasses(account.churn_risk))}>
                      {account.churn_risk}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-lg font-semibold", scoreClasses(account.health_score))}>
                        {account.health_score}
                      </span>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--bg-overlay)]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            account.health_score < 40
                              ? "bg-[#ff6b6b]"
                              : account.health_score < 70
                                ? "bg-[#f5a524]"
                                : "bg-[#34c759]"
                          )}
                          style={{ width: `${Math.max(6, account.health_score)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatTimestamp(account.last_login_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="text-[var(--fg-primary)]">{account.usage_this_week} this week</span>
                      <span className="text-[var(--fg-muted)]">{account.usage_last_week} last week</span>
                    </div>
                  </TableCell>
                  <TableCell>{account.support_ticket_count}</TableCell>
                  <TableCell>{planLabel(account.plan)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
