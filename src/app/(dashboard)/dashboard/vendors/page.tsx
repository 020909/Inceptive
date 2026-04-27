"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Circle,
  DollarSign,
  Loader2,
  RefreshCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import {
  getJobStatus,
  getVendorSummary,
  listVendorAlerts,
  parseVendorInvoice,
  resolveVendorAlert,
  runVendorAgent,
  scheduleAgentRun,
  type JobStatusItem,
  type ParseInvoiceResponse,
  type ParsedInvoicePayload,
  type VendorAlert,
  type VendorAlertType,
  type VendorSeverity,
  type VendorSummary,
} from "@/lib/backend-client";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const ALERT_LABELS: Record<VendorAlertType, string> = {
  sla_breach: "SLA Breaches",
  overbilling: "Overbilling",
  upcoming_renewal: "Upcoming Renewals",
  underperforming_vendor: "Underperforming Vendors",
};

const EMPTY_SUMMARY: VendorSummary = {
  total_vendors: 0,
  overbilling_detected: 0,
  renewals_due: 0,
  sla_breaches_this_month: 0,
  critical_count: 0,
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

function severityTone(severity: VendorSeverity) {
  if (severity === "critical") return "text-[#ff8e8e]";
  if (severity === "warning") return "text-[#ffd07d]";
  return "text-[#7cc9ff]";
}

function severityDot(severity: VendorSeverity) {
  if (severity === "critical") return "bg-[#ff5d5d]";
  if (severity === "warning") return "bg-[#f5a524]";
  return "bg-[#4da3ff]";
}

function severityBadge(severity: VendorSeverity) {
  if (severity === "critical") return "border border-[rgba(255,93,93,0.22)] bg-[rgba(255,93,93,0.1)] text-[#ff9c9c]";
  if (severity === "warning") return "border border-[rgba(245,165,36,0.22)] bg-[rgba(245,165,36,0.1)] text-[#ffd07d]";
  return "border border-[rgba(77,163,255,0.22)] bg-[rgba(77,163,255,0.1)] text-[#9dd1ff]";
}

export default function VendorsDashboardPage() {
  const { session, user, loading: authLoading } = useAuth();
  const accessToken = session?.access_token ?? null;
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [summary, setSummary] = useState<VendorSummary>(EMPTY_SUMMARY);
  const [alerts, setAlerts] = useState<VendorAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Record<string, boolean>>({});
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatusItem | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState<VendorAlertType | "all">("all");
  const [selectedSeverity, setSelectedSeverity] = useState<VendorSeverity | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<ParsedInvoicePayload | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceSaveLoading, setInvoiceSaveLoading] = useState(false);

  const loadVendorData = useCallback(async () => {
    if (!accessToken) {
      setAlerts([]);
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    const [nextSummary, nextAlerts, nextStatus] = await Promise.all([
      getVendorSummary(accessToken),
      listVendorAlerts({ limit: 250 }, accessToken),
      user ? getJobStatus(user.id, "vendor_agent", accessToken) : Promise.resolve({ count: 0, jobs: [] }),
    ]);

    setSummary(nextSummary);
    setAlerts(nextAlerts.alerts);
    setJobStatus(nextStatus.jobs[0] ?? null);
    setLastScanAt(
      nextStatus.jobs[0]?.last_run?.completed_at ||
        nextStatus.jobs[0]?.schedule.last_run_at ||
        nextAlerts.alerts.reduce<string | null>((latest, alert) => {
          if (!alert.detected_at) return latest;
          if (!latest) return alert.detected_at;
          return new Date(alert.detected_at) > new Date(latest) ? alert.detected_at : latest;
        }, null)
    );
    setLoading(false);
  }, [accessToken, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setAlerts([]);
      setSummary(EMPTY_SUMMARY);
      return;
    }

    void loadVendorData().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to load vendor intelligence.");
      setLoading(false);
    });
  }, [authLoading, user, loadVendorData]);

  useEffect(() => {
    const channel = supabase
      .channel("vendor-page:alerts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_alerts",
        },
        () => {
          void loadVendorData().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, loadVendorData]);

  const handleRunNow = useCallback(async () => {
    if (!accessToken) return;
    setRunning(true);
    setError(null);
    try {
      const result = await runVendorAgent(accessToken);
      setLastScanAt(result.detected_at);
      await loadVendorData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to run vendor agent.");
    } finally {
      setRunning(false);
    }
  }, [accessToken, loadVendorData]);

  const handleResolve = useCallback(async (alertId: string) => {
    if (!accessToken) return;
    setResolvingIds((current) => ({ ...current, [alertId]: true }));
    setError(null);
    try {
      await resolveVendorAlert(alertId, resolutionNotes[alertId] || null, accessToken);
      setResolvedIds((current) => [...current, alertId]);
      window.setTimeout(() => {
        setAlerts((current) => current.filter((item) => item.id !== alertId));
        setResolvedIds((current) => current.filter((id) => id !== alertId));
        setResolutionNotes((current) => {
          const next = { ...current };
          delete next[alertId];
          return next;
        });
      }, 650);
      await loadVendorData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to resolve vendor alert.");
    } finally {
      setResolvingIds((current) => ({ ...current, [alertId]: false }));
    }
  }, [accessToken, loadVendorData, resolutionNotes]);

  const handleToggleSchedule = useCallback(async (enabled: boolean) => {
    if (!accessToken || !user) return;
    setScheduleLoading(true);
    setError(null);
    try {
      await scheduleAgentRun(
        {
          user_id: user.id,
          agent_id: "vendor_agent",
          enabled,
          interval_minutes: 1440,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
        accessToken
      );
      const nextStatus = await getJobStatus(user.id, "vendor_agent", accessToken);
      setJobStatus(nextStatus.jobs[0] ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update vendor schedule.");
    } finally {
      setScheduleLoading(false);
    }
  }, [accessToken, user]);

  const handleInvoiceFile = useCallback(async (file: File) => {
    if (!accessToken) return;
    setInvoiceUploading(true);
    setError(null);
    try {
      const parsed = await parseVendorInvoice(file, { confirm: false }, accessToken);
      setInvoiceFile(file);
      setInvoicePreview(parsed.extracted);
      setInvoicePreviewOpen(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to parse invoice.");
    } finally {
      setInvoiceUploading(false);
    }
  }, [accessToken]);

  const confirmInvoiceSave = useCallback(async () => {
    if (!accessToken || !invoiceFile) return;
    setInvoiceSaveLoading(true);
    setError(null);
    try {
      const saved: ParseInvoiceResponse = await parseVendorInvoice(invoiceFile, { confirm: true }, accessToken);
      setInvoicePreview(saved.extracted);
      setInvoicePreviewOpen(false);
      setInvoiceFile(null);
      await loadVendorData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save parsed invoice.");
    } finally {
      setInvoiceSaveLoading(false);
    }
  }, [accessToken, invoiceFile, loadVendorData]);

  const alertTypeCounts = useMemo(() => {
    return alerts.reduce<Record<string, number>>((acc, alert) => {
      acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
      return acc;
    }, {});
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (selectedAlertType !== "all" && alert.alert_type !== selectedAlertType) return false;
      if (selectedSeverity !== "all" && alert.severity !== selectedSeverity) return false;
      return true;
    });
  }, [alerts, selectedAlertType, selectedSeverity]);

  const scheduleEnabled = jobStatus?.schedule.enabled ?? false;

  return (
    <div className="min-h-full px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(8,12,24,0.94))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_32%)]" />
        <div className="relative space-y-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(248,113,113,0.24)] bg-[rgba(239,68,68,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffc1c1]">
              <Building2 className="h-3.5 w-3.5" />
              Vendor Intelligence Agent
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-[2.2rem]">Vendor risk and spend control</h1>
              <p className="mt-2 max-w-3xl text-sm text-[rgba(226,232,240,0.72)]">
                Surface overbilling, SLA failures, renewal exposure, and underperforming vendors before they turn into procurement drag.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="glass-card rounded-3xl border border-[rgba(255,255,255,0.08)] p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-[rgba(226,232,240,0.68)]">Total Vendors</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{summary.total_vendors}</div>
              <p className="mt-2 text-sm text-[rgba(226,232,240,0.68)]">Active vendor relationships currently tracked.</p>
            </div>

            <div className="glass-card rounded-3xl border border-[rgba(255,93,93,0.16)] bg-[rgba(255,93,93,0.06)] p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-[#ffb4b4]">Overbilling Detected</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#ff9c9c]">
                {formatCurrency(summary.overbilling_detected)}
              </div>
              <p className="mt-2 text-sm text-[rgba(255,212,212,0.72)]">Open spend leakage identified across vendor invoices.</p>
            </div>

            <div className="glass-card rounded-3xl border border-[rgba(96,165,250,0.16)] bg-[rgba(59,130,246,0.06)] p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#b7d4ff]">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Renewals Due (60 days)
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{summary.renewals_due}</div>
              <p className="mt-2 text-sm text-[rgba(191,219,254,0.76)]">Contracts requiring review or renegotiation soon.</p>
            </div>

            <div className="glass-card rounded-3xl p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-[rgba(226,232,240,0.6)]">SLA Breaches This Month</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{summary.sla_breaches_this_month}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleRunNow()}
                  disabled={running || authLoading || !user}
                  className="btn-premium btn-accent-glow h-10 rounded-2xl border border-[rgba(96,165,250,0.24)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
                >
                  {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  Run Now
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={invoiceUploading || authLoading || !user}
                  className="h-10 rounded-2xl border-[var(--border-subtle)] bg-[rgba(255,255,255,0.04)] text-white"
                >
                  {invoiceUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload Invoice
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleInvoiceFile(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Alert Type Breakdown</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Filter the vendor queue by issue category.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedAlertType("all")}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                selectedAlertType === "all"
                  ? "border-[rgba(96,165,250,0.24)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--fg-muted)]"
              )}
            >
              All Alerts
            </button>
            {(Object.keys(ALERT_LABELS) as VendorAlertType[]).map((alertType) => (
              <button
                key={alertType}
                type="button"
                onClick={() => setSelectedAlertType(alertType)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  selectedAlertType === alertType
                    ? "border-[rgba(96,165,250,0.24)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--fg-muted)]"
                )}
              >
                {ALERT_LABELS[alertType]} {alertTypeCounts[alertType] ? `• ${alertTypeCounts[alertType]}` : ""}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Vendor Alerts</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Sorted by dollar impact so the most expensive vendor issues stay first.</p>
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
            Loading vendor alerts…
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No vendor issues detected"
            description="Run your first vendor scan to detect overbilling, SLA problems, and renewal risk."
            actionLabel="Run your first scan"
            onAction={() => void handleRunNow()}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Alert Type</TableHead>
                <TableHead>Dollar Impact</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Detected At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.map((alert) => {
                const isResolved = resolvedIds.includes(alert.id);
                return (
                  <TableRow
                    key={alert.id}
                    className={cn(
                      "transition-all duration-500",
                      isResolved && "bg-[rgba(52,199,89,0.08)] opacity-40 scale-[0.99]"
                    )}
                  >
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium capitalize", severityBadge(alert.severity))}>
                        {isResolved ? <CheckCircle2 className="h-3.5 w-3.5 text-[#34c759] animate-in zoom-in-50 duration-300" /> : <Circle className={cn("h-2.5 w-2.5 fill-current", severityDot(alert.severity), severityTone(alert.severity))} />}
                        {alert.severity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--fg-primary)]">{alert.vendors?.name || "Unknown Vendor"}</span>
                        <span className="text-xs text-[var(--fg-muted)]">{alert.vendor_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--fg-primary)]">{ALERT_LABELS[alert.alert_type]}</TableCell>
                    <TableCell className="text-base font-semibold text-[var(--fg-primary)]">{formatCurrency(alert.dollar_impact)}</TableCell>
                    <TableCell className="max-w-[34ch] text-sm text-[var(--fg-secondary)]">{alert.description}</TableCell>
                    <TableCell className="text-sm text-[var(--fg-muted)]">{formatTimeAgo(new Date(alert.detected_at))}</TableCell>
                    <TableCell className="min-w-[260px]">
                      {isResolved ? (
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-[#34c759]">
                          <CheckCircle2 className="h-4 w-4" />
                          Resolved
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={resolutionNotes[alert.id] || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setResolutionNotes((current) => ({ ...current, [alert.id]: value }));
                            }}
                            placeholder="Add a resolution note"
                            className="h-9 rounded-xl border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--fg-primary)]"
                          />
                          <Button
                            size="sm"
                            onClick={() => void handleResolve(alert.id)}
                            disabled={Boolean(resolvingIds[alert.id])}
                            className="h-9 rounded-xl bg-[rgba(52,199,89,0.14)] px-3 text-sm font-semibold text-[#34c759] hover:bg-[rgba(52,199,89,0.22)]"
                          >
                            {resolvingIds[alert.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
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
              Keep the vendor agent running every 24 hours so procurement issues surface automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-1.5">
                Status: {scheduleEnabled ? "Enabled" : "Disabled"}
              </span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-1.5">
                Last scan: {formatTimestamp(lastScanAt)}
              </span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-1.5">
                Next run: {jobStatus?.schedule.next_run_at ? formatTimestamp(jobStatus.schedule.next_run_at) : "Not scheduled"}
              </span>
            </div>
          </div>

          <div className="glass-card flex min-w-[240px] items-center justify-between rounded-2xl px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[rgba(226,232,240,0.56)]">Daily auto-scans</p>
              <p className="mt-1 text-sm font-medium text-white">{scheduleEnabled ? "Vendor monitoring live" : "Auto-scans disabled"}</p>
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

      <Dialog open={invoicePreviewOpen} onOpenChange={setInvoicePreviewOpen}>
        <DialogContent className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          {invoicePreview ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">Vendor</div>
                  <div className="mt-2 text-sm font-medium text-[var(--fg-primary)]">{invoicePreview.vendor_name || "Unknown"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">Amount</div>
                  <div className="mt-2 text-sm font-medium text-[var(--fg-primary)]">
                    {invoicePreview.amount !== null ? formatCurrency(invoicePreview.amount) : "Not found"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">Due Date</div>
                  <div className="mt-2 text-sm font-medium text-[var(--fg-primary)]">{formatTimestamp(invoicePreview.due_date)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">Line Items</div>
                {invoicePreview.line_items.length === 0 ? (
                  <div className="text-sm text-[var(--fg-muted)]">No line items extracted.</div>
                ) : (
                  <div className="space-y-2">
                    {invoicePreview.line_items.map((item, index) => (
                      <div key={`${item.description}-${index}`} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--fg-primary)]">{item.description}</span>
                        <span className="font-medium text-[var(--fg-primary)]">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">Raw Extract</div>
                <Textarea
                  readOnly
                  value={invoicePreview.raw_text}
                  className="min-h-48 rounded-2xl border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)]"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="bg-transparent p-0 pt-2" showCloseButton>
            <Button onClick={() => void confirmInvoiceSave()} disabled={invoiceSaveLoading || !invoiceFile} className="rounded-xl bg-[var(--accent)] text-white">
              {invoiceSaveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
