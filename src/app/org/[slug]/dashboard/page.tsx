import Link from "next/link";
import { redirect } from "next/navigation";
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

function planVariant(plan: string) {
  if (plan === "team") return "blue";
  if (plan === "business") return "green";
  return "gray";
}

function roleVariant(role: OrganizationMemberWithProfile["role"]) {
  return role === "admin" ? "default" : "outline";
}

function statusVariant(status: OrganizationMemberWithProfile["status"]) {
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

  const members = await getOrgMembers(organization.id, supabase);
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
              <Button
                size="lg"
                className="h-11 rounded-xl px-5"
                render={<Link href={`/org/${organization.slug}/workflows`} />}
              >
                Browse Workflows
              </Button>
              <InviteMemberDialog orgId={organization.id} orgSlug={organization.slug} disabled={!canInvite} />
              <Button
                variant="outline"
                size="lg"
                className="h-11 rounded-xl px-5"
                render={<Link href={`/org/${organization.slug}/invite`} />}
              >
                Open Invite Page
              </Button>
            </div>
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
