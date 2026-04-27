import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  getOrgBySlug,
  getOrgMembers,
  getOrgMembershipForUser,
  type OrganizationMemberWithProfile,
} from "@/lib/supabase/org";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteMemberDialog } from "@/components/org/invite-member-dialog";
import { RunAgentButton } from "@/components/org/run-agent-button";
import { Button } from "@/components/ui/button";

interface OrgDashboardPageProps {
  params: Promise<{ slug: string }>;
}

function planVariant(plan: string): "default" | "info" | "positive" | "warning" {
  if (plan === "team") return "info";
  if (plan === "business") return "positive";
  return "default";
}

function roleVariant(role: OrganizationMemberWithProfile["role"]): "default" | "outline" {
  return role === "admin" ? "default" : "outline";
}

function statusVariant(status: OrganizationMemberWithProfile["status"]): "default" | "outline" {
  return status === "active" ? "default" : "outline";
}

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps) {
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
  if (!membership) {
    redirect("/dashboard?error=org-access-denied");
  }

  const admin = createAdminClient();
  const [members, activeWorkflowsResult, pendingReviewsResult, recentActivityResult] = await Promise.all([
    getOrgMembers(organization.id, supabase),
    admin
      .from("org_workflows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "active"),
    admin
      .from("agent_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "pending"),
    admin
      .from("agent_activity_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
  ]);
  const canInvite = membership.role === "admin";

  return (
    <section className="mx-auto flex min-h-full w-full max-w-6xl px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Workspace</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1
                  className="text-4xl text-[var(--fg-primary)]"
                  style={{ fontFamily: "var(--font-header)" }}
                >
                  {organization.name}
                </h1>
                <Badge variant={planVariant(organization.plan)}>
                  {organization.plan === "starter" ? "Starter" : organization.plan === "team" ? "Team" : "Business"}
                </Badge>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[var(--fg-secondary)]">
                Manage workspace members, roles, and pending invitations for this organization.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <RunAgentButton
                orgId={organization.id}
                orgSlug={organization.slug}
                userId={user.id}
                userEmail={user.email ?? ""}
                userName={user.email?.split("@")[0] || "Admin"}
              />
            <Button asChild size="lg" className="h-11 rounded-xl px-5">
              <Link href={`/org/${organization.slug}/workflows`}>Browse Workflows</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-11 rounded-xl px-5">
              <Link href={`/org/${organization.slug}/settings`}>Open Governance</Link>
            </Button>
            <InviteMemberDialog orgId={organization.id} orgSlug={organization.slug} disabled={!canInvite} />
            <Button asChild variant="ghost" size="lg" className="h-11 rounded-xl px-5">
              <Link href={`/org/${organization.slug}/invite`}>Open Invite Page</Link>
            </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="command-surface rounded-[28px] border border-[var(--border-default)] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Active workflows</p>
            <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">{activeWorkflowsResult.count ?? 0}</p>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">Shared automations currently running in this workspace.</p>
          </div>
          <div className="command-surface rounded-[28px] border border-[var(--border-default)] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Pending approvals</p>
            <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">{pendingReviewsResult.count ?? 0}</p>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">Actions waiting in the review queue before execution.</p>
          </div>
          <div className="command-surface rounded-[28px] border border-[var(--border-default)] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Logged actions</p>
            <p className="mt-2 text-3xl font-medium text-[var(--fg-primary)]">{recentActivityResult.count ?? 0}</p>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">Workspace actions captured in the audit trail so far.</p>
          </div>
        </div>

        <div className="command-surface overflow-hidden rounded-[32px] border border-[var(--border-default)]">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
            <div>
              <h2 className="text-lg font-medium text-[var(--fg-primary)]">Members</h2>
              <p className="text-sm text-[var(--fg-muted)]">
                {members.length} workspace member{members.length === 1 ? "" : "s"}
              </p>
            </div>
            {!canInvite ? (
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">Member view</p>
            ) : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium text-[var(--fg-primary)]">{member.name}</TableCell>
                  <TableCell>{member.email ?? member.invited_email ?? "Pending account"}</TableCell>
                  <TableCell>
                    <Badge variant={roleVariant(member.role)}>
                      {member.role === "admin" ? "Admin" : "Member"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(member.status)}>
                      {member.status === "active" ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joined_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
