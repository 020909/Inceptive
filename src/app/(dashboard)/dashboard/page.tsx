"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Briefcase,
  Clock,
  FileText,
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Loader2,
  Sparkles,
  RefreshCw,
  Bot,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────

type CaseStatus =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "escalated"
  | "closed";

interface CaseStatusCount {
  status: CaseStatus;
  count: number;
}

interface AuditTrailEntry {
  id: string;
  event_type: string;
  event_description: string;
  actor: string | null;
  created_at: string;
}

interface PendingApprovalItem {
  id: string;
  title: string;
  approval_type: string;
  ai_recommendation: string | null;
  created_at: string;
  expires_at: string | null;
}

interface ActiveAgent {
  id: string;
  agent_type: string;
  case_title: string | null;
  status: string;
  created_at: string;
}

interface DashboardMetrics {
  openCases: number;
  pendingApprovals: number;
  documentsProcessed: number;
  agentRunsToday: number;
}

interface DashboardData {
  metrics: DashboardMetrics;
  caseStatusCounts: CaseStatusCount[];
  recentAuditTrail: AuditTrailEntry[];
  pendingApprovals: PendingApprovalItem[];
  activeAgents: ActiveAgent[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CaseStatus, string> = {
  pending: "#9ca3af", // gray-400
  in_progress: "#3b82f6", // blue-500
  awaiting_approval: "#eab308", // yellow-500
  approved: "#22c55e", // green-500
  rejected: "#ef4444", // red-500
  escalated: "#f97316", // orange-500
  closed: "#6b7280", // gray-500
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
  closed: "Closed",
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getStartOfDay(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function formatSLACountdown(expiresAt: string | null): string {
  if (!expiresAt) return "No SLA";
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return "Overdue";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getEventTypeBadgeVariant(eventType: string): "default" | "info" | "positive" | "negative" | "warning" | "outline" {
  const type = eventType.toLowerCase();
  if (type.includes("create") || type.includes("add")) return "info";
  if (type.includes("approve") || type.includes("complete")) return "positive";
  if (type.includes("reject") || type.includes("fail") || type.includes("error")) return "negative";
  if (type.includes("warning") || type.includes("alert")) return "warning";
  return "default";
}

function getAIRecommendationBadgeColor(recommendation: string | null): string {
  if (!recommendation) return "bg-[var(--fg-muted)]";
  const lower = recommendation.toLowerCase();
  if (lower.includes("approve")) return "bg-emerald-500";
  if (lower.includes("reject")) return "bg-red-500";
  if (lower.includes("review")) return "bg-amber-500";
  return "bg-blue-500";
}

// ─── Components ────────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon: Icon,
  href,
  isLoading,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  isLoading: boolean;
}) {
  return (
    <Link href={href} className="block">
      <Card className="group cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)]">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--fg-muted)]">{title}</p>
              {isLoading ? (
                <Skeleton className="mt-2 h-10 w-20" />
              ) : (
                <p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--fg-primary)]">
                  {value.toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent-soft)]">
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CasesByStatusChart({
  data,
  isLoading,
}: {
  data: CaseStatusCount[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle>Cases by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.filter((item) => item.status !== "closed");

  return (
    <Card className="h-[400px]">
      <CardHeader>
        <CardTitle>Cases by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="status"
                tickFormatter={(value: CaseStatus) => STATUS_LABELS[value]}
                tick={{ fill: "var(--fg-primary)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip
contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "12px",
                    color: "var(--fg-primary)",
                  }}
                  cursor={{ fill: "transparent" }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={28}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(STATUS_COLORS)
            .filter(([status]) => status !== "closed")
            .map(([status, color]) => {
              const count = data.find((d) => d.status === status)?.count ?? 0;
              return (
                <div key={status} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-[var(--fg-muted)]">
                    {STATUS_LABELS[status as CaseStatus]} ({count})
                  </span>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentAuditTrailWidget({
  data,
  isLoading,
}: {
  data: AuditTrailEntry[];
  isLoading: boolean;
}) {
  return (
    <Card className="h-[400px]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Audit Trail</CardTitle>
        <Link href="/audit-trail">
          <Button variant="ghost" size="sm" className="text-[var(--accent)]">
            View All
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[280px] flex-col items-center justify-center text-center">
            <Activity className="h-10 w-10 text-[var(--fg-muted)] opacity-40" />
            <p className="mt-4 text-sm text-[var(--fg-muted)]">No audit trail entries yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 transition-colors hover:border-[var(--border-strong)]"
              >
                <Badge variant={getEventTypeBadgeVariant(entry.event_type)} className="shrink-0">
                  {entry.event_type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--fg-primary)]">{entry.event_description}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                    <span>{entry.actor ?? "System"}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(new Date(entry.created_at))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingApprovalsWidget({
  data,
  isLoading,
}: {
  data: PendingApprovalItem[];
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pending Approvals</CardTitle>
        <Link href="/approval-queue">
          <Button variant="ghost" size="sm" className="text-[var(--accent)]">
            View All
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] py-10 text-center">
            <CheckCircle className="h-10 w-10 text-[var(--success)]" />
            <p className="mt-4 text-sm text-[var(--fg-muted)]">No pending approvals</p>
            <p className="text-xs text-[var(--fg-muted)]">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <div
                key={item.id}
                className="group flex flex-col gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 transition-all hover:border-[var(--border-strong)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--fg-primary)]">{item.title}</p>
                    <p className="text-xs text-[var(--fg-muted)]">{item.approval_type}</p>
                  </div>
                  <Link href="/approval-queue">
                    <Button
                      size="sm"
                      className="shrink-0 bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
                    >
                      Review Now
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  {item.ai_recommendation && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          getAIRecommendationBadgeColor(item.ai_recommendation)
                        )}
                      />
                      <span className="text-xs text-[var(--fg-muted)]">{item.ai_recommendation}</span>
                    </div>
                  )}
                  {item.expires_at && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3 w-3 text-[var(--fg-muted)]" />
                      <span
                        className={cn(
                          formatSLACountdown(item.expires_at) === "Overdue"
                            ? "text-red-500"
                            : "text-[var(--fg-muted)]"
                        )}
                      >
                        SLA: {formatSLACountdown(item.expires_at)}
                      </span>
                    </div>
                  )}
                  <span className="ml-auto text-xs text-[var(--fg-muted)]">
                    {formatTimeAgo(new Date(item.created_at))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveAgentsPanel({
  data,
  isLoading,
}: {
  data: ActiveAgent[];
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Active Agents</CardTitle>
          {data.length > 0 && (
            <Badge variant="info" className="animate-pulse">
              {data.length} running
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--fg-muted)]" />
          <span className="text-xs text-[var(--fg-muted)]">Auto-refresh</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] py-12 text-center">
            <Bot className="h-12 w-12 text-[var(--fg-muted)] opacity-40" />
            <p className="mt-4 text-sm text-[var(--fg-primary)]">No active agents running.</p>
            <p className="text-xs text-[var(--fg-muted)]">Agents will appear here when processing cases.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                  <Sparkles className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[var(--fg-primary)]">{agent.agent_type}</p>
                    <Badge variant="info" className="animate-pulse text-[10px]">
                      Running
                    </Badge>
                  </div>
                  {agent.case_title && (
                    <p className="truncate text-sm text-[var(--fg-muted)]">{agent.case_title}</p>
                  )}
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-500">{message}</p>
        <Button variant="ghost" size="sm" onClick={onRetry} className="ml-auto border-red-500/30 text-red-500">
          Retry
        </Button>
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────

export default function OperationsCenterPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData>({
    metrics: {
      openCases: 0,
      pendingApprovals: 0,
      documentsProcessed: 0,
      agentRunsToday: 0,
    },
    caseStatusCounts: [],
    recentAuditTrail: [],
    pendingApprovals: [],
    activeAgents: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    setError(null);
    const supabase = createClient();
    const todayStart = getStartOfDay();

    try {
      // Fetch all data in parallel
      const [
        openCasesResult,
        pendingApprovalsResult,
        documentsResult,
        agentRunsResult,
        caseStatusResult,
        auditTrailResult,
        pendingQueueResult,
        activeAgentsResult,
      ] = await Promise.all([
        // Open Cases: status != 'approved' AND status != 'closed'
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .neq("status", "approved")
          .neq("status", "closed"),

        // Pending Approvals: status = 'pending'
        supabase
          .from("approval_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        // Documents Processed: parsing_status = 'completed'
        supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("parsing_status", "completed"),

        // Agent Runs Today: created_at >= today
        supabase
          .from("agent_runs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),

        // Cases by Status
        supabase
          .from("cases")
          .select("status")
          .then((result) => {
            if (result.error) throw result.error;
            const counts: Record<string, number> = {};
            result.data?.forEach((row) => {
              counts[row.status] = (counts[row.status] ?? 0) + 1;
            });
            const statusOrder: CaseStatus[] = [
              "pending",
              "in_progress",
              "awaiting_approval",
              "approved",
              "rejected",
              "escalated",
              "closed",
            ];
            return {
              data: statusOrder.map((status) => ({
                status,
                count: counts[status] ?? 0,
              })),
            };
          }),

        // Recent Audit Trail
        supabase
          .from("audit_trail")
          .select("id, event_type, event_description, actor, created_at")
          .order("created_at", { ascending: false })
          .limit(10),

        // Pending Approvals Queue
        supabase
          .from("approval_queue")
          .select("id, title, approval_type, ai_recommendation, created_at, expires_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(5),

        // Active Agents
        supabase
          .from("agent_runs")
          .select("id, agent_type, case_title, status, created_at")
          .eq("status", "running")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // Handle results
      const metrics: DashboardMetrics = {
        openCases: openCasesResult.count ?? 0,
        pendingApprovals: pendingApprovalsResult.count ?? 0,
        documentsProcessed: documentsResult.count ?? 0,
        agentRunsToday: agentRunsResult.count ?? 0,
      };

      setData({
        metrics,
        caseStatusCounts: caseStatusResult.data ?? [],
        recentAuditTrail: auditTrailResult.data ?? [],
        pendingApprovals: pendingQueueResult.data ?? [],
        activeAgents: activeAgentsResult.data ?? [],
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    if (!authLoading && user) {
      void fetchDashboardData();
    }
  }, [authLoading, user, fetchDashboardData]);

  // Poll for active agents every 10 seconds
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      const supabase = createClient();
      supabase
        .from("agent_runs")
        .select("id, agent_type, case_title, status, created_at")
        .eq("status", "running")
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data, error }) => {
          if (!error) {
            setData((prev) => ({ ...prev, activeAgents: data ?? [] }));
          }
        });
    }, 10000);

    return () => clearInterval(interval);
  }, [user?.id]);

  // Realtime subscription for active agents
  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel("active-agents")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: "status=eq.running",
        },
        () => {
          // Refetch active agents when changes occur
          void fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, fetchDashboardData]);

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)] md:text-4xl">
              Operations Center
            </h1>
            <p className="mt-2 text-base text-[var(--fg-muted)]">
              Monitor cases, approvals, and agent activity across your organization.
            </p>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" />}
        </div>
      </div>

      {/* Error Banner */}
      {error && <ErrorBanner message={error} onRetry={fetchDashboardData} />}

      {/* Metrics Cards Row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Open Cases"
          value={data.metrics.openCases}
          icon={Briefcase}
          href="/cases"
          isLoading={loading}
        />
        <MetricCard
          title="Pending Approvals"
          value={data.metrics.pendingApprovals}
          icon={Clock}
          href="/approval-queue"
          isLoading={loading}
        />
        <MetricCard
          title="Documents Processed"
          value={data.metrics.documentsProcessed}
          icon={FileText}
          href="/documents"
          isLoading={loading}
        />
        <MetricCard
          title="Agent Runs Today"
          value={data.metrics.agentRunsToday}
          icon={Activity}
          href="/agent"
          isLoading={loading}
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Cases by Status Chart */}
          <CasesByStatusChart data={data.caseStatusCounts} isLoading={loading} />

          {/* Recent Audit Trail */}
          <RecentAuditTrailWidget data={data.recentAuditTrail} isLoading={loading} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Pending Approvals */}
          <PendingApprovalsWidget data={data.pendingApprovals} isLoading={loading} />

          {/* Active Agents */}
          <ActiveAgentsPanel data={data.activeAgents} isLoading={loading} />
        </div>
      </div>
    </div>
  );
}
