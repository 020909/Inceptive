"use client";

import * as React from "react";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
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

type Metrics = {
  loading: boolean;
  pending: number;
  pendingDelta: number; // pending now - pending 24h ago (proxy: created within last 24h)
  approved24h: number;
  approvedPrev: number;
  rejected24h: number;
  rejectedPrev: number;
  avgConfidence: number | null; // 0-1
  prevAvgConfidence: number | null;
};

const initialMetrics: Metrics = {
  loading: true,
  pending: 0,
  pendingDelta: 0,
  approved24h: 0,
  approvedPrev: 0,
  rejected24h: 0,
  rejectedPrev: 0,
  avgConfidence: null,
  prevAvgConfidence: null,
};

function dayAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function loadMetrics(): Promise<Omit<Metrics, "loading">> {
  const supabase = createClient();
  const since24h = dayAgo(24);
  const since48h = dayAgo(48);

  const [pendingRes, approved24Res, approved48Res, rejected24Res, rejected48Res, conf24Res, conf48Res] =
    await Promise.all([
      supabase
        .from("approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .gte("updated_at", since24h),
      supabase
        .from("approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .gte("updated_at", since48h)
        .lt("updated_at", since24h),
      supabase
        .from("approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected")
        .gte("updated_at", since24h),
      supabase
        .from("approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected")
        .gte("updated_at", since48h)
        .lt("updated_at", since24h),
      supabase
        .from("approval_queue")
        .select("ai_confidence")
        .gte("updated_at", since24h)
        .not("ai_confidence", "is", null)
        .limit(500),
      supabase
        .from("approval_queue")
        .select("ai_confidence")
        .gte("updated_at", since48h)
        .lt("updated_at", since24h)
        .not("ai_confidence", "is", null)
        .limit(500),
    ]);

  const pendingCreated24Res = await supabase
    .from("approval_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gte("created_at", since24h);

  const avg = (rows: Array<{ ai_confidence: number | null }> | null | undefined): number | null => {
    if (!rows || rows.length === 0) return null;
    const vals = rows.map((r) => r.ai_confidence).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  return {
    pending: pendingRes.count ?? 0,
    pendingDelta: pendingCreated24Res.count ?? 0,
    approved24h: approved24Res.count ?? 0,
    approvedPrev: approved48Res.count ?? 0,
    rejected24h: rejected24Res.count ?? 0,
    rejectedPrev: rejected48Res.count ?? 0,
    avgConfidence: avg(conf24Res.data as Array<{ ai_confidence: number | null }> | null),
    prevAvgConfidence: avg(conf48Res.data as Array<{ ai_confidence: number | null }> | null),
  };
}

function pctDelta(current: number, prev: number): number | null {
  if (prev === 0 && current === 0) return 0;
  if (prev === 0) return null; // undefined growth from 0
  return ((current - prev) / prev) * 100;
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <Badge variant="outline">
        <MinusIcon />
        New
      </Badge>
    );
  }
  if (delta > 0) {
    return (
      <Badge variant="outline">
        <TrendingUpIcon />
        +{delta.toFixed(1)}%
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge variant="outline">
        <TrendingDownIcon />
        {delta.toFixed(1)}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <MinusIcon />
      0%
    </Badge>
  );
}

function CardSkeletonValue() {
  return <Skeleton className="h-8 w-20" />;
}

export function SectionCards() {
  const [metrics, setMetrics] = React.useState<Metrics>(initialMetrics);

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
      .channel("dashboard-section-cards")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_queue" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const approvedDelta = pctDelta(metrics.approved24h, metrics.approvedPrev);
  const rejectedDelta = pctDelta(metrics.rejected24h, metrics.rejectedPrev);
  const confidenceDelta =
    metrics.avgConfidence !== null && metrics.prevAvgConfidence !== null
      ? (metrics.avgConfidence - metrics.prevAvgConfidence) * 100
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Pending approvals</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? <CardSkeletonValue /> : metrics.pending.toLocaleString()}
          </CardTitle>
          <CardAction>
            {metrics.loading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <Badge variant="outline">
                {metrics.pendingDelta > 0 ? <TrendingUpIcon /> : <MinusIcon />}
                {metrics.pendingDelta > 0 ? `+${metrics.pendingDelta} new` : "0 new"}
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Maker-checker queue
          </div>
          <div className="text-muted-foreground">
            Awaiting analyst review
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Approved (24h)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? <CardSkeletonValue /> : metrics.approved24h.toLocaleString()}
          </CardTitle>
          <CardAction>
            {metrics.loading ? <Skeleton className="h-5 w-16" /> : <TrendBadge delta={approvedDelta} />}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Recent throughput
            {!metrics.loading && approvedDelta !== null && approvedDelta >= 0 ? (
              <TrendingUpIcon className="size-4" />
            ) : !metrics.loading && approvedDelta !== null ? (
              <TrendingDownIcon className="size-4" />
            ) : null}
          </div>
          <div className="text-muted-foreground">
            vs. prior 24h window
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Rejected (24h)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? <CardSkeletonValue /> : metrics.rejected24h.toLocaleString()}
          </CardTitle>
          <CardAction>
            {metrics.loading ? <Skeleton className="h-5 w-16" /> : <TrendBadge delta={rejectedDelta} />}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Needs remediation
            {!metrics.loading && rejectedDelta !== null && rejectedDelta > 0 ? (
              <TrendingUpIcon className="size-4" />
            ) : !metrics.loading && rejectedDelta !== null && rejectedDelta < 0 ? (
              <TrendingDownIcon className="size-4" />
            ) : null}
          </div>
          <div className="text-muted-foreground">
            vs. prior 24h window
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Avg AI confidence</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.loading ? (
              <CardSkeletonValue />
            ) : metrics.avgConfidence === null ? (
              "—"
            ) : (
              `${(metrics.avgConfidence * 100).toFixed(1)}%`
            )}
          </CardTitle>
          <CardAction>
            {metrics.loading ? (
              <Skeleton className="h-5 w-16" />
            ) : confidenceDelta === null ? (
              <Badge variant="outline">
                <MinusIcon />
                No prior
              </Badge>
            ) : confidenceDelta >= 0 ? (
              <Badge variant="outline">
                <TrendingUpIcon />
                +{confidenceDelta.toFixed(1)}pp
              </Badge>
            ) : (
              <Badge variant="outline">
                <TrendingDownIcon />
                {confidenceDelta.toFixed(1)}pp
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Model assurance
          </div>
          <div className="text-muted-foreground">
            Across reviewed cases (24h)
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
