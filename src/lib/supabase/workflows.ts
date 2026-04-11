import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type WorkflowCategory = "sales" | "marketing" | "research" | "operations" | "content";
export type OrgWorkflowStatus = "active" | "paused";

export interface WorkflowTemplateStep {
  title: string;
  description: string;
  agent_action: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: WorkflowCategory;
  icon: string;
  steps: WorkflowTemplateStep[];
  estimated_time_saved: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OrgWorkflow {
  id: string;
  organization_id: string;
  template_id: string;
  activated_by: string | null;
  settings: Record<string, unknown>;
  status: OrgWorkflowStatus;
  activated_at: string;
}

export interface OrgWorkflowWithTemplate extends OrgWorkflow {
  template: WorkflowTemplate;
  last_run_at: string | null;
}

type WorkflowSupabaseClient = SupabaseClient<any, "public", any>;

async function getSupabaseClient(client?: WorkflowSupabaseClient) {
  return client ?? createServerSupabaseClient();
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey);
}

export async function getWorkflowTemplates(client?: WorkflowSupabaseClient): Promise<WorkflowTemplate[]> {
  const supabase = await getSupabaseClient(client);
  const { data, error } = await supabase
    .from("workflow_templates")
    .select("id, name, slug, description, category, icon, steps, estimated_time_saved, is_active, created_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WorkflowTemplate[];
}

export async function getOrgWorkflows(
  orgId: string,
  client?: WorkflowSupabaseClient
): Promise<OrgWorkflowWithTemplate[]> {
  const supabase = await getSupabaseClient(client);
  const { data, error } = await supabase
    .from("org_workflows")
    .select(
      `
        id,
        organization_id,
        template_id,
        activated_by,
        settings,
        status,
        activated_at,
        template:workflow_templates (
          id,
          name,
          slug,
          description,
          category,
          icon,
          steps,
          estimated_time_saved,
          is_active,
          created_at
        )
      `
    )
    .eq("organization_id", orgId)
    .order("activated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const workflows = (data ?? []).map((item: any) => ({
    id: item.id,
    organization_id: item.organization_id,
    template_id: item.template_id,
    activated_by: item.activated_by,
    settings: item.settings ?? {},
    status: item.status,
    activated_at: item.activated_at,
    template: Array.isArray(item.template) ? item.template[0] : item.template,
    last_run_at: null,
  })) as OrgWorkflowWithTemplate[];

  const workflowActivityMap = await getWorkflowLastRunMap(orgId, workflows.map((workflow) => workflow.template.slug), client);

  return workflows.map((workflow) => ({
    ...workflow,
    last_run_at: workflowActivityMap.get(workflow.template.slug) ?? null,
  }));
}

async function getWorkflowLastRunMap(
  orgId: string,
  workflowSlugs: string[],
  client?: WorkflowSupabaseClient
) {
  if (workflowSlugs.length === 0) {
    return new Map<string, string>();
  }

  const supabase = getServiceRoleClient() ?? (await getSupabaseClient(client));
  const { data, error } = await supabase
    .from("agent_activity_log")
    .select("created_at, metadata")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    throw new Error(error.message);
  }

  const latestBySlug = new Map<string, string>();

  for (const row of data ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const workflowSlug = typeof metadata.workflow_slug === "string" ? metadata.workflow_slug : null;
    if (!workflowSlug || latestBySlug.has(workflowSlug) || !workflowSlugs.includes(workflowSlug)) {
      continue;
    }
    latestBySlug.set(workflowSlug, row.created_at as string);
  }

  return latestBySlug;
}

export async function activateWorkflow(
  params: {
    organizationId: string;
    templateId: string;
    activatedBy: string;
    settings?: Record<string, unknown>;
  },
  client?: WorkflowSupabaseClient
) {
  const supabase = await getSupabaseClient(client);
  const { data, error } = await supabase
    .from("org_workflows")
    .insert({
      organization_id: params.organizationId,
      template_id: params.templateId,
      activated_by: params.activatedBy,
      settings: params.settings ?? {},
      status: "active",
    })
    .select("id, organization_id, template_id, activated_by, settings, status, activated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrgWorkflow;
}

export async function updateWorkflowStatus(
  orgWorkflowId: string,
  status: OrgWorkflowStatus,
  client?: WorkflowSupabaseClient
) {
  const supabase = await getSupabaseClient(client);
  const { data, error } = await supabase
    .from("org_workflows")
    .update({ status })
    .eq("id", orgWorkflowId)
    .select("id, organization_id, template_id, activated_by, settings, status, activated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrgWorkflow;
}
