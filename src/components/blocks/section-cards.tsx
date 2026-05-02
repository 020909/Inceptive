"use client";

import * as React from "react";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  ShieldAlert,
  FileText,
  ArrowRightLeft,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase";

type ComplianceMetrics = {
  loading: boolean;
  openAlerts: number;
  criticalAlerts: number;
  pendingSARs: number;
  filedSARs: number;
  activeCases: number;
  reconMatchRate: number | null;
  pendingApprovals: number;
  avgAIConfidence: number | null;
  alertTrendDelta: number;
};

const initialMetrics: ComplianceMetrics = {
  loading: true,
  openAlerts: 0,
  criticalAlerts: 0,
  pendingSARs: 0,
  filedSARs: 0,
  activeCases: 0,
  reconMatchRate: null,
  pendingApprovals: 0,
  avgAIConfidence: null,
  alertTrendDelta: 0,
};

function dayAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function loadMetrics(): Promise<Omit<ComplianceMetrics, "loading">> {
  const supabase = createClient();
  const since24h = dayAgo(24);

  const [
    openAlertsRes,
    criticalAlertsRes,
    pendingSARsRes,
    filedSARsRes,
    activeCasesRes,
    pendingApprovalsRes,
    recentConfidenceRes,
    newAlerts24hRes,
  ] = await Promise.all([
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "triaging", "escalated"]),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .in("status", ["new", "triaging", "escalated"]),
    supabase
      .from("sar_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("sar_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "filed"),
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "under_review", "escalated"]),
    supabase
      .from("approval_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("approval_queue")
      .select("ai_confidence")
      .not("ai_confidence", "is", null)
      .limit(200),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since24h),
  ]);

  const latestReconRes = await supabase
    .from("reconciliation_runs")
    .select("matched_count, total_source_a, total_source_b")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1);

  let reconMatchRate: number | null = null;
  if (latestReconRes.data && latestReconRes.data.length > 0) {
    const r = latestReconRes.data[0];
    const total = (r.total_source_a + r.total_source_b) / 2;
    if (total > 0) reconMatchRate = (r.matched_count / total) * 100;
  }

  const avg = (rows: Array<{ ai_confidence: number | null }> | null | undefined): number | null => {
    if (!rows || rows.length === 0) return null;
    const vals = rows.map((r) => r.ai_confidence).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  return {
    openAlerts: openAlertsRes.count ?? 0,
    criticalAlerts: criticalAlertsRes.count ?? 0,
    pendingSARs: pendingSARsRes.count ?? 0,
    filedSARs: filedSARsRes.count ?? 0,
    activeCases: activeCasesRes.count ?? 0,
    reconMatchRate,
    pendingApprovals: pendingApprovalsRes.count ?? 0,
    avgAIConfidence: avg(recentConfidenceRes.data as Array<{ ai_confidence: number | null }> | null),
    alertTrendDelta: newAlerts24hRes.count ?? 0,
  };
}

function TrendBadge({ delta, label }: { delta: number | null; label?: string }) {
  if (delta === null) {
    return (
      <Badge variant="outline">
        <MinusIcon />
        {label || "No data"}
      </Badge>
    );
  }
  if (delta > 0) {
    return (
      <Badge variant="outline">
        <TrendingUpIcon />
        +{delta}
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge variant="outline">
        <TrendingDownIcon />
        {delta}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <MinusIcon />0%
    </Badge>
  );
}

function CardSkeletonValue() {
  return <Skeleton className="h-8 w-20" />;
}

export function SectionCards() {
  const [metrics, setMetrics] = React.useState<ComplianceMetrics>(initialMetrics);

  React.useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const refresh = async () => {
      try {
        const data = await loadMetrics();
        if (mounted) setMetrics({ loading: false, ...data });
      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
        if (mounted) setMetrics((m) => ({ ...m, loading: false }));
      }
    };

    void refresh();

    const channel = supabase
      .channel("dashboard-compliance-metrics")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_queue" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "sar_drafts" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, () => void refresh())
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Open Alerts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? <CardSkeletonValue /> : metrics.openAlerts.toLocaleString()}
          </CardTitle>
          <CardAction>
            {metrics.loading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <Badge variant={metrics.criticalAlerts > 0 ? "negative" : "outline"}>
                {metrics.criticalAlerts > 0 ? (
                  <ShieldAlert className="size-3.5" />
                ) : (
                  <MinusIcon />
                )}
                {metrics.criticalAlerts > 0
                  ? `${metrics.criticalAlerts} critical`
                  : "No critical"}
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            AML triage queue
            {!metrics.loading && metrics.alertTrendDelta > 0 && (
              <TrendingUpIcon className="size-4 text-red-400" />
            )}
          </div>
          <div className="text-muted-foreground">
            {metrics.loading ? "Loading..." : `${metrics.alertTrendDelta} new in last 24h`}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>SAR Drafts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? (
              <CardSkeletonValue />
            ) : (
              <span className="flex items-baseline gap-2">
                {metrics.pendingSARs.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground">
                  / {metrics.filedSARs.toLocaleString()} filed
                </span>
              </span>
            )}
          </CardTitle>
          <CardAction>
            {metrics.loading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <Badge variant="outline">
                <FileText className="size-3.5" />
                {metrics.pendingSARs + metrics.filedSARs} total
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">FinCEN filing pipeline</div>
          <div className="text-muted-foreground">
            {metrics.loading ? "Loading..." : `${metrics.pendingSARs} awaiting review`}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Reconciliation</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? (
              <CardSkeletonValue />
            ) : metrics.reconMatchRate === null ? (
              "—"
            ) : (
              `${metrics.reconMatchRate.toFixed(1)}%`
            )}
          </CardTitle>
          <CardAction>
            {metrics.loading ? (
              <Skeleton className="h-5 w-16" />
            ) : metrics.reconMatchRate === null ? (
              <Badge variant="outline">
                <MinusIcon />No runs
              </Badge>
            ) : metrics.reconMatchRate >= 99 ? (
              <Badge variant="positive">
                <TrendingUpIcon />Healthy
              </Badge>
            ) : metrics.reconMatchRate >= 95 ? (
              <Badge variant="outline">
                <MinusIcon />Acceptable
              </Badge>
            ) : (
              <Badge variant="negative">
                <TrendingDownIcon />Below target
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Match rate (latest run)</div>
          <div className="text-muted-foreground">
            {metrics.loading ? "Loading..." : "Target: ≥99% straight-through"}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>AI Confidence</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? (
              <CardSkeletonValue />
            ) : metrics.avgAIConfidence === null ? (
              "—"
            ) : (
              `${(metrics.avgAIConfidence * 100).toFixed(1)}%`
            )}
          </CardTitle>
          <CardAction>
            {metrics.loading ? (
              <Skeleton className="h-5 w-16" />
            ) : metrics.avgAIConfidence === null ? (
              <Badge variant="outline">
                <MinusIcon />No data
              </Badge>
            ) : metrics.avgAIConfidence >= 0.85 ? (
              <Badge variant="positive">
                <TrendingUpIcon />High
              </Badge>
            ) : metrics.avgAIConfidence >= 0.7 ? (
              <Badge variant="outline">
                <MinusIcon />Moderate
              </Badge>
            ) : (
              <Badge variant="negative">
                <TrendingDownIcon />Low
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Model assurance</div>
          <div className="text-muted-foreground">
            {metrics.loading
              ? "Loading..."
              : `${metrics.pendingApprovals} pending approvals · ${metrics.activeCases} active cases`}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
