/**
 * Browser-safe workflow mutations — pass `createClient()` from `@/lib/supabase`.
 */
import type { WorkflowSupabaseClient } from "./workflows-core";
import { queryActivateWorkflow, queryUpdateWorkflowStatus } from "./workflows-core";

export type {
  OrgWorkflow,
  OrgWorkflowStatus,
  OrgWorkflowWithTemplate,
  WorkflowCategory,
  WorkflowTemplate,
} from "./workflows-core";

export async function activateWorkflow(
  params: {
    organizationId: string;
    templateId: string;
    activatedBy: string;
    settings?: Record<string, unknown>;
  },
  client: WorkflowSupabaseClient
) {
  return queryActivateWorkflow(client, params);
}

export async function updateWorkflowStatus(
  orgWorkflowId: string,
  status: import("./workflows-core").OrgWorkflowStatus,
  client: WorkflowSupabaseClient
) {
  return queryUpdateWorkflowStatus(client, orgWorkflowId, status);
}
