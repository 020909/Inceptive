"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Scale,
  RefreshCw,
  Upload,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ReconciliationRunRow } from "@/types/compliance";

const RUN_STATUS_COLORS: Record<string, string> = {
  running: "bg-amber-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
};

export default function ReconciliationPage() {
  const { user, loading: authLoading } = useAuth();
  const [runs, setRuns] = useState<ReconciliationRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<ReconciliationRunRow | null>(null);
  const [reconModalOpen, setReconModalOpen] = useState(false);
  const [sourceAName, setSourceAName] = useState("");
  const [sourceBName, setSourceBName] = useState("");
  const [sourceAData, setSourceAData] = useState("");
  const [sourceBData, setSourceBData] = useState("");
  const [reconning, setReconning] = useState(false);

  const fetchRuns = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { data, error: qErr } = await supabase
        .from("reconciliation_runs")
        .select("*")
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setRuns((data || []) as ReconciliationRunRow[]);
    } catch (err) {
      console.error("Error fetching runs:", err);
      setError("Failed to load reconciliation runs.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) void fetchRuns();
  }, [authLoading, user, fetchRuns]);

  const handleReconcile = async () => {
    if (!sourceAName.trim() || !sourceBName.trim()) return;
    setReconning(true);
    try {
      let parsedA: any[], parsedB: any[];
      try {
        parsedA = JSON.parse(sourceAData);
        parsedB = JSON.parse(sourceBData);
      } catch {
        setError("Invalid JSON in source data. Provide arrays of transaction objects.");
        setReconning(false);
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          sourceAName: sourceAName.trim(),
          sourceBName: sourceBName.trim(),
          sourceA: parsedA,
          sourceB: parsedB,
        }),
      });

    if (!res.ok) {
      let err: { error?: string } = {};
      try {
        err = await res.json();
      } catch {
        err = { error: `Reconciliation failed (HTTP ${res.status})` };
      }
      throw new Error(err.error || "Reconciliation failed");
    }

      setReconModalOpen(false);
      setSourceAName("");
      setSourceBName("");
      setSourceAData("");
      setSourceBData("");
      void fetchRuns();
    } catch (err: any) {
      setError(err.message || "Reconciliation failed.");
    } finally {
      setReconning(false);
    }
  };

  const matchRate = (run: ReconciliationRunRow) => {
    const total = run.total_source_a + run.total_source_b;
    if (total === 0) return 0;
    return Math.round((run.matched_count * 2 / total) * 100);
  };

  if (authLoading) {
    return <div className="flex h-full items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">Reconciliation Tracer</h1>
            <p className="mt-1 text-base text-[var(--fg-muted)]">Compare data from two sources, match transactions, and identify exceptions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={fetchRuns} variant="ghost" className="h-10 px-4">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setReconModalOpen(true)} className="bg-white text-[#070A0B] hover:bg-[#D0D5D9] rounded-lg px-4 h-10">
              <Upload className="h-4 w-4 mr-2" /> New Reconciliation
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Reconciliation Runs <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">({runs.length} total)</span></CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : runs.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState icon={Scale} title="No reconciliation runs" description="Start by uploading two data sources to compare and match." actionLabel="New Reconciliation" onAction={() => setReconModalOpen(true)} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run #</TableHead>
                    <TableHead>Source A</TableHead>
                    <TableHead>Source B</TableHead>
                    <TableHead>Matched</TableHead>
                    <TableHead>Exceptions</TableHead>
                    <TableHead>Match Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <span className="font-mono text-sm text-[var(--accent)]">{run.run_number}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-secondary)]">{run.source_a_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-secondary)]">{run.source_b_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-emerald-400 font-medium">{run.matched_count}</span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-sm font-medium", run.exception_count > 0 ? "text-amber-400" : "text-[var(--fg-muted)]")}>
                          {run.exception_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono text-[var(--fg-secondary)]">{matchRate(run)}%</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", RUN_STATUS_COLORS[run.status] || "bg-slate-400")} />
                          <span className="text-sm text-[var(--fg-secondary)] capitalize">{run.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-muted)]">{formatTimeAgo(new Date(run.started_at))}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRun(run)} className="text-[var(--accent)]">
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRun} onOpenChange={(open) => setSelectedRun(open ? selectedRun : null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-[var(--fg-muted)]" />
              Run {selectedRun?.run_number}
              <Badge variant="outline" className="text-xs ml-2">{selectedRun?.status}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 text-center">
                <div className="text-xs label-caps mb-1">Source A</div>
                <div className="text-lg font-semibold text-[var(--fg-primary)]">{selectedRun?.source_a_name}</div>
                <div className="text-xs text-[var(--fg-muted)]">{selectedRun?.total_source_a} records</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 text-center">
                <div className="text-xs label-caps mb-1">Source B</div>
                <div className="text-lg font-semibold text-[var(--fg-primary)]">{selectedRun?.source_b_name}</div>
                <div className="text-xs text-[var(--fg-muted)]">{selectedRun?.total_source_b} records</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 text-center">
                <div className="text-xs label-caps mb-1">Match Rate</div>
                <div className="text-lg font-semibold text-emerald-400">{selectedRun ? matchRate(selectedRun) : 0}%</div>
                <div className="text-xs text-[var(--fg-muted)]">{selectedRun?.matched_count} matched</div>
              </div>
            </div>

            {selectedRun?.exceptions != null && Array.isArray(selectedRun.exceptions) && selectedRun.exceptions.length > 0 && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
                <div className="text-xs label-caps mb-2">Exceptions ({selectedRun.exceptions.length})</div>
                <div className="max-h-[300px] overflow-auto space-y-2">
                  {(selectedRun.exceptions as any[]).map((ex: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 border-l-2 border-amber-500 pl-3 py-1">
                      <Badge variant="outline" className="text-xs shrink-0">{ex.source}</Badge>
                      <span className="text-sm font-mono text-[var(--fg-primary)]">{ex.transaction_id}</span>
                      <span className="text-sm text-[var(--fg-muted)]">${ex.amount?.toLocaleString()}</span>
                      <span className="text-xs text-[var(--fg-muted)]">{ex.transaction_date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reconModalOpen} onOpenChange={setReconModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[var(--accent)]" /> New Reconciliation
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--fg-muted)] mb-2 block">Source A Name</label>
                <Input value={sourceAName} onChange={(e) => setSourceAName(e.target.value)} placeholder="e.g. Internal Ledger" className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]" />
              </div>
              <div>
                <label className="text-sm text-[var(--fg-muted)] mb-2 block">Source B Name</label>
                <Input value={sourceBName} onChange={(e) => setSourceBName(e.target.value)} placeholder="e.g. Bank Statement" className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]" />
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Source A Data (JSON array)</label>
              <Textarea value={sourceAData} onChange={(e) => setSourceAData(e.target.value)} placeholder='[{"transaction_id":"T001","amount":5000,"direction":"credit","transaction_date":"2024-01-15"}]' className="min-h-[150px] font-mono text-xs bg-[var(--bg-elevated)] border-[var(--border-default)]" />
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Source B Data (JSON array)</label>
              <Textarea value={sourceBData} onChange={(e) => setSourceBData(e.target.value)} placeholder='[{"transaction_id":"T001","amount":5000,"direction":"credit","transaction_date":"2024-01-15"}]' className="min-h-[150px] font-mono text-xs bg-[var(--bg-elevated)] border-[var(--border-default)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReconModalOpen(false)}>Cancel</Button>
            <Button onClick={handleReconcile} disabled={!sourceAName.trim() || !sourceBName.trim() || reconning} className="bg-white text-[#070A0B]">
              {reconning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Scale className="h-4 w-4 mr-2" />}
              {reconning ? "Matching..." : "Run Reconciliation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
