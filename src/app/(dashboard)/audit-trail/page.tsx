"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Shield,
  Hash,
  Clock,
  Filter,
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
import type { AuditLogRow } from "@/types/compliance";

function escapePostgrest(str: string): string {
  return str.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const ACTION_TYPE_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "aml_triage_completed", label: "AML Triage" },
  { value: "sar_narrative_generated", label: "SAR Generated" },
  { value: "approval_queue_approved", label: "Approved" },
  { value: "approval_queue_rejected", label: "Rejected" },
  { value: "policy_created", label: "Policy Created" },
  { value: "reconciliation_completed", label: "Reconciliation" },
  { value: "vendor_assessment_completed", label: "Vendor Assessment" },
  { value: "case_created", label: "Case Created" },
];

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

const ACTION_COLORS: Record<string, string> = {
  aml_triage_completed: "bg-blue-500",
  sar_narrative_generated: "bg-purple-500",
  approval_queue_approved: "bg-emerald-500",
  approval_queue_rejected: "bg-red-500",
  policy_created: "bg-cyan-500",
  reconciliation_completed: "bg-amber-500",
  vendor_assessment_completed: "bg-orange-500",
  case_created: "bg-slate-500",
};

export default function AuditTrailPage() {
  const { user, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);
  const itemsPerPage = 25;

  const fetchLogs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      let query = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (actionFilter !== "all") query = query.eq("action_type", actionFilter);
      if (searchQuery.trim()) {
        const escaped = escapePostgrest(searchQuery.trim());
        query = query.or(`action_type.ilike.%${escaped}%,actor_email.ilike.%${escaped}%,entity_type.ilike.%${escaped}%`);
      }

      const from = (page - 1) * itemsPerPage;
      query = query.range(from, from + itemsPerPage - 1);

      const { data, error: qErr, count } = await query;
      if (qErr) throw qErr;
      setLogs((data || []) as AuditLogRow[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setError("Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  }, [user, actionFilter, searchQuery, page]);

  useEffect(() => {
    if (!authLoading && user) void fetchLogs();
  }, [authLoading, user, fetchLogs]);

  useEffect(() => { setPage(1); }, [actionFilter, searchQuery]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const aiActionCount = useMemo(() => logs.filter((l) => l.ai_model_used).length, [logs]);

  if (authLoading) {
    return <div className="flex h-full items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">Audit Trail</h1>
              {aiActionCount > 0 && (
                <Badge variant="outline" className="text-xs font-mono">
                  <Bot className="h-3 w-3 mr-1" />{aiActionCount} AI actions
                </Badge>
              )}
            </div>
            <p className="mt-1 text-base text-[var(--fg-muted)]">Immutable records of all compliance activities, AI decisions, and human approvals.</p>
          </div>
          <Button onClick={fetchLogs} variant="ghost" className="h-10 px-4">
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
                placeholder="Search actions, actors, entities..."
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
            <Select value={actionFilter} onValueChange={(v) => v !== null && setActionFilter(v)}>
              <SelectTrigger className="w-full lg:w-[220px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>
            Audit Entries <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">({totalCount} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState icon={Shield} title="No audit entries" description="Audit entries will appear here as compliance actions are performed." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hash</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>AI Model</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const hash = simpleHash(log.id + log.created_at);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Hash className="h-3 w-3 text-[var(--fg-muted)]" />
                              <span className="font-mono text-xs text-[var(--fg-muted)]">{hash}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-[var(--fg-muted)]" />
                              <span className="text-sm text-[var(--fg-muted)]">{formatTimeAgo(new Date(log.created_at))}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn("h-2 w-2 rounded-full", ACTION_COLORS[log.action_type] || "bg-slate-400")} />
                              <span className="text-sm text-[var(--fg-secondary)]">{log.action_type.replace(/_/g, " ")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-[var(--fg-muted)]">{log.actor_email}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-[var(--fg-muted)]">{log.entity_type || "—"} {log.entity_id ? `• ${String(log.entity_id).slice(0, 8)}` : ""}</span>
                          </TableCell>
                          <TableCell>
                            {log.decision ? (
                              <Badge variant="outline" className={cn("text-xs", log.decision === "approved" ? "border-emerald-500 text-emerald-500" : log.decision === "rejected" ? "border-red-500 text-red-500" : "")}>{log.decision}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-[var(--fg-muted)]">{log.ai_model_used || "—"}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="text-[var(--accent)]">
                              <Eye className="h-4 w-4 mr-1" /> Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      <Dialog open={!!selectedLog} onOpenChange={(open) => setSelectedLog(open ? selectedLog : null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--fg-muted)]" />
              Audit Entry
              <span className="ml-2 text-xs font-mono text-[var(--fg-muted)]">#{simpleHash((selectedLog?.id || "") + (selectedLog?.created_at || ""))}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-1">Action</div>
                <div className="text-sm text-[var(--fg-primary)]">{selectedLog?.action_type?.replace(/_/g, " ")}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-1">Actor</div>
                <div className="text-sm text-[var(--fg-primary)]">{selectedLog?.actor_email}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-1">Decision</div>
                <div className="text-sm text-[var(--fg-primary)]">{selectedLog?.decision || "—"}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-1">AI Model</div>
                <div className="text-sm font-mono text-[var(--fg-primary)]">{selectedLog?.ai_model_used || "Human action"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-2">Before State</div>
                <pre className="max-h-[300px] overflow-auto text-[12px] leading-relaxed text-[var(--fg-primary)]">
                  {selectedLog?.before_state ? JSON.stringify(selectedLog.before_state, null, 2) : "No prior state"}
                </pre>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-2">After State</div>
                <pre className="max-h-[300px] overflow-auto text-[12px] leading-relaxed text-[var(--fg-primary)]">
                  {selectedLog?.after_state ? JSON.stringify(selectedLog.after_state, null, 2) : "No after state"}
                </pre>
              </div>
            </div>

            {selectedLog?.citations != null && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-2">Citations</div>
                <pre className="max-h-[200px] overflow-auto text-[12px] leading-relaxed text-[var(--fg-primary)]">
                  {JSON.stringify(selectedLog.citations, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-[var(--fg-muted)]">
              <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> ID: {String(selectedLog?.id || "").slice(0, 8)}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {selectedLog?.created_at}</span>
              {selectedLog?.ip_address && <span>IP: {selectedLog.ip_address}</span>}
              {selectedLog?.ai_prompt_hash && <span className="font-mono">Prompt Hash: {selectedLog.ai_prompt_hash}</span>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Bot({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
  );
}
