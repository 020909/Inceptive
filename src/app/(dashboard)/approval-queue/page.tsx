"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Check,
  Clock,
  X,
  AlertCircle,
  Eye,
  Filter,
  RefreshCw,
  User,
  FileText,
  Shield,
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalItemDetail } from "@/components/approval-queue/ApprovalItemDetail";

// ─── Types ───────────────────────────────────────────────────────────────────

type ApprovalStatus = "pending" | "approved" | "rejected";
type ApprovalItemType = "ubo_extraction" | "document" | "compliance_check" | "risk_assessment";
type Priority = "high" | "medium" | "low";

interface ApprovalQueueItem {
  id: string;
  org_id: string;
  item_type: ApprovalItemType;
  item_id: string;
  status: ApprovalStatus;
  priority: Priority;
  requested_by: string;
  requester?: {
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
  metadata?: {
    subject_name?: string;
    confidence?: number;
    extraction_data?: Record<string, unknown>;
  } | null;
}

interface UBOExtractionDetail {
  id: string;
  case_id: string;
  status: string;
  confidence: number;
  extracted_data: {
    beneficial_owners?: Array<{
      name: string;
      ownership_percentage: number;
      address?: string;
      sanctions_match?: boolean;
    }>;
    ownership_tree?: Record<string, unknown>;
    sanctions_matches?: Array<{
      name: string;
      list: string;
      confidence: number;
    }>;
  };
  created_at: string;
  case?: {
    subject_name: string;
    subject_address?: string;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: ApprovalStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const ITEM_TYPE_LABELS: Record<ApprovalItemType, string> = {
  ubo_extraction: "UBO Extraction",
  document: "Document",
  compliance_check: "Compliance Check",
  risk_assessment: "Risk Assessment",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending: "bg-amber-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
};

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

// ─── Helper Components ─────────────────────────────────────────────────────────

function ItemTypeBadge({ type }: { type: ApprovalItemType }) {
  return (
    <Badge variant="outline" className="text-xs whitespace-nowrap">
      {ITEM_TYPE_LABELS[type] || type}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2 w-2 rounded-full", PRIORITY_COLORS[priority])} />
      <span className="text-sm text-[var(--fg-secondary)]">
        {PRIORITY_LABELS[priority]}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])} />
      <span className="text-sm text-[var(--fg-secondary)]">
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ApprovalQueuePage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">("pending");
  
  // Detail modal state
  const [selectedItem, setSelectedItem] = useState<ApprovalQueueItem | null>(null);
  const [detailData, setDetailData] = useState<UBOExtractionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingItem, setRejectingItem] = useState<ApprovalQueueItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
  }, [user?.id]);

  // Fetch approval queue items
  const fetchItems = useCallback(async () => {
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
        .from("approval_queue")
        .select(
          `*, requester:requested_by(email)`,
          { count: "exact" }
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      // Transform data
      const transformedData = (data || []).map((item: unknown) => {
        const rawItem = item as Record<string, unknown>;
        const requesterData = rawItem.requester;
        return {
          ...rawItem,
          requester: requesterData && Array.isArray(requesterData) && requesterData.length > 0
            ? (requesterData[0] as { email: string })
            : (requesterData as { email: string } | null) || null,
        } as ApprovalQueueItem;
      });

      setItems(transformedData);
    } catch (err) {
      console.error("Error fetching approval queue:", err);
      setError("Failed to load approval queue. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, fetchUserOrgId]);

  // Fetch UBO extraction details
  const fetchUBODetails = useCallback(async (itemId: string) => {
    setDetailLoading(true);
    const supabase = createClient();
    
    try {
      const { data, error } = await supabase
        .from("ubo_extractions")
        .select(`
          *,
          case:case_id(subject_name, subject_address)
        `)
        .eq("id", itemId)
        .maybeSingle();

      if (error) throw error;
      
      setDetailData(data as UBOExtractionDetail);
    } catch (err) {
      console.error("Error fetching UBO details:", err);
      setError("Failed to load extraction details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!authLoading && user) {
      void fetchItems();
    }
  }, [authLoading, user, fetchItems]);

  // Handle review click
  const handleReview = useCallback((item: ApprovalQueueItem) => {
    setSelectedItem(item);
    if (item.item_type === "ubo_extraction") {
      void fetchUBODetails(item.item_id);
    }
  }, [fetchUBODetails]);

  // Handle approve
  const handleApprove = useCallback(async (item: ApprovalQueueItem) => {
    setActionLoading(true);
    
    try {
      const response = await fetch("/api/approval-queue/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          itemType: item.item_type,
          targetId: item.item_id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve item");
      }

      // Refresh the list
      void fetchItems();
      
      // Close detail modal if open
      setSelectedItem(null);
      setDetailData(null);
    } catch (err) {
      console.error("Error approving item:", err);
      setError("Failed to approve item. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }, [fetchItems]);

  // Handle reject click
  const handleRejectClick = useCallback((item: ApprovalQueueItem) => {
    setRejectingItem(item);
    setRejectReason("");
    setRejectModalOpen(true);
  }, []);

  // Handle confirm reject
  const handleConfirmReject = useCallback(async () => {
    if (!rejectingItem) return;
    
    setActionLoading(true);
    
    try {
      const response = await fetch("/api/approval-queue/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: rejectingItem.id,
          itemType: rejectingItem.item_type,
          targetId: rejectingItem.item_id,
          reason: rejectReason,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject item");
      }

      // Refresh the list
      void fetchItems();
      
      // Close modals
      setRejectModalOpen(false);
      setRejectingItem(null);
      setRejectReason("");
      setSelectedItem(null);
      setDetailData(null);
    } catch (err) {
      console.error("Error rejecting item:", err);
      setError("Failed to reject item. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }, [rejectingItem, rejectReason, fetchItems]);

  // Calculate pending count
  const pendingCount = useMemo(() => {
    return items.filter((item) => item.status === "pending").length;
  }, [items]);

  // Filtered items based on current filter
  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">
                Approval Queue
              </h1>
              {pendingCount > 0 && (
<Badge
            variant="info"
            className="text-xs font-medium px-2 py-0.5"
          >
                  {pendingCount} pending
                </Badge>
              )}
            </div>
            <p className="mt-1 text-base text-[var(--fg-muted)]">
              Review and approve AI-generated extractions and compliance decisions.
            </p>
          </div>
<Button
          onClick={fetchItems}
          variant="ghost"
          className="h-10 px-4"
        >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--fg-muted)] mr-2" />
            {FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "h-9 px-4",
                  statusFilter === opt.value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent"
                )}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>
            Queue Items
            <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">
              ({filteredItems.length} items)
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
          ) : filteredItems.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState
                icon={Shield}
                title="No items found"
                description={
                  statusFilter === "pending"
                    ? "You're all caught up! There are no pending approvals."
                    : statusFilter === "all"
                    ? "No approval queue items found."
                    : `No ${statusFilter} items found.`
                }
                actionLabel={statusFilter !== "pending" ? "View pending" : undefined}
                onAction={statusFilter !== "pending" ? () => setStatusFilter("pending") : undefined}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[var(--fg-muted)]" />
                          <ItemTypeBadge type={item.item_type} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={item.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-[var(--fg-muted)]" />
                          <span className="text-[var(--fg-secondary)] text-sm">
                            {item.requester?.email || "System"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[var(--fg-muted)] text-sm">
                          {formatTimeAgo(new Date(item.created_at))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(item)}
                            className="text-[var(--accent)]"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                          {item.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(item)}
                                disabled={actionLoading}
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRejectClick(item)}
                                disabled={actionLoading}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <ApprovalItemDetail
        item={selectedItem}
        detailData={detailData}
        loading={detailLoading}
        open={!!selectedItem}
        onClose={() => {
          setSelectedItem(null);
          setDetailData(null);
        }}
        onApprove={selectedItem ? () => handleApprove(selectedItem) : undefined}
        onReject={selectedItem ? () => handleRejectClick(selectedItem) : undefined}
        actionLoading={actionLoading}
      />

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Reject Item
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this item. This will be logged for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectingItem(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim() || actionLoading}
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
