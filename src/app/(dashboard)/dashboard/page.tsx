"use client";

import * as React from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeAgo } from "@/lib/utils";
import type { ApprovalQueueRow, AuditLogRow } from "@/types/compliance";

type Stat = { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> };

export default function DashboardHomePage() {
  const [queue, setQueue] = React.useState<ApprovalQueueRow[]>([]);
  const [activity, setActivity] = React.useState<AuditLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      setLoading(true);
      const [q, a] = await Promise.all([
        supabase
          .from("approval_queue")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!mounted) return;
      setQueue((q.data || []) as any);
      setActivity((a.data || []) as any);
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel("dashboard-home")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_queue" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, () => void load())
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const pending = queue.filter((q) => q.status === "pending").length;
  const approved = queue.filter((q) => q.status === "approved").length;
  const rejected = queue.filter((q) => q.status === "rejected").length;

  const stats: Stat[] = [
    { label: "Pending approvals", value: loading ? "—" : String(pending), icon: ListChecks, hint: "Maker-checker queue" },
    { label: "Approved (24h)", value: loading ? "—" : String(approved), icon: CheckCircle2, hint: "Recent throughput" },
    { label: "Rejected (24h)", value: loading ? "—" : String(rejected), icon: AlertTriangle, hint: "Needs remediation" },
    { label: "Last activity", value: loading || activity.length === 0 ? "—" : formatTimeAgo(new Date(activity[0]!.created_at)), icon: Clock },
  ];

  return (
    <div className="@container/main flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Operations Center
          </div>
          <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em]">
            Compliance activity
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Live queue snapshot + immutable audit trail.
          </p>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex">
          Live
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              className="border-[var(--border-subtle)] bg-linear-to-t from-primary/5 to-[var(--card)] shadow-xs dark:bg-[var(--card)]"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-[var(--muted-foreground)]">{s.label}</span>
                  <Icon className="size-4 text-[var(--muted-foreground)]" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums tracking-[-0.02em]">{s.value}</div>
                {s.hint ? <div className="mt-1 text-xs text-[var(--muted-foreground)]">{s.hint}</div> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[var(--border-subtle)] bg-[var(--card)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="size-4 text-[var(--muted-foreground)]" />
              Queue snapshot
              <Badge variant="outline" className="ml-auto text-xs">
                {loading ? "loading" : `${pending} pending`}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loading ? [] : queue.slice(0, 8)).map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">
                    {q.case_type ?? "case"} • {q.entity_type ?? "entity"}
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-[var(--muted-foreground)]">
                    {String(q.id).slice(0, 8)} • conf={typeof q.ai_confidence === "number" ? q.ai_confidence.toFixed(2) : "—"}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {q.status ?? "—"}
                </Badge>
              </div>
            ))}
            {!loading && queue.length === 0 ? (
              <div className="text-sm text-[var(--muted-foreground)]">No queue items yet.</div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-[var(--border-subtle)] bg-[var(--card)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-[var(--muted-foreground)]" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loading ? [] : activity).map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{a.action_type}</div>
                  <div className="mt-0.5 text-[11px] font-mono text-[var(--muted-foreground)]">
                    {a.entity_type ?? "—"} • {a.entity_id ? String(a.entity_id).slice(0, 8) : "—"} • {a.actor_email}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] font-mono text-[var(--muted-foreground)]">
                  {formatTimeAgo(new Date(a.created_at))}
                </div>
              </div>
            ))}
            {!loading && activity.length === 0 ? (
              <div className="text-sm text-[var(--muted-foreground)]">No audit activity yet.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

