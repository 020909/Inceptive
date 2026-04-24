"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  CheckCircle2,
  Circle,
  DollarSign,
  Loader2,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import {
  getJobStatus,
  getRevenueSummary,
  listRevenueSignals,
  resolveRevenueSignal,
  runRevenueAgent,
  scheduleAgentRun,
  type JobStatusItem,
  type RevenueRunResponse,
  type RevenueSeverity,
  type RevenueSignal,
  type RevenueSignalType,
  type RevenueSummary,
} from "@/lib/backend-client";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SIGNAL_LABELS: Record<RevenueSignalType, string> = {
  expiring_contract: "Expiring Contracts",
  billing_anomaly: "Billing Anomalies",
  missed_upsell: "Missed Upsells",
  payment_failure: "Payment Failures",
  inactive_high_value: "Inactive High-Value",
  discount_abuse: "Discount Abuse",
};

const EMPTY_SUMMARY: RevenueSummary = {
  total_open_leakage: 0,
  critical_count: 0,
  warning_count: 0,
  signals_resolved_this_month: 0,
  estimated_recovered: 0,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

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

function severityTone(severity: RevenueSeverity) {
  if (severity === "critical") return "text-[#ff8e8e]";
  if (severity === "warning") return "text-[#ffd07d]";
  return "text-[#7cc9ff]";
}

function severityDot(severity: RevenueSeverity) {
  if (severity === "critical") return "bg-[#ff5d5d]";
  if (severity === "warning") return "bg-[#f5a524]";
  return "bg-[#4da3ff]";
}

function severityBadge(severity: RevenueSeverity) {
  if (severity === "critical") return "border border-[rgba(255,93,93,0.22)] bg-[rgba(255,93,93,0.1)] text-[#ff9c9c]";
  if (severity === "warning") return "border border-[rgba(245,165,36,0.22)] bg-[rgba(245,165,36,0.1)] text-[#ffd07d]";
  return "border border-[rgba(77,163,255,0.22)] bg-[rgba(77,163,255,0.1)] text-[#9dd1ff]";
}

function accountLabel(signal: RevenueSignal, currentUserId: string | undefined, email: string | null | undefined) {
  if (currentUserId && signal.account_id === currentUserId) {
    return email?.split("@")[0] || "Your account";
  }
  return `Account ${signal.account_id.slice(0, 8)}`;
}

export default function RevenueDashboardPage() {
  const { session, user, loading: authLoading } = useAuth();
  const accessToken = session?.access_token ?? null;
  const supabase = createClient();

  const [summary, setSummary] = useState<RevenueSummary>(EMPTY_SUMMARY);
  const [signals, setSignals] = useState<RevenueSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Record<string, boolean>>({});
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatusItem | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [selectedSignalType, setSelectedSignalType] = useState<RevenueSignalType | "all">("all");
  const [selectedSeverity, setSelectedSeverity] = useState<RevenueSeverity | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const loadRevenue = useCallback(async () => {
    if (!accessToken) {
      setSignals([]);
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    const [nextSummary, nextSignals, nextStatus] = await Promise.all([
      getRevenueSummary(accessToken),
      listRevenueSignals({ limit: 250 }, accessToken),
      user ? getJobStatus(user.id, "revenue_agent", accessToken) : Promise.resolve({ count: 0, jobs: [] }),
    ]);

    setSummary(nextSummary);
    setSignals(nextSignals.signals);
    setJobStatus(nextStatus.jobs[0] ?? null);
    setLastScanAt(
      nextStatus.jobs[0]?.last_run?.completed_at ||
        nextStatus.jobs[0]?.schedule.last_run_at ||
        nextSignals.signals.reduce<string | null>((latest, signal) => {
          if (!signal.detected_at) return latest;
          if (!latest) return signal.detected_at;
          return new Date(signal.detected_at) > new Date(latest) ? signal.detected_at : latest;
        }, null)
    );
    setLoading(false);
  }, [accessToken, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setSignals([]);
      setSummary(EMPTY_SUMMARY);
      return;
    }

    void loadRevenue().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to load revenue intelligence.");
      setLoading(false);
    });
  }, [authLoading, user, loadRevenue]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`revenue-page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "revenue_signals",
          filter: `account_id=eq.${user.id}`,
        },
        () => {
          void loadRevenue().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, user?.id, loadRevenue]);

  const handleRunNow = useCallback(async () => {
    if (!accessToken) return;
    setRunning(true);
    setError(null);
    try {
      const result: RevenueRunResponse = await runRevenueAgent(accessToken);
      setLastScanAt(result.detected_at);
      await loadRevenue();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to run revenue agent.");
    } finally {
      setRunning(false);
    }
  }, [accessToken, loadRevenue]);

  const handleResolve = useCallback(async (signalId: string) => {
    if (!accessToken) return;
    setResolvingIds((current) => ({ ...current, [signalId]: true }));
    setError(null);
    try {
      await resolveRevenueSignal(signalId, resolutionNotes[signalId] || null, accessToken);
      setResolvedIds((current) => [...current, signalId]);
      window.setTimeout(() => {
        setSignals((current) => current.filter((item) => item.id !== signalId));
        setResolvedIds((current) => current.filter((id) => id !== signalId));
        setResolutionNotes((current) => {
          const next = { ...current };
          delete next[signalId];
          return next;
        });
      }, 650);
      await loadRevenue();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to resolve revenue signal.");
    } finally {
      setResolvingIds((current) => ({ ...current, [signalId]: false }));
    }
  }, [accessToken, loadRevenue, resolutionNotes]);

  const handleToggleSchedule = useCallback(async (enabled: boolean) => {
    if (!accessToken || !user) return;
    setScheduleLoading(true);
    setError(null);
    try {
      await scheduleAgentRun(
        {
          user_id: user.id,
          agent_id: "revenue_agent",
          enabled,
          interval_minutes: 720,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
        accessToken
      );
      const nextStatus = await getJobStatus(user.id, "revenue_agent", accessToken);
      setJobStatus(nextStatus.jobs[0] ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update revenue schedule.");
    } finally {
      setScheduleLoading(false);
    }
  }, [accessToken, user]);

  const signalTypeCounts = useMemo(() => {
    return signals.reduce<Record<string, number>>((acc, signal) => {
      acc[signal.signal_type] = (acc[signal.signal_type] || 0) + 1;
      return acc;
    }, {});
  }, [signals]);

  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => {
      if (selectedSignalType !== "all" && signal.signal_type !== selectedSignalType) return false;
      if (selectedSeverity !== "all" && signal.severity !== selectedSeverity) return false;
      return true;
    });
  }, [signals, selectedSignalType, selectedSeverity]);

  const scheduleEnabled = jobStatus?.schedule.enabled ?? false;

  return (
    <div className="min-h-full px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(8,12,24,0.94))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_32%)]" />
        <div className="relative space-y-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(248,113,113,0.24)] bg-[rgba(239,68,68,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffc1c1]">
              <BadgeDollarSign className="h-3.5 w-3.5" />
              Revenue Intelligence Agent
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-[2.2rem]">Revenue leakage command deck</h1>
              <p className="mt-2 max-w-3xl text-sm text-[rgba(226,232,240,0.72)]">
                Track expiring renewals, billing drift, missed expansion, payment failures, inactivity, and pricing compression before leakage compounds.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="glass-card rounded-3xl border border-[rgba(255,93,93,0.16)] bg-[rgba(255,93,93,0.06)] p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-[#ffb4b4]">Total Revenue at Risk</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#ff9c9c]">
                {formatCurrency(summary.total_open_leakage)}
              </div>
              <p className="mt-2 text-sm text-[rgba(255,212,212,0.72)]">across {signals.length} open signals</p>
            </div>

            <div className="glass-card rounded-3xl border border-[rgba(255,93,93,0.16)] p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.14em] text-[#ffb4b4]">Critical Signals</div>
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white", summary.critical_count > 0 ? "bg-[#ff5d5d] animate-pulse" : "bg-[rgba(255,255,255,0.12)]")}>
                  {summary.critical_count > 0 ? "Urgent" : "Clear"}
                </span>
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{summary.critical_count}</div>
              <p className="mt-2 text-sm text-[rgba(226,232,240,0.68)]">High-risk revenue exposures requiring immediate action.</p>
            </div>

            <div className="glass-card rounded-3xl border border-[rgba(52,199,89,0.18)] bg-[rgba(52,199,89,0.06)] p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#9df1b8]">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Recovered This Month
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#91f3ae]">
                {formatCurrency(summary.estimated_recovered)}
              </div>
              <p className="mt-2 text-sm text-[rgba(198,255,214,0.72)]">{summary.signals_resolved_this_month} signals resolved this month</p>
            </div>

            <div className="glass-card rounded-3xl p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-[rgba(226,232,240,0.6)]">Last Scan</div>
              <div className="mt-3 text-lg font-semibold text-white">{formatTimestamp(lastScanAt)}</div>
              <Button
                onClick={() => void handleRunNow()}
                disabled={running || authLoading || !user}
                className="btn-premium btn-accent-glow mt-4 h-10 rounded-2xl border border-[rgba(96,165,250,0.24)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                Run Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Signal Type Breakdown</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Filter the queue by leakage pattern.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedSignalType("all")}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                selectedSignalType === "all"
                  ? "border-[rgba(96,165,250,0.24)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--fg-muted)]"
              )}
            >
              All Signals
            </button>
            {(Object.keys(SIGNAL_LABELS) as RevenueSignalType[]).map((signalType) => (
              <button
                key={signalType}
                type="button"
                onClick={() => setSelectedSignalType(signalType)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  selectedSignalType === signalType
                    ? "border-[rgba(96,165,250,0.24)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--fg-muted)]"
                )}
              >
                {SIGNAL_LABELS[signalType]} {signalTypeCounts[signalType] ? `• ${signalTypeCounts[signalType]}` : ""}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Revenue Signals</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Sorted by dollar impact so the highest-value leaks stay at the top.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "critical", "warning", "info"] as const).map((severity) => (
              <button
                key={severity}
                type="button"
                onClick={() => setSelectedSeverity(severity)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  selectedSeverity === severity
                    ? "border-[rgba(96,165,250,0.24)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--fg-muted)]"
                )}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-[rgba(255,93,93,0.18)] bg-[rgba(255,93,93,0.08)] px-4 py-3 text-sm text-[#ff9c9c]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center text-sm text-[var(--fg-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading revenue signals…
          </div>
        ) : filteredSignals.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No revenue leakage detected"
            description="Run your first scan to surface expiring renewals, billing anomalies, and missed expansion opportunities."
            actionLabel="Run your first scan"
            onAction={() => void handleRunNow()}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Account ID / Name</TableHead>
                <TableHead>Signal Type</TableHead>
                <TableHead>Dollar Impact</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Recommended Action</TableHead>
                <TableHead>Detected At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSignals.map((signal) => {
                const isResolved = resolvedIds.includes(signal.id);
                return (
                  <TableRow
                    key={signal.id}
                    className={cn(
                      "transition-all duration-500",
                      isResolved && "bg-[rgba(52,199,89,0.08)] opacity-40 scale-[0.99]"
                    )}
                  >
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium capitalize", severityBadge(signal.severity))}>
                        {isResolved ? <CheckCircle2 className="h-3.5 w-3.5 text-[#34c759] animate-in zoom-in-50 duration-300" /> : <Circle className={cn("h-2.5 w-2.5 fill-current", severityDot(signal.severity), severityTone(signal.severity))} />}
                        {signal.severity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--fg-primary)]">
                          {accountLabel(signal, user?.id, user?.email)}
                        </span>
                        <span className="text-xs text-[var(--fg-muted)]">{signal.account_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--fg-primary)]">{SIGNAL_LABELS[signal.signal_type]}</TableCell>
                    <TableCell className="text-base font-semibold text-[var(--fg-primary)]">{formatCurrency(signal.dollar_impact)}</TableCell>
                    <TableCell className="max-w-[28ch] text-sm text-[var(--fg-secondary)]">{signal.description}</TableCell>
                    <TableCell className="max-w-[28ch] text-sm text-[var(--fg-secondary)]">{signal.recommended_action}</TableCell>
                    <TableCell className="text-sm text-[var(--fg-muted)]">{formatTimeAgo(new Date(signal.detected_at))}</TableCell>
                    <TableCell className="min-w-[260px]">
                      {isResolved ? (
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-[#34c759]">
                          <CheckCircle2 className="h-4 w-4" />
                          Resolved
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={resolutionNotes[signal.id] || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setResolutionNotes((current) => ({ ...current, [signal.id]: value }));
                            }}
                            placeholder="Add a resolution note"
                            className="h-9 rounded-xl border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--fg-primary)]"
                          />
                          <Button
                            size="sm"
                            onClick={() => void handleResolve(signal.id)}
                            disabled={Boolean(resolvingIds[signal.id])}
                            className="h-9 rounded-xl bg-[rgba(52,199,89,0.14)] px-3 text-sm font-semibold text-[#34c759] hover:bg-[rgba(52,199,89,0.22)]"
                          >
                            {resolvingIds[signal.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Resolve
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="mt-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-[var(--fg-primary)]">
              <DollarSign className="h-5 w-5 text-[var(--accent)]" />
              Schedule Toggle
            </div>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Keep the revenue agent running every 12 hours so leakage gets surfaced automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-1.5">
                Status: {scheduleEnabled ? "Enabled" : "Disabled"}
              </span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-1.5">
                Next run: {jobStatus?.schedule.next_run_at ? formatTimestamp(jobStatus.schedule.next_run_at) : "Not scheduled"}
              </span>
            </div>
          </div>

          <div className="glass-card flex min-w-[240px] items-center justify-between rounded-2xl px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[rgba(226,232,240,0.56)]">12-hour auto-scans</p>
              <p className="mt-1 text-sm font-medium text-white">{scheduleEnabled ? "Revenue monitoring live" : "Auto-scans disabled"}</p>
            </div>
            <button
              type="button"
              disabled={scheduleLoading || authLoading || !user}
              onClick={() => void handleToggleSchedule(!scheduleEnabled)}
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
      </section>
    </div>
  );
}
