import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";

interface WorkflowBuilderPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function WorkflowBuilderPage({
  params,
  searchParams,
}: WorkflowBuilderPageProps) {
  const { slug } = await params;
  const { id } = await searchParams;
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

  let workflow = null;
  if (id) {
    const { data } = await supabase
      .from("agent_workflows")
      .select("id, name, description, nodes, edges, status, last_run_at, created_at, updated_at")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .maybeSingle();
    workflow = data;
  }

  return (
    <section className="h-full p-0">
      <WorkflowBuilder
        orgId={organization.id}
        orgSlug={organization.slug}
        initialWorkflow={workflow}
      />
    </section>
  );
}
