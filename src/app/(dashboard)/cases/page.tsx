"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  X,
  Eye,
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
import { CreateCaseModal } from "@/components/cases/CreateCaseModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type CaseType = "kyb_review" | "sar_draft" | "vendor_review" | "aml_triage" | "reconciliation";
type CaseStatus = "pending" | "in_progress" | "awaiting_approval" | "approved" | "rejected" | "escalated";
type CasePriority = "low" | "normal" | "high" | "urgent";

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
    full_name: string | null;
    email: string;
  } | null;
  org_id: string;
  created_at: string;
  due_date: string | null;
}

// Raw case data from Supabase (assigned_user comes as array)
interface RawCaseData {
  id: string;
  case_number: string;
  title: string;
  case_type: CaseType;
  status: CaseStatus;
  priority: CasePriority;
  description: string | null;
  assigned_to: string | null;
  assigned_user?: {
    full_name: string | null;
    email: string;
  }[] | null;
  org_id: string;
  created_at: string;
  due_date: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CASE_TYPE_OPTIONS: { value: CaseType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "kyb_review", label: "KYB Review" },
  { value: "sar_draft", label: "SAR Draft" },
  { value: "vendor_review", label: "Vendor Review" },
  { value: "aml_triage", label: "AML Triage" },
  { value: "reconciliation", label: "Reconciliation" },
];

const STATUS_OPTIONS: { value: CaseStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "awaiting_approval", label: "Awaiting Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "escalated", label: "Escalated" },
];

const PRIORITY_OPTIONS: { value: CasePriority | "all"; label: string }[] = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  kyb_review: "KYB Review",
  sar_draft: "SAR Draft",
  vendor_review: "Vendor Review",
  aml_triage: "AML Triage",
  reconciliation: "Reconciliation",
};

const STATUS_COLORS: Record<CaseStatus, string> = {
  pending: "bg-slate-500",
  in_progress: "bg-blue-500",
  awaiting_approval: "bg-amber-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  escalated: "bg-orange-500",
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
  low: "bg-slate-400",
  normal: "bg-blue-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const PRIORITY_LABELS: Record<CasePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

// ─── Helper Components ─────────────────────────────────────────────────────────

function CaseTypeBadge({ type }: { type: CaseType }) {
  return (
    <Badge variant="outline" className="text-xs whitespace-nowrap">
      {CASE_TYPE_LABELS[type]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])} />
      <span className="text-sm text-[var(--fg-secondary)]">
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2 w-2 rounded-full", PRIORITY_COLORS[priority])} />
      <span className="text-sm text-[var(--fg-secondary)]">
        {PRIORITY_LABELS[priority]}
      </span>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDueDate(dateStr: string | null): React.ReactNode {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return <span className="text-red-500 font-medium">{Math.abs(diffDays)}d overdue</span>;
  } else if (diffDays === 0) {
    return <span className="text-amber-500 font-medium">Due today</span>;
  } else if (diffDays === 1) {
    return <span className="text-amber-500">Due tomorrow</span>;
  }
  return formatDate(dateStr);
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CasesPage() {
  const { user, loading: authLoading } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CaseType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<CasePriority | "all">("all");

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 25;

  // Fetch user's org_id
  const fetchUserOrgId = useCallback(async () => {
    if (!user?.id) return null;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();
    if (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
    return data?.org_id;
  }, [user]);

  // Fetch cases
  const fetchCases = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const orgId = await fetchUserOrgId();
      if (!orgId) {
        setError("Unable to fetch organization data.");
        setLoading(false);
        return;
      }

      // Build query
      let query = supabase
        .from("cases")
        .select(
          `id, case_number, title, case_type, status, priority, description, assigned_to, org_id, created_at, due_date,
           assigned_user:assigned_to(full_name, email)`,
          { count: "exact" }
        )
        .eq("org_id", orgId);

      // Apply filters
      if (typeFilter !== "all") {
        query = query.eq("case_type", typeFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(
          `case_number.ilike.%${searchQuery.trim()}%,title.ilike.%${searchQuery.trim()}%`
        );
      }

      // Apply pagination
      const from = (page - 1) * itemsPerPage;
      query = query.order("created_at", { ascending: false }).range(from, from + itemsPerPage - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Transform assigned_user from array to single object (Supabase returns it as array)
      const transformedData: Case[] = (data || []).map((caseItem: RawCaseData) => ({
        ...caseItem,
        assigned_user: caseItem.assigned_user?.[0] || null,
      }));
      setCases(transformedData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching cases:", err);
      setError("Failed to load cases. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, typeFilter, statusFilter, priorityFilter, searchQuery, page, fetchUserOrgId]);

  // Initial fetch
  useEffect(() => {
    if (!authLoading && user) {
      void fetchCases();
    }
  }, [authLoading, user, fetchCases]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter, priorityFilter, searchQuery]);

  // Realtime subscription for cases
  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel("cases-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cases",
        },
        () => {
          // Refetch cases when changes occur
          void fetchCases();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, fetchCases]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const hasActiveFilters =
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    searchQuery.trim() !== "";

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSearchQuery("");
  };

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">
              Cases
            </h1>
            <p className="mt-1 text-base text-[var(--fg-muted)]">
              Manage compliance cases and track their progress.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-white text-[#070A0B] hover:bg-[#D0D5D9] rounded-lg px-4 h-10"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Case
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <Input
                placeholder="Search case number or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CaseType | "all")}>
              <SelectTrigger className="w-full lg:w-[180px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Case Type" />
              </SelectTrigger>
              <SelectContent>
                {CASE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CaseStatus | "all")}>
              <SelectTrigger className="w-full lg:w-[180px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as CasePriority | "all")}>
              <SelectTrigger className="w-full lg:w-[160px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>
            Cases
            <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">
              ({totalCount} total)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState
                icon={Briefcase}
                title="No cases found"
                description={
                  hasActiveFilters
                    ? "No cases match your current filters. Try adjusting or clearing the filters."
                    : "Get started by creating your first case."
                }
                actionLabel={!hasActiveFilters ? "Create your first case" : undefined}
                onAction={!hasActiveFilters ? () => setIsCreateModalOpen(true) : undefined}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((caseItem) => (
                      <TableRow key={caseItem.id}>
                        <TableCell>
                          <Link
                            href={`/cases/${caseItem.id}`}
                            className="text-[var(--accent)] hover:underline font-medium"
                          >
                            {caseItem.case_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-[var(--fg-primary)] truncate max-w-[200px] block">
                            {caseItem.title}
                          </span>
                        </TableCell>
                        <TableCell>
                          <CaseTypeBadge type={caseItem.case_type} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={caseItem.status} />
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={caseItem.priority} />
                        </TableCell>
                        <TableCell>
                          <span className="text-[var(--fg-secondary)]">
                            {caseItem.assigned_user?.full_name ||
                              caseItem.assigned_user?.email ||
                              "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[var(--fg-muted)] text-sm">
                            {formatTimeAgo(new Date(caseItem.created_at))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[var(--fg-secondary)] text-sm">
                            {formatDueDate(caseItem.due_date)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/cases/${caseItem.id}`}>
                            <Button variant="ghost" size="sm" className="text-[var(--accent)]">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)]">
                  <div className="text-sm text-[var(--fg-muted)]">
                    Showing {(page - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(page * itemsPerPage, totalCount)} of {totalCount} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-[var(--fg-secondary)]">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Case Modal */}
      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCaseCreated={() => {
          setIsCreateModalOpen(false);
          void fetchCases();
        }}
      />
    </div>
  );
}
