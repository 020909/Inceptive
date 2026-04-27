"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ReviewQueueItemWithRequester } from "@/lib/supabase/org-governance";

interface ReviewQueuePanelProps {
  orgId: string;
  canReview: boolean;
  initialItems: ReviewQueueItemWithRequester[];
  title?: string;
  description?: string;
}

function statusVariant(status: ReviewQueueItemWithRequester["status"]): "positive" | "negative" | "default" {
  if (status === "approved") return "positive";
  if (status === "rejected") return "negative";
  return "default";
}

function requestSummary(item: ReviewQueueItemWithRequester) {
  if (item.request_type === "manual_run") {
    const workflows = Array.isArray(item.payload.workflows)
      ? (item.payload.workflows as string[]).join(", ")
      : "";
    return workflows ? `Manual run for workflows: ${workflows}` : "Manual run requested for the workspace.";
  }

  if (item.request_type === "workflow_activate") {
    return `Activate ${typeof item.payload.templateName === "string" ? item.payload.templateName : "workflow template"}.`;
  }

  return `Change status to ${typeof item.payload.nextStatus === "string" ? item.payload.nextStatus : "updated state"}.`;
}

export function ReviewQueuePanel({
  orgId,
  canReview,
  initialItems,
  title = "Review Queue",
  description = "Pending and recent approval requests for this workspace.",
}: ReviewQueuePanelProps) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const pending = items.filter((item) => item.status === "pending").length;
    const approved = items.filter((item) => item.status === "approved").length;
    const rejected = items.filter((item) => item.status === "rejected").length;
    return { pending, approved, rejected };
  }, [items]);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch(`/api/org/review-queue?orgId=${encodeURIComponent(orgId)}&limit=25`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || "Failed to load review queue.");
      }
      setItems((json.items ?? []) as ReviewQueueItemWithRequester[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  async function resolve(id: string, status: "approved" | "rejected") {
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/org/review-queue/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          reviewNotes: notesById[id]?.trim() || undefined,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || "Failed to resolve review request.");
      }

      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...(json.item as ReviewQueueItemWithRequester) } : item))
      );
      setNotesById((current) => ({ ...current, [id]: "" }));
      toast.success(status === "approved" ? "Request approved." : "Request rejected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve review request.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px]">
        <CardHeader className="border-b border-[var(--border-subtle)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ShieldAlert className="text-[var(--fg-primary)]" />
                <CardTitle>{title}</CardTitle>
              </div>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button variant="outline" size="lg" className="h-11 rounded-xl px-5" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Pending</p>
            <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">{stats.pending}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Approved</p>
            <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">{stats.approved}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Rejected</p>
            <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">{stats.rejected}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[32px]">
        <CardHeader className="border-b border-[var(--border-subtle)]">
          <CardTitle>Requests</CardTitle>
          <CardDescription>Every gated workspace action and its review outcome.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-[var(--fg-muted)]">No review requests yet.</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {items.map((item) => {
                const isUpdating = updatingId === item.id;
                return (
                  <div key={item.id} className="px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-medium text-[var(--fg-primary)]">{item.title}</h3>
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-[var(--fg-secondary)]">
                          {item.description || requestSummary(item)}
                        </p>
                        <p className="text-sm text-[var(--fg-muted)]">{requestSummary(item)}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 size={14} />
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                          <span>Requested by {item.requester_name}</span>
                          {item.reviewer_name ? <span>Reviewed by {item.reviewer_name}</span> : null}
                        </div>
                        {item.review_notes ? (
                          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--fg-secondary)]">
                            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Review notes</p>
                            {item.review_notes}
                          </div>
                        ) : null}
                      </div>

                      <div className="w-full max-w-lg space-y-3 lg:w-[360px]">
                        {canReview && item.status === "pending" ? (
                          <>
                            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
                              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                                <MessageSquareText size={14} />
                                Review notes
                              </div>
                              <Textarea
                                value={notesById[item.id] ?? ""}
                                onChange={(event) =>
                                  setNotesById((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                rows={3}
                                placeholder="Leave context for the requester or explain why you rejected this."
                                className="min-h-[96px] border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--fg-primary)]"
                              />
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button
                                size="lg"
                                className="h-11 rounded-xl px-5"
                                onClick={() => resolve(item.id, "approved")}
                                disabled={isUpdating}
                              >
                                {isUpdating ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="lg"
                                className="h-11 rounded-xl px-5"
                                onClick={() => resolve(item.id, "rejected")}
                                disabled={isUpdating}
                              >
                                {isUpdating ? <Loader2 className="animate-spin" /> : <XCircle />}
                                Reject
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div
                            className={cn(
                              "rounded-2xl border px-4 py-3 text-sm",
                              item.status === "approved"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                                : item.status === "rejected"
                                  ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-300"
                                  : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]"
                            )}
                          >
                            {item.status === "pending"
                              ? "Awaiting admin review."
                              : item.status === "approved"
                                ? "Approved and executed."
                                : "Rejected."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
