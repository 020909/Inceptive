"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Shield,
  RefreshCw,
  Search,
  X,
  Zap,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Bot,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AlertRow } from "@/types/compliance";

type AlertSeverity = "low" | "medium" | "high" | "critical";
type AlertStatus = "new" | "triaging" | "escalated" | "closed" | "false_positive";

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  low: "bg-slate-400",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  new: "New",
  triaging: "Triaging",
  escalated: "Escalated",
  closed: "Closed",
  false_positive: "False Positive",
};

const STATUS_COLORS: Record<AlertStatus, string> = {
  new: "bg-blue-500",
  triaging: "bg-amber-500",
  escalated: "bg-red-500",
  closed: "bg-slate-500",
  false_positive: "bg-emerald-500",
};

const SEVERITY_OPTIONS: { value: AlertSeverity | "all"; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_OPTIONS: { value: AlertStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "triaging", label: "Triaging" },
  { value: "escalated", label: "Escalated" },
  { value: "closed", label: "Closed" },
  { value: "false_positive", label: "False Positive" },
];

function escapePostgrest(str: string): string {
  return str.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export default function AmlTriagePage() {
  const { user, loading: authLoading } = useAuth();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<AlertRow | null>(null);
  const [triagingId, setTriagingId] = useState<string | null>(null);
  const itemsPerPage = 25;

  const fetchAlerts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      let query = supabase
        .from("alerts")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (severityFilter !== "all") query = query.eq("severity", severityFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (searchQuery.trim()) {
        const escaped = escapePostgrest(searchQuery.trim());
      query = query.or(`alert_number.ilike.%${escaped}%,entity_name.ilike.%${escaped}%,description.ilike.%${escaped}%`);
      }

      const from = (page - 1) * itemsPerPage;
      query = query.range(from, from + itemsPerPage - 1);

      const { data, error: qErr, count } = await query;
      if (qErr) throw qErr;
      setAlerts((data || []) as AlertRow[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError("Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, [user, severityFilter, statusFilter, searchQuery, page]);

  useEffect(() => {
    if (!authLoading && user) void fetchAlerts();
  }, [authLoading, user, fetchAlerts]);

  useEffect(() => { setPage(1); }, [severityFilter, statusFilter, searchQuery]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel("alerts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        void fetchAlerts();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, fetchAlerts]);

  const handleTriage = async (alertId: string) => {
    setTriagingId(alertId);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/aml-triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ alertId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Triage failed");
      }
      void fetchAlerts();
    } catch (err: any) {
      setError(err.message || "Failed to triage alert.");
    } finally {
      setTriagingId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasActiveFilters = severityFilter !== "all" || statusFilter !== "all" || searchQuery.trim() !== "";
  const clearFilters = () => { setSeverityFilter("all"); setStatusFilter("all"); setSearchQuery(""); };
  // Note: counts reflect current page only due to pagination
  const newCount = useMemo(() => alerts.filter((a) => a.status === "new").length, [alerts]);
  const criticalCount = useMemo(() => alerts.filter((a) => a.severity === "critical").length, [alerts]);

  if (authLoading) {
    return <div className="flex h-full items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">AML Triage</h1>
              {newCount > 0 && <Badge variant="info" className="text-xs font-medium px-2 py-0.5">{newCount} new</Badge>}
              {criticalCount > 0 && <Badge variant="negative" className="text-xs font-medium px-2 py-0.5">{criticalCount} critical</Badge>}
            </div>
            <p className="mt-1 text-base text-[var(--fg-muted)]">AI-powered alert triage — identify false positives, assess risk, recommend actions.</p>
          </div>
          <Button onClick={fetchAlerts} variant="ghost" className="h-10 px-4">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <Input
                placeholder="Search alerts, entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]" />
                </button>
              )}
            </div>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as AlertSeverity | "all")}>
              <SelectTrigger className="w-full lg:w-[180px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AlertStatus | "all")}>
              <SelectTrigger className="w-full lg:w-[180px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)]">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>
            Alerts <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">({totalCount} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : alerts.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState
                icon={Shield}
                title="No alerts found"
                description={hasActiveFilters ? "No alerts match your current filters." : "No AML alerts have been generated yet."}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <span className="font-mono text-sm text-[var(--accent)]">{alert.alert_number}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{alert.alert_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--fg-secondary)]">{alert.entity_name || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", SEVERITY_COLORS[alert.severity])} />
                            <span className="text-sm text-[var(--fg-secondary)]">{SEVERITY_LABELS[alert.severity]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", STATUS_COLORS[alert.status])} />
                            <span className="text-sm text-[var(--fg-secondary)]">{STATUS_LABELS[alert.status]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-[var(--fg-muted)]">
                            {(() => { const score = typeof alert.risk_score === "number" ? alert.risk_score : typeof alert.risk_score === "string" ? parseFloat(alert.risk_score) : null; return score !== null ? score.toFixed(0) : "—"; })()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--fg-muted)]">{formatTimeAgo(new Date(alert.created_at))}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(alert)} className="text-[var(--fg-secondary)]">
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            {(alert.status === "new" || alert.status === "triaging") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTriage(alert.id)}
                                disabled={triagingId === alert.id}
                                className="text-[var(--accent)]"
                              >
                                {triagingId === alert.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Bot className="h-4 w-4 mr-1" />
                                )}
                                {triagingId === alert.id ? "Triaging..." : "AI Triage"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)]">
                  <div className="text-sm text-[var(--fg-muted)]">
                    Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, totalCount)} of {totalCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 px-2">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-[var(--fg-secondary)]">Page {page} of {totalPages}</span>
                    <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 px-2">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAlert} onOpenChange={(open) => setSelectedAlert(open ? selectedAlert : null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--fg-muted)]" />
              Alert {selectedAlert?.alert_number}
              <Badge variant="outline" className="text-xs ml-2">{selectedAlert?.severity}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
              <div className="text-xs label-caps mb-2">Alert Details</div>
              <div className="space-y-2 text-sm text-[var(--fg-primary)]">
                <div><span className="text-[var(--fg-muted)]">Type:</span> {selectedAlert?.alert_type}</div>
                <div><span className="text-[var(--fg-muted)]">Entity:</span> {selectedAlert?.entity_name || "—"}</div>
                <div><span className="text-[var(--fg-muted)]">Source:</span> {selectedAlert?.source || "—"}</div>
                <div><span className="text-[var(--fg-muted)]">Description:</span> {selectedAlert?.description || "—"}</div>
                <div><span className="text-[var(--fg-muted)]">Risk Score:</span> {(() => { const score = typeof selectedAlert?.risk_score === "number" ? selectedAlert.risk_score : typeof selectedAlert?.risk_score === "string" ? parseFloat(selectedAlert.risk_score) : null; return score !== null ? score.toFixed(0) : "—"; })()}</div>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
              <div className="text-xs label-caps mb-2">AI Triage Result</div>
              <pre className="max-h-[420px] overflow-auto text-[12px] leading-relaxed text-[var(--fg-primary)]">
                {selectedAlert?.triage_result ? JSON.stringify(selectedAlert.triage_result, null, 2) : "Not yet triaged"}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
