import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { WorkflowSupabaseClient } from "./workflows-core";
import {
  queryActivateWorkflow,
  queryGetOrgWorkflows,
  queryGetWorkflowTemplates,
  queryUpdateWorkflowStatus,
} from "./workflows-core";

export type {
  OrgWorkflow,
  OrgWorkflowStatus,
  OrgWorkflowWithTemplate,
  WorkflowCategory,
  WorkflowTemplate,
  WorkflowTemplateStep,
} from "./workflows-core";

export async function getWorkflowTemplates(client?: WorkflowSupabaseClient) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryGetWorkflowTemplates(supabase);
}

export async function getOrgWorkflows(orgId: string, client?: WorkflowSupabaseClient) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryGetOrgWorkflows(supabase, orgId);
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
  const supabase = client ?? (await createServerSupabaseClient());
  return queryActivateWorkflow(supabase, params);
}

export async function updateWorkflowStatus(
  orgWorkflowId: string,
  status: import("./workflows-core").OrgWorkflowStatus,
  client?: WorkflowSupabaseClient
) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryUpdateWorkflowStatus(supabase, orgWorkflowId, status);
}
