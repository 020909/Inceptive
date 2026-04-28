"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  Download,
  Activity,
  Bot,
  CheckSquare,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────────────

type CaseType = "kyb_review" | "sar_draft" | "vendor_review" | "aml_triage" | "reconciliation";
type CaseStatus = "pending" | "in_progress" | "awaiting_approval" | "approved" | "rejected" | "escalated";
type CasePriority = "low" | "normal" | "high" | "urgent";
type DocumentStatus = "pending" | "parsing" | "completed" | "failed";

interface Case {
  id: string;
  case_number: string;
  title: string;
  case_type: CaseType;
  status: CaseStatus;
  priority: CasePriority;
  description: string | null;
  assigned_to: string | null;
  assigned_user?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  org_id: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  metadata: Record<string, unknown> | null;
}

interface CaseDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  parsing_status: DocumentStatus;
  parsing_error: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface CaseEvent {
  id: string;
  event_type: string;
  event_description: string;
  actor: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ApprovalItem {
  id: string;
  title: string;
  approval_type: string;
  ai_recommendation: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  kyb_review: "KYB Review",
  sar_draft: "SAR Draft",
  vendor_review: "Vendor Review",
  aml_triage: "AML Triage",
  reconciliation: "Reconciliation",
};

const STATUS_COLORS: Record<CaseStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-slate-500/10", text: "text-slate-500" },
  in_progress: { bg: "bg-blue-500/10", text: "text-blue-500" },
  awaiting_approval: { bg: "bg-amber-500/10", text: "text-amber-500" },
  approved: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  rejected: { bg: "bg-red-500/10", text: "text-red-500" },
  escalated: { bg: "bg-orange-500/10", text: "text-orange-500" },
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

const PRIORITY_COLORS: Record<CasePriority, { bg: string; text: string }> = {
  low: { bg: "bg-slate-400/10", text: "text-slate-400" },
  normal: { bg: "bg-blue-400/10", text: "text-blue-400" },
  high: { bg: "bg-orange-500/10", text: "text-orange-500" },
  urgent: { bg: "bg-red-500/10", text: "text-red-500" },
};

const PRIORITY_LABELS: Record<CasePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-slate-400/10", text: "text-slate-400" },
  parsing: { bg: "bg-blue-400/10", text: "text-blue-400" },
  completed: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  failed: { bg: "bg-red-500/10", text: "text-red-500" },
};

const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Pending",
  parsing: "Parsing",
  completed: "Completed",
  failed: "Failed",
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getEventIcon(eventType: string): React.ReactNode {
  const type = eventType.toLowerCase();
  if (type.includes("create")) return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (type.includes("document")) return <FileText className="h-4 w-4 text-blue-500" />;
  if (type.includes("agent")) return <Bot className="h-4 w-4 text-purple-500" />;
  if (type.includes("approval")) return <CheckSquare className="h-4 w-4 text-amber-500" />;
  if (type.includes("update")) return <Activity className="h-4 w-4 text-slate-500" />;
  return <Clock className="h-4 w-4 text-slate-400" />;
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CaseStatus }) {
  const colors = STATUS_COLORS[status];
  const dotColor = colors.text.replace("text-", "bg-");
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", colors.bg, colors.text)}>
      <div className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      {STATUS_LABELS[status]}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  const colors = PRIORITY_COLORS[priority];
  const dotColor = colors.text.replace("text-", "bg-");
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", colors.bg, colors.text)}>
      <div className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      {PRIORITY_LABELS[priority]}
    </div>
  );
}

function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const colors = DOCUMENT_STATUS_COLORS[status];
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", colors.bg, colors.text)}>
      {DOCUMENT_STATUS_LABELS[status]}
    </div>
  );
}

// ─── Tab Content Components ────────────────────────────────────────────────────

function OverviewTab({ caseData }: { caseData: Case }) {
  return (
    <div className="space-y-6">
      {/* Description */}
      {caseData.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[var(--fg-secondary)] whitespace-pre-wrap">
              {caseData.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Metadata Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)]">Created</p>
                <p className="text-sm font-medium text-[var(--fg-primary)]">
                  {formatDateTime(caseData.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)]">Last Updated</p>
                <p className="text-sm font-medium text-[var(--fg-primary)]">
                  {formatDateTime(caseData.updated_at)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)]">Due Date</p>
                <p className="text-sm font-medium text-[var(--fg-primary)]">
                  {formatDate(caseData.due_date)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)]">Assigned To</p>
                <p className="text-sm font-medium text-[var(--fg-primary)]">
                  {caseData.assigned_user?.full_name || caseData.assigned_user?.email || "Unassigned"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)]">Case Type</p>
                <p className="text-sm font-medium text-[var(--fg-primary)]">
                  {CASE_TYPE_LABELS[caseData.case_type]}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsTab({
  documents,
  isLoading,
}: {
  documents: CaseDocument[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents"
        description="Upload documents to this case to start the review process."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Uploaded Documents</CardTitle>
        <CardDescription>{documents.length} document(s)</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[var(--fg-muted)]" />
                      <span className="text-[var(--fg-primary)] truncate max-w-[200px]">
                        {doc.file_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--fg-muted)] text-sm">
                      {doc.file_type.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--fg-muted)] text-sm">
                      {formatFileSize(doc.file_size)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DocumentStatusBadge status={doc.parsing_status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--fg-muted)] text-sm">
                      {formatTimeAgo(new Date(doc.created_at))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentResultsTab() {
  return (
    <EmptyState
      icon={Bot}
      title="No agent results yet"
      description="AI agent results will appear here once processing begins."
    />
  );
}

function ApprovalQueueTab({
  approvals,
  isLoading,
}: {
  approvals: ApprovalItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No pending approvals"
        description="All items for this case have been reviewed."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending Approvals</CardTitle>
        <CardDescription>{approvals.length} item(s) awaiting review</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-3 p-6">
          {approvals.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--fg-primary)] truncate">
                  {item.title}
                </p>
                <p className="text-xs text-[var(--fg-muted)] mt-1">
                  {item.approval_type}
                </p>
                {item.ai_recommendation && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="info" className="text-[10px]">
                      AI: {item.ai_recommendation}
                    </Badge>
                  </div>
                )}
              </div>
              <Button size="sm" className="shrink-0">
                Review
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTrailTab({
  events,
  isLoading,
}: {
  events: CaseEvent[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No audit events"
        description="Case events will be logged here as they occur."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit Trail</CardTitle>
        <CardDescription>{events.length} event(s) recorded</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.event_type)}
                      <Badge variant="default" className="text-[10px]">
                        {event.event_type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--fg-primary)] text-sm">
                      {event.event_description}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--fg-muted)] text-sm">
                      {event.actor_name || event.actor || "System"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--fg-muted)] text-sm">
                      {formatTimeAgo(new Date(event.created_at))}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch case data
  const fetchCaseData = useCallback(async () => {
    if (!caseId || !user?.id) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // Get user's org_id
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch case details
      const { data: caseResult, error: caseError } = await supabase
        .from("cases")
        .select(
          `*, assigned_user:assigned_to(id, full_name, email)`
        )
        .eq("id", caseId)
        .eq("org_id", profile.org_id)
        .single();

      if (caseError) throw caseError;
      setCaseData(caseResult);

      // Fetch documents
      const { data: docsResult, error: docsError } = await supabase
        .from("case_documents")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (!docsError) setDocuments(docsResult || []);

      // Fetch events
      const { data: eventsResult, error: eventsError } = await supabase
        .from("case_events")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (!eventsError) setEvents(eventsResult || []);

      // Fetch approvals
      const { data: approvalsResult, error: approvalsError } = await supabase
        .from("approval_queue")
        .select("id, title, approval_type, ai_recommendation, status, created_at, expires_at")
        .eq("case_id", caseId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!approvalsError) setApprovals(approvalsResult || []);
    } catch (err) {
      console.error("Error fetching case data:", err);
      setError("Failed to load case details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [caseId, user]);

  useEffect(() => {
    if (!authLoading && user && caseId) {
      void fetchCaseData();
    }
  }, [authLoading, user, caseId, fetchCaseData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user?.id || !caseId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`case-${caseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cases",
          filter: `id=eq.${caseId}`,
        },
        () => void fetchCaseData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "case_documents",
          filter: `case_id=eq.${caseId}`,
        },
        () => void fetchCaseData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "case_events",
          filter: `case_id=eq.${caseId}`,
        },
        () => void fetchCaseData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, caseId, fetchCaseData]);

  if (authLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-semibold text-[var(--fg-primary)] mb-2">
          Case Not Found
        </h1>
        <p className="text-[var(--fg-muted)] mb-6">
          {error || "The case you're looking for doesn't exist or you don't have access to it."}
        </p>
        <Link href="/cases">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Back Button */}
      <Link href="/cases" className="inline-flex items-center text-sm text-[var(--fg-muted)] hover:text-[var(--fg-primary)] mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Cases
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-semibold text-[var(--accent)]">
                {caseData.case_number}
              </span>
              <StatusBadge status={caseData.status} />
              <PriorityBadge priority={caseData.priority} />
            </div>
            <h1 className="text-2xl font-semibold text-[var(--fg-primary)]">
              {caseData.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
            <Calendar className="h-4 w-4" />
            <span>Due {formatDate(caseData.due_date)}</span>
          </div>
        </div>

        {/* Quick Info Bar */}
        <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[var(--fg-muted)]" />
            <span className="text-[var(--fg-muted)]">Assigned to</span>
            <span className="text-[var(--fg-primary)]">
              {caseData.assigned_user?.full_name || caseData.assigned_user?.email || "Unassigned"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--fg-muted)]" />
            <span className="text-[var(--fg-muted)]">Type</span>
            <span className="text-[var(--fg-primary)]">
              {CASE_TYPE_LABELS[caseData.case_type]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--fg-muted)]" />
            <span className="text-[var(--fg-muted)]">Created</span>
            <span className="text-[var(--fg-primary)]">
              {formatTimeAgo(new Date(caseData.created_at))}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {documents.length > 0 && (
              <span className="ml-1.5 text-xs text-[var(--fg-muted)]">({documents.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="agents">Agent Results</TabsTrigger>
          <TabsTrigger value="approvals">
            Approval Queue
            {approvals.length > 0 && (
              <span className="ml-1.5 text-xs text-[var(--fg-muted)]">({approvals.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit">
            Audit Trail
            {events.length > 0 && (
              <span className="ml-1.5 text-xs text-[var(--fg-muted)]">({events.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "overview" && <OverviewTab caseData={caseData} />}
          {activeTab === "documents" && (
            <DocumentsTab documents={documents} isLoading={loading} />
          )}
          {activeTab === "agents" && <AgentResultsTab />}
          {activeTab === "approvals" && (
            <ApprovalQueueTab approvals={approvals} isLoading={loading} />
          )}
          {activeTab === "audit" && <AuditTrailTab events={events} isLoading={loading} />}
        </div>
      </Tabs>
    </div>
  );
}
