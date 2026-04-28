"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  X,
  Filter,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalQueueRow } from "@/types/compliance";

// ─── Constants ─────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: ApprovalQueueRow["status"] | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "escalated", label: "Escalated" },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ApprovalQueuePage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ApprovalQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApprovalQueueRow["status"] | "all">("pending");

  const [selectedItem, setSelectedItem] = useState<ApprovalQueueRow | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingItem, setRejectingItem] = useState<ApprovalQueueRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      let query = supabase
        .from("approval_queue")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      setItems((data || []) as any);
    } catch (err) {
      console.error("Error fetching approval queue:", err);
      setError("Failed to load approval queue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      void fetchItems();
    }
  }, [authLoading, user, statusFilter]);

  async function handleApprove(item: ApprovalQueueRow) {
    setActionLoading(true);
    try {
      const response = await fetch("/api/approval-queue/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve item");
      }

      void fetchItems();
      setSelectedItem(null);
    } catch (err) {
      console.error("Error approving item:", err);
      setError("Failed to approve item. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleRejectClick(item: ApprovalQueueRow) {
    setRejectingItem(item);
    setRejectReason("");
    setRejectModalOpen(true);
  }

  async function handleConfirmReject() {
    if (!rejectingItem) return;
    setActionLoading(true);
    try {
      const response = await fetch("/api/approval-queue/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: rejectingItem.id,
          reason: rejectReason,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject item");
      }

      void fetchItems();
      setRejectModalOpen(false);
      setRejectingItem(null);
      setRejectReason("");
      setSelectedItem(null);
    } catch (err) {
      console.error("Error rejecting item:", err);
      setError("Failed to reject item. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

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
                    <TableHead>Status</TableHead>
                    <TableHead>Case</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[var(--fg-secondary)] text-sm font-mono">
                          {item.case_type ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[var(--fg-muted)] text-sm font-mono">
                          {item.entity_type ?? "—"} {item.entity_id ? `• ${String(item.entity_id).slice(0, 8)}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[var(--fg-muted)] text-sm font-mono">
                          {typeof item.ai_confidence === "number" ? item.ai_confidence.toFixed(2) : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[var(--fg-muted)] text-sm">
                          {formatTimeAgo(new Date(item.updated_at))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItem(item)}
                            className="text-[var(--fg-secondary)]"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open
                          </Button>
                          {item.status === "pending" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(item)}
                                disabled={actionLoading}
                                className="text-[var(--signal-positive)] hover:bg-[var(--surface-container)]"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRejectClick(item)}
                                disabled={actionLoading}
                                className="text-[var(--signal-negative)] hover:bg-[var(--surface-container)]"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          ) : null}
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

      {/* Details drawer (simple dialog) */}
      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => setSelectedItem(open ? selectedItem : null)}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--fg-muted)]" />
              Review AI draft
              <span className="ml-2 text-xs font-mono text-[var(--fg-muted)]">
                {selectedItem?.id ? String(selectedItem.id).slice(0, 8) : ""}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
              <div className="text-xs label-caps">AI draft</div>
              <pre className="mt-2 max-h-[420px] overflow-auto text-[12px] leading-relaxed text-[var(--fg-primary)]">
                {selectedItem?.ai_draft ? JSON.stringify(selectedItem.ai_draft, null, 2) : "—"}
              </pre>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
              <div className="text-xs label-caps">Citations</div>
              <pre className="mt-2 max-h-[420px] overflow-auto text-[12px] leading-relaxed text-[var(--fg-primary)]">
                {selectedItem?.citations ? JSON.stringify(selectedItem.citations, null, 2) : "—"}
              </pre>
            </div>
          </div>

          <DialogFooter>
            {selectedItem?.status === "pending" ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedItem(null)}
                  className="h-10"
                >
                  Close
                </Button>
                <Button
                  onClick={() => (selectedItem ? handleApprove(selectedItem) : null)}
                  disabled={actionLoading}
                  className="h-10"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => (selectedItem ? handleRejectClick(selectedItem) : null)}
                  disabled={actionLoading}
                  className="h-10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setSelectedItem(null)} className="h-10">
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--signal-negative)]" />
              Reject Item
            </DialogTitle>
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
