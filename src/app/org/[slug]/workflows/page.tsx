import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";
import { getOrgWorkflows, getWorkflowTemplates } from "@/lib/supabase/workflows";
import { WorkflowTemplatesGallery } from "@/components/org/workflow-templates-gallery";
import { MyWorkflowsGrid } from "@/components/org/my-workflows-grid";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList } from "@/components/ui/tabs";

interface OrgWorkflowsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function OrgWorkflowsPage({ params, searchParams }: OrgWorkflowsPageProps) {
  const { slug } = await params;
  const { tab = "templates" } = await searchParams;
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

  const [templates, activeWorkflows] = await Promise.all([
    getWorkflowTemplates(supabase),
    getOrgWorkflows(organization.id, supabase),
  ]);

  const { data: myWorkflows = [] } = await supabase
    .from("agent_workflows")
    .select("id, name, status, last_run_at, nodes")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false });

  return (
    <section className="mx-auto flex min-h-full w-full max-w-7xl px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Workflows</p>
              <h1
                className="text-4xl text-[var(--fg-primary)]"
                style={{ fontFamily: "var(--font-header)" }}
              >
                Enterprise workflow templates for {organization.name}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--fg-secondary)]">
                Activate proven autonomous workflows with one click and let your AI team handle the recurring work.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
            <Button asChild variant="ghost" size="lg" className="h-11 rounded-xl px-5">
              <Link href={`/org/${organization.slug}/workflows/active`}>View Active Workflows</Link>
            </Button>
            <Button asChild size="lg" className="h-11 rounded-xl px-5">
              <Link href={`/org/${organization.slug}/workflows/builder`}>New Workflow</Link>
            </Button>
            </div>
          </div>
        </div>

        <Tabs value={tab}>
          <TabsList>
            <Link
              href={`/org/${organization.slug}/workflows?tab=templates`}
              className={[
                "rounded-xl px-3 py-2 text-sm transition-colors",
                tab === "templates"
                  ? "bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-[0_0_0_1px_rgba(232,230,220,0.68)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
              ].join(" ")}
            >
              Templates
            </Link>
            <Link
              href={`/org/${organization.slug}/workflows?tab=my-workflows`}
              className={[
                "rounded-xl px-3 py-2 text-sm transition-colors",
                tab === "my-workflows"
                  ? "bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-[0_0_0_1px_rgba(232,230,220,0.68)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
              ].join(" ")}
            >
              My Workflows
            </Link>
          </TabsList>
        </Tabs>

        {tab === "my-workflows" ? (
          <MyWorkflowsGrid
            orgSlug={organization.slug}
            initialWorkflows={
              myWorkflows as Array<{
                id: string;
                name: string;
                status: "draft" | "active" | "paused";
                last_run_at: string | null;
                nodes: unknown[] | null;
              }>
            }
          />
        ) : (
          <WorkflowTemplatesGallery
            orgId={organization.id}
            orgSlug={organization.slug}
            templates={templates}
            initialActiveWorkflows={activeWorkflows}
          />
        )}
      </div>
    </section>
  );
}
