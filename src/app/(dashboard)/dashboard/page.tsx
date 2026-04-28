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
    <div className="flex flex-col gap-4" style={{ padding: 16 }}>
      <div>
        <div className="text-xs label-caps">Operations Center</div>
        <h2 className="mt-2" style={{ fontSize: 22, lineHeight: 1.2 }}>
          Compliance activity
        </h2>
        <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Live queue snapshot + immutable audit trail.
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-[var(--surface-container)] border-[var(--border-subtle)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  <span>{s.label}</span>
                  <Icon className="size-4 text-[var(--fg-muted)]" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                {s.hint ? <div className="mt-1 text-xs text-[var(--fg-muted)]">{s.hint}</div> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-[var(--surface-container)] border-[var(--border-subtle)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="size-4 text-[var(--fg-muted)]" />
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
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">
                    {q.case_type ?? "case"} • {q.entity_type ?? "entity"}
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-[var(--fg-muted)]">
                    {String(q.id).slice(0, 8)} • conf={typeof q.ai_confidence === "number" ? q.ai_confidence.toFixed(2) : "—"}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {q.status ?? "—"}
                </Badge>
              </div>
            ))}
            {!loading && queue.length === 0 ? (
              <div className="text-xs text-[var(--fg-muted)]">No queue items yet.</div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-container)] border-[var(--border-subtle)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-[var(--fg-muted)]" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loading ? [] : activity).map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{a.action_type}</div>
                  <div className="mt-0.5 text-[11px] font-mono text-[var(--fg-muted)]">
                    {a.entity_type ?? "—"} • {a.entity_id ? String(a.entity_id).slice(0, 8) : "—"} • {a.actor_email}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] font-mono text-[var(--fg-muted)]">
                  {formatTimeAgo(new Date(a.created_at))}
                </div>
              </div>
            ))}
            {!loading && activity.length === 0 ? (
              <div className="text-xs text-[var(--fg-muted)]">No audit activity yet.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

