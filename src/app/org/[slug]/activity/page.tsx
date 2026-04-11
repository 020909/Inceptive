import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";
import { getOrgActivity } from "@/lib/supabase/activity";
import { OrgActivityDashboard } from "@/components/org/org-activity-dashboard";

interface OrgActivityPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ workflow?: string }>;
}

export default async function OrgActivityPage({ params, searchParams }: OrgActivityPageProps) {
  const { slug } = await params;
  const { workflow } = await searchParams;
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

  const logs = await getOrgActivity(
    organization.id,
    workflow ? { workflowSlug: workflow } : {},
    supabase
  );

  return (
    <section className="mx-auto flex min-h-full w-full max-w-7xl px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Activity Log</p>
            <h1
              className="text-4xl text-[var(--fg-primary)]"
              style={{ fontFamily: "var(--font-header)" }}
            >
              AI activity across {organization.name}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--fg-secondary)]">
              A complete audit trail of what Inceptive has done for this workspace, across every teammate and automation.
            </p>
            {workflow ? (
              <p className="text-sm text-[var(--fg-muted)]">
                Filtered to workflow: <span className="text-[var(--fg-primary)]">{workflow}</span>
              </p>
            ) : null}
          </div>
        </div>

        <OrgActivityDashboard logs={logs} />
      </div>
    </section>
  );
}
