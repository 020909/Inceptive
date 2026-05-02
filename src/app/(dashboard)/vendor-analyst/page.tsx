"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Building2,
  RefreshCw,
  Plus,
  Eye,
  Bot,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { VendorAssessmentRow } from "@/types/compliance";

function escapePostgrest(str: string): string {
  return str.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const RISK_TIER_COLORS: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const RISK_TIER_ICONS: Record<string, any> = {
  low: ShieldCheck,
  medium: ShieldQuestion,
  high: ShieldAlert,
  critical: ShieldX,
};

const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  requires_review: "Requires Review",
};

const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  requires_review: "bg-amber-500",
};

export default function VendorAnalystPage() {
  const { user, loading: authLoading } = useAuth();
  const [assessments, setAssessments] = useState<VendorAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<VendorAssessmentRow | null>(null);
  const [assessModalOpen, setAssessModalOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [assessmentType, setAssessmentType] = useState("soc2");
  const [reportContent, setReportContent] = useState("");
  const [assessing, setAssessing] = useState(false);

  const fetchAssessments = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { data, error: qErr } = await supabase
        .from("vendor_assessments")
        .select("*")
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setAssessments((data || []) as VendorAssessmentRow[]);
    } catch (err) {
      console.error("Error fetching assessments:", err);
      setError("Failed to load vendor assessments.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) void fetchAssessments();
  }, [authLoading, user, fetchAssessments]);

  const handleAssess = async () => {
    if (!vendorId.trim() || !vendorName.trim()) return;
    setAssessing(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/vendor-analyst", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          vendorId: vendorId.trim(),
          vendorName: vendorName.trim(),
          assessmentType,
          reportContent: reportContent.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Assessment failed");
      }

      setAssessModalOpen(false);
      setVendorId("");
      setVendorName("");
      setReportContent("");
      void fetchAssessments();
    } catch (err: any) {
      setError(err.message || "Vendor assessment failed.");
    } finally {
      setAssessing(false);
    }
  };

  const riskTierCounts = assessments.reduce((acc, a) => {
    if (a.risk_tier) acc[a.risk_tier] = (acc[a.risk_tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (authLoading) {
    return <div className="flex h-full items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">Vendor Analyst</h1>
              {Object.entries(riskTierCounts).map(([tier, count]) => (
                <Badge key={tier} variant="outline" className="text-xs">
                  <div className={cn("h-2 w-2 rounded-full mr-1", RISK_TIER_COLORS[tier])} />
                  {count} {tier}
                </Badge>
              ))}
            </div>
            <p className="mt-1 text-base text-[var(--fg-muted)]">AI-powered vendor risk assessments from SOC2 reports and security questionnaires.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={fetchAssessments} variant="ghost" className="h-10 px-4">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setAssessModalOpen(true)} className="bg-white text-[#070A0B] hover:bg-[#D0D5D9] rounded-lg px-4 h-10">
              <Plus className="h-4 w-4 mr-2" /> New Assessment
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
          <CardTitle>Assessments <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">({assessments.length} total)</span></CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : assessments.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState icon={Building2} title="No vendor assessments" description="Start by running an AI risk assessment on a vendor." actionLabel="New Assessment" onAction={() => setAssessModalOpen(true)} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Risk Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assessed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a) => {
                    const TierIcon = RISK_TIER_ICONS[a.risk_tier || "medium"] || ShieldQuestion;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <span className="text-sm font-medium text-[var(--accent)] cursor-pointer" title={a.vendor_id}>View details</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{a.assessment_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-[var(--fg-secondary)]">{typeof a.risk_score === "number" ? a.risk_score.toFixed(0) : "—"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", RISK_TIER_COLORS[a.risk_tier || "medium"])} />
                            <TierIcon className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
                            <span className="text-sm text-[var(--fg-secondary)] capitalize">{a.risk_tier || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", ASSESSMENT_STATUS_COLORS[a.status] || "bg-slate-400")} />
                            <span className="text-sm text-[var(--fg-secondary)]">{ASSESSMENT_STATUS_LABELS[a.status] || a.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--fg-muted)]">{a.assessed_at ? formatTimeAgo(new Date(a.assessed_at)) : "—"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedAssessment(a)} className="text-[var(--accent)]">
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAssessment} onOpenChange={(open) => setSelectedAssessment(open ? selectedAssessment : null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--fg-muted)]" />
              Vendor Assessment
              <Badge variant="outline" className="text-xs ml-2">{selectedAssessment?.assessment_type}</Badge>
              <div className={cn("h-2 w-2 rounded-full ml-2", RISK_TIER_COLORS[selectedAssessment?.risk_tier || "medium"])} />
              <span className="text-sm capitalize text-[var(--fg-secondary)]">{selectedAssessment?.risk_tier}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 text-center">
                <div className="text-xs label-caps mb-1">Risk Score</div>
                <div className="text-2xl font-semibold text-[var(--fg-primary)]">{typeof selectedAssessment?.risk_score === "number" ? selectedAssessment.risk_score.toFixed(0) : "—"}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 text-center">
                <div className="text-xs label-caps mb-1">Risk Tier</div>
                <div className={cn("text-2xl font-semibold capitalize", selectedAssessment?.risk_tier === "critical" ? "text-red-500" : selectedAssessment?.risk_tier === "high" ? "text-orange-500" : selectedAssessment?.risk_tier === "medium" ? "text-amber-500" : "text-emerald-500")}>{selectedAssessment?.risk_tier || "—"}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 text-center">
                <div className="text-xs label-caps mb-1">Status</div>
                <div className="text-lg font-semibold text-[var(--fg-primary)]">{ASSESSMENT_STATUS_LABELS[selectedAssessment?.status || "pending"]}</div>
              </div>
            </div>

            {selectedAssessment?.findings != null && Array.isArray(selectedAssessment.findings) && selectedAssessment.findings.length > 0 && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
                <div className="text-xs label-caps mb-3">Findings</div>
                <div className="space-y-3">
                  {(selectedAssessment.findings as any[]).map((f: any, i: number) => (
                    <div key={i} className="border-l-2 pl-3 py-1" style={{ borderColor: f.severity === "critical" ? "#ef4444" : f.severity === "high" ? "#f97316" : f.severity === "medium" ? "#f59e0b" : "#94a3b8" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{f.category}</Badge>
                        <Badge variant="outline" className={cn("text-xs", f.severity === "critical" ? "border-red-500 text-red-500" : f.severity === "high" ? "border-orange-500 text-orange-500" : "")}>{f.severity}</Badge>
                      </div>
                      <div className="text-sm text-[var(--fg-primary)]">{f.description}</div>
                      {f.recommendation && <div className="text-xs text-[var(--fg-muted)] mt-1">Recommendation: {f.recommendation}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedAssessment?.recommendations && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
                <div className="text-xs label-caps mb-2">Recommendations</div>
                <div className="text-sm leading-relaxed text-[var(--fg-primary)]">{selectedAssessment.recommendations}</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assessModalOpen} onOpenChange={setAssessModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--accent)]" /> New Vendor Assessment
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--fg-muted)] mb-2 block">Vendor ID</label>
                <Input value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="e.g. VND-001" className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]" />
              </div>
              <div>
                <label className="text-sm text-[var(--fg-muted)] mb-2 block">Vendor Name</label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. CloudHost Inc." className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]" />
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Assessment Type</label>
              <Select value={assessmentType} onValueChange={(v) => v !== null && setAssessmentType(v)}>
                <SelectTrigger className="w-full h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soc2">SOC2 Report</SelectItem>
                  <SelectItem value="security_questionnaire">Security Questionnaire</SelectItem>
                  <SelectItem value="penetration_test">Penetration Test</SelectItem>
                  <SelectItem value="financial_review">Financial Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Report Content (optional)</label>
              <Textarea value={reportContent} onChange={(e) => setReportContent(e.target.value)} placeholder="Paste the report or questionnaire content here for AI analysis..." className="min-h-[200px] bg-[var(--bg-elevated)] border-[var(--border-default)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssessModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssess} disabled={!vendorId.trim() || !vendorName.trim() || assessing} className="bg-white text-[#070A0B]">
              {assessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}
              {assessing ? "Analyzing..." : "Run Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
