"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileText,
  RefreshCw,
  Bot,
  Loader2,
  Eye,
  Plus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
} from "@/components/ui/dialog";
import type { SarDraftRow, CaseRow } from "@/types/compliance";

const SAR_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  filed: "Filed",
  rejected: "Rejected",
};

const SAR_STATUS_COLORS: Record<string, string> = {
  draft: "bg-blue-500",
  under_review: "bg-amber-500",
  approved: "bg-emerald-500",
  filed: "bg-purple-500",
  rejected: "bg-red-500",
};

function escapePostgrest(str: string): string {
  return str.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export default function SarDrafterPage() {
  const { user, loading: authLoading } = useAuth();
  const [sars, setSars] = useState<SarDraftRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSar, setSelectedSar] = useState<SarDraftRow | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const [sarRes, caseRes] = await Promise.all([
        supabase.from("sar_drafts").select("*").order("created_at", { ascending: false }),
        supabase.from("cases").select("id, case_number, title, case_type, status").eq("case_type", "sar_draft").order("created_at", { ascending: false }),
      ]);

      if (sarRes.error) throw sarRes.error;
      setSars((sarRes.data || []) as SarDraftRow[]);
      setCases((caseRes.data || []) as CaseRow[]);
    } catch (err) {
      console.error("Error fetching SARs:", err);
      setError("Failed to load SAR drafts.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) void fetchData();
  }, [authLoading, user, fetchData]);

  const handleGenerate = async () => {
    if (!selectedCaseId) return;
    setGenerating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/sar-drafter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ caseId: selectedCaseId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      setGenerateModalOpen(false);
      setSelectedCaseId("");
      void fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to generate SAR.");
    } finally {
      setGenerating(false);
    }
  };

  if (authLoading) {
    return <div className="flex h-full items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">SAR Drafter</h1>
            <p className="mt-1 text-base text-[var(--fg-muted)]">AI-generated Suspicious Activity Report narratives in FinCEN format.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={fetchData} variant="ghost" className="h-10 px-4">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setGenerateModalOpen(true)} className="bg-white text-[#070A0B] hover:bg-[#D0D5D9] rounded-lg px-4 h-10">
              <Plus className="h-4 w-4 mr-2" /> Generate SAR
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
          <CardTitle>
            SAR Drafts <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">({sars.length} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : sars.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState icon={FileText} title="No SAR drafts" description="Generate your first SAR narrative from an existing case." actionLabel="Generate SAR" onAction={() => setGenerateModalOpen(true)} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form Type</TableHead>
                    <TableHead>Case</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activity Type</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sars.map((sar) => (
                    <TableRow key={sar.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">{sar.fincen_form_type || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-[var(--accent)]">{cases.find(c => c.id === sar.case_id)?.case_number || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-secondary)]">v{sar.narrative_version}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", SAR_STATUS_COLORS[sar.status || "draft"])} />
                          <span className="text-sm text-[var(--fg-secondary)]">{SAR_STATUS_LABELS[sar.status || "draft"]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-muted)]">{(sar.suspicious_activity_type || []).join(", ") || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-muted)]">{formatTimeAgo(new Date(sar.created_at))}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSar(sar)} className="text-[var(--accent)]">
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

      <Dialog open={!!selectedSar} onOpenChange={(open) => setSelectedSar(open ? selectedSar : null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--fg-muted)]" />
              SAR Draft — {selectedSar?.fincen_form_type || "SAR-MSB"} v{selectedSar?.narrative_version}
              <Badge variant="outline" className="text-xs ml-2">{selectedSar?.status || "draft"}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-2">Subject Entities</div>
                <pre className="text-[12px] leading-relaxed text-[var(--fg-primary)]">
                  {selectedSar?.subject_entities ? JSON.stringify(selectedSar.subject_entities, null, 2) : "—"}
                </pre>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-2">Suspicious Activity Types</div>
                <div className="flex flex-wrap gap-2">
                  {(selectedSar?.suspicious_activity_type || []).map((t, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                  {(!selectedSar?.suspicious_activity_type || selectedSar.suspicious_activity_type.length === 0) && <span className="text-[var(--fg-muted)] text-sm">—</span>}
                </div>
                <div className="mt-3 text-xs label-caps mb-1">Activity Period</div>
                <div className="text-sm text-[var(--fg-secondary)]">
                  {selectedSar?.activity_start_date || "?"} — {selectedSar?.activity_end_date || "?"}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
              <div className="text-xs label-caps mb-2">FinCEN Narrative</div>
              <div className="text-sm leading-relaxed text-[var(--fg-primary)] whitespace-pre-wrap">
                {selectedSar?.narrative_draft || "No narrative generated yet."}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--accent)]" />
              Generate SAR Narrative
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Select Case</label>
              <Select value={selectedCaseId} onValueChange={(v) => v !== null && setSelectedCaseId(v)}>
                <SelectTrigger className="w-full h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue placeholder="Choose a case..." />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number} — {c.title || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cases.length === 0 && (
                <p className="text-xs text-[var(--fg-muted)] mt-2">No SAR-type cases found. Create a case with type "SAR Draft" first.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenerateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={!selectedCaseId || generating} className="bg-white text-[#070A0B]">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}
              {generating ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
