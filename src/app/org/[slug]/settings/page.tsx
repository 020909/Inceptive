import { redirect } from "next/navigation";
import { AlertTriangle, Clock3, Settings, Shield, ShieldCheck } from "lucide-react";
import { OrgGovernanceSettings } from "@/components/org/org-governance-settings";
import { ReviewQueuePanel } from "@/components/org/review-queue-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  queryGetOrganizationGovernanceSettings,
  queryGetReviewQueue,
} from "@/lib/supabase/org-governance";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";

interface OrgSettingsPageProps {
  params: Promise<{ slug: string }>;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
      <span className="text-sm text-[var(--fg-secondary)]">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium text-[var(--fg-primary)]">
        <span className="inline-block size-2 rounded-full bg-emerald-500" />
        {value}
      </span>
    </div>
  );
}

export default async function OrgSettingsPage({ params }: OrgSettingsPageProps) {
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
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const [settings, reviewQueueItems, rateLimitHitsResult, failedActionsResult, pendingReviewsResult] =
    await Promise.all([
      queryGetOrganizationGovernanceSettings(admin, organization.id),
      queryGetReviewQueue(admin, {
        organizationId: organization.id,
        limit: 12,
      }),
      admin
        .from("rate_limits")
        .select("identifier, route, request_count, window_start")
        .gte("window_start", last24Hours.toISOString())
        .order("request_count", { ascending: false })
        .limit(5),
      admin
        .from("agent_activity_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("status", "failed")
        .gte("created_at", last7Days.toISOString()),
      admin
        .from("agent_review_queue")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("status", "pending"),
    ]);

  if (rateLimitHitsResult.error) {
    throw new Error(rateLimitHitsResult.error.message);
  }

  if (failedActionsResult.error) {
    throw new Error(failedActionsResult.error.message);
  }

  if (pendingReviewsResult.error) {
    throw new Error(pendingReviewsResult.error.message);
  }

  return (
    <section className="mx-auto flex min-h-full w-full max-w-7xl px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                  <Settings size={20} className="text-[var(--fg-primary)]" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Workspace Governance</p>
                  <h1 className="text-4xl text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-header)" }}>
                    Control AI risk in {organization.name}
                  </h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-[var(--fg-secondary)]">
                Decide which actions run automatically, which actions require approval, and how your team reviews them.
                This is the workspace-level control plane for enterprise readiness.
              </p>
            </div>

            <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">Security posture</p>
              <p className="mt-2 text-lg font-medium text-[var(--fg-primary)]">
                {settings.manual_runs_require_approval || settings.workflow_changes_require_approval
                  ? "Governed"
                  : "Autonomous"}
              </p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--fg-muted)]">
                {settings.manual_runs_require_approval || settings.workflow_changes_require_approval
                  ? "Admins review higher-risk workspace actions before they execute."
                  : "Workspace actions run immediately and rely on audit trails for oversight."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Manual Run Approval</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ShieldCheck size={20} />
                {settings.manual_runs_require_approval ? "Required" : "Open"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Workflow Change Approval</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Shield size={20} />
                {settings.workflow_changes_require_approval ? "Required" : "Open"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Pending Reviews</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <Clock3 size={20} />
                {pendingReviewsResult.count ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Failed Actions Last 7 Days</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <AlertTriangle size={20} />
                {failedActionsResult.count ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <OrgGovernanceSettings orgId={organization.id} initialSettings={settings} />

        <ReviewQueuePanel
          orgId={organization.id}
          canReview
          initialItems={reviewQueueItems}
          title="Approval Queue"
          description="Approve or reject workspace runs and workflow changes before they execute."
        />

        <Card className="rounded-[32px]">
          <CardHeader className="border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <Shield className="text-[var(--fg-primary)]" />
              <div>
                <CardTitle>Platform Protections</CardTitle>
                <CardDescription>Core safeguards already active in the app runtime.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <StatusRow label="Rate limiting" value="Active" />
            <StatusRow label="Security headers" value="Enabled" />
            <StatusRow label="Audit trail" value="Live in activity log" />
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader className="border-b border-[var(--border-subtle)]">
            <CardTitle>Recent Rate Limit Hits</CardTitle>
            <CardDescription>Top identifiers by request volume in the last 24 hours.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rateLimitHitsResult.data && rateLimitHitsResult.data.length > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {rateLimitHitsResult.data.map((row) => (
                  <div key={`${row.identifier}-${row.route}-${row.window_start}`} className="grid gap-2 px-6 py-4 md:grid-cols-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Identifier</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">{row.identifier}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Route</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">{row.route}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Request Count</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">{row.request_count}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Window Start</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">
                        {new Date(row.window_start).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-sm text-[var(--fg-muted)]">No recent rate limit hits in the last 24 hours.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
