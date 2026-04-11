import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";
import { getOrgWorkflows } from "@/lib/supabase/workflows";
import { ActiveWorkflowsDashboard } from "@/components/org/active-workflows-dashboard";
import { Button } from "@/components/ui/button";

interface ActiveOrgWorkflowsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ActiveOrgWorkflowsPage({ params }: ActiveOrgWorkflowsPageProps) {
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

  const workflows = await getOrgWorkflows(organization.id, supabase);

  return (
    <section className="mx-auto flex min-h-full w-full max-w-7xl px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Active Workflows</p>
              <h1
                className="text-4xl text-[var(--fg-primary)]"
                style={{ fontFamily: "var(--font-header)" }}
              >
                Live automations across {organization.name}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--fg-secondary)]">
                Pause, resume, and inspect the workflows currently running for this workspace.
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="h-11 rounded-xl px-5"
              render={<Link href={`/org/${organization.slug}/workflows`} />}
            >
              Browse Templates
            </Button>
          </div>
        </div>

        <ActiveWorkflowsDashboard orgSlug={organization.slug} initialWorkflows={workflows} />
      </div>
    </section>
  );
}
