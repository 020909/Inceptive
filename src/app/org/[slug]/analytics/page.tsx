import { redirect } from "next/navigation";
import { BarChart2 } from "lucide-react";
import { AnalyticsActivityChart } from "@/components/org/analytics-activity-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";

interface OrgAnalyticsPageProps {
  params: Promise<{ slug: string }>;
}

function formatChartDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function OrgAnalyticsPage({ params }: OrgAnalyticsPageProps) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organization = await getOrgBySlug(slug, supabase);
  if (!organization) {
    redirect("/dashboard?error=org-access-denied");
  }

  const membership = await getOrgMembershipForUser(organization.id, user.id, supabase);
  if (!membership || membership.role !== "admin") {
    redirect("/dashboard?error=org-access-denied");
  }

  const admin = createAdminSupabaseClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const chartStart = new Date();
  chartStart.setDate(chartStart.getDate() - 13);
  chartStart.setHours(0, 0, 0, 0);

  const [
    agentRunsResult,
    tasksResult,
    workflowsResult,
    membersResult,
    activityLogResult,
    monthlyReportRunsResult,
    failedActionsResult,
    pendingReviewsResult,
    approvalRequestsResult,
  ] = await Promise.all([
    admin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("event_name", "agent_run_triggered")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("agent_activity_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "completed"),
    admin
      .from("org_workflows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "active"),
    admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    admin
      .from("agent_activity_log")
      .select("created_at, action_type, metadata")
      .eq("organization_id", organization.id)
      .gte("created_at", chartStart.toISOString())
      .order("created_at", { ascending: true }),
    admin
      .from("agent_activity_log")
      .select("metadata")
      .eq("organization_id", organization.id)
      .eq("action_type", "overnight_run_complete")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("agent_activity_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "failed")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("agent_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "pending"),
    admin
      .from("agent_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .gte("created_at", monthStart.toISOString()),
  ]);

  const countByDay = new Map<string, number>();
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(chartStart);
    date.setDate(chartStart.getDate() + index);
    countByDay.set(date.toISOString().slice(0, 10), 0);
  }

  for (const row of activityLogResult.data ?? []) {
    const key = new Date(row.created_at as string).toISOString().slice(0, 10);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const hoursSavedThisMonth = (monthlyReportRunsResult.data ?? []).reduce((total, row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const hoursSaved = typeof metadata.hoursSaved === "number" ? metadata.hoursSaved : Number(metadata.hoursSaved ?? 0);
    return total + (Number.isFinite(hoursSaved) ? hoursSaved : 0);
  }, 0);

  const chartData = [...countByDay.entries()].map(([date, count]) => ({
    date: formatChartDate(date),
    count,
  }));

  return (
    <section className="mx-auto flex min-h-full w-full max-w-7xl px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                  <BarChart2 size={20} className="text-[var(--fg-primary)]" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Analytics</p>
                  <h1 className="text-4xl text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-header)" }}>
                    {organization.name} analytics
                  </h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-[var(--fg-secondary)]">
                Analytics from your existing Supabase activity and event data. No external analytics service required.
              </p>
            </div>

            <div className="space-y-3 text-left lg:text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                Powered by Supabase activity and event data
              </p>
              <p className="text-sm text-[var(--fg-secondary)]">
                Live metrics from the same backend that powers the product.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Agent Runs This Month</CardDescription>
              <CardTitle className="text-3xl">{agentRunsResult.count ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Tasks Completed</CardDescription>
              <CardTitle className="text-3xl">{tasksResult.count ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Active Workflows</CardDescription>
              <CardTitle className="text-3xl">{workflowsResult.count ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Team Members</CardDescription>
              <CardTitle className="text-3xl">{membersResult.count ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Hours Saved This Month</CardDescription>
              <CardTitle className="text-3xl">{hoursSavedThisMonth.toFixed(hoursSavedThisMonth % 1 === 0 ? 0 : 1)}h</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Pending Approvals</CardDescription>
              <CardTitle className="text-3xl">{pendingReviewsResult.count ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Failed Actions This Month</CardDescription>
              <CardTitle className="text-3xl">{failedActionsResult.count ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="rounded-[32px]">
          <CardHeader className="border-b border-[var(--border-subtle)]">
            <CardTitle>Governance Snapshot</CardTitle>
            <CardDescription>Approval pressure and operational reliability across the workspace.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Approval requests this month</p>
              <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">{approvalRequestsResult.count ?? 0}</p>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                A higher number means more actions are being routed through human review instead of auto-executing.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Run reliability</p>
              <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">
                {(agentRunsResult.count ?? 0) > 0
                  ? `${Math.max(0, 100 - Math.round(((failedActionsResult.count ?? 0) / Math.max(agentRunsResult.count ?? 1, 1)) * 100))}%`
                  : "100%"}
              </p>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                Derived from failed actions relative to tracked monthly runs. This is directional and updates from live activity.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader className="border-b border-[var(--border-subtle)]">
            <CardTitle>Agent Runs Per Day</CardTitle>
            <CardDescription>Last 14 days of activity from `agent_activity_log`.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <AnalyticsActivityChart data={chartData} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
