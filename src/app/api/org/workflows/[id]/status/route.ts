import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/supabase/activity";
import { getOrgMembershipForUser } from "@/lib/supabase/org";
import {
  createReviewRequestWithNotifications,
  queryGetOrganizationGovernanceSettings,
} from "@/lib/supabase/org-governance";
import { queryUpdateWorkflowStatus, type OrgWorkflowStatus } from "@/lib/supabase/workflows-core";

interface WorkflowStatusRouteProps {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: WorkflowStatusRouteProps) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      status?: OrgWorkflowStatus;
    };

    if (!body.status || !["active", "paused"].includes(body.status)) {
      return NextResponse.json({ error: "A valid workflow status is required." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: workflow, error } = await admin
      .from("org_workflows")
      .select(
        `
          id,
          organization_id,
          status,
          template:workflow_templates (
            name
          )
        `
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!workflow?.id || !workflow.organization_id) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }

    const membership = await getOrgMembershipForUser(workflow.organization_id as string, userId, admin);
    if (!membership) {
      return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });
    }

    const workflowName = ((Array.isArray(workflow.template) ? workflow.template[0] : workflow.template) as { name?: string } | null)?.name ?? "Workflow";
    const settings = await queryGetOrganizationGovernanceSettings(admin, workflow.organization_id as string);

    if (settings.workflow_changes_require_approval) {
      const reviewItem = await createReviewRequestWithNotifications(admin, {
        organizationId: workflow.organization_id as string,
        requestedBy: userId,
        requestType: "workflow_status_change",
        title: `${body.status === "paused" ? "Pause" : "Resume"} requested for ${workflowName}`,
        description: `A workspace member requested a workflow status change to ${body.status}.`,
        payload: {
          orgWorkflowId: id,
          workflowName,
          nextStatus: body.status,
        },
      });

      return NextResponse.json(
        {
          queued: true,
          reviewItem,
        },
        { status: 202 }
      );
    }

    const updated = await queryUpdateWorkflowStatus(admin, id, body.status);

    await logActivity(
      {
        organizationId: workflow.organization_id as string,
        userId,
        actionType: "workflow_updated",
        title: `${workflowName} ${body.status === "paused" ? "paused" : "resumed"}`,
        description: "Workflow status changed directly by a workspace member.",
        metadata: {
          workflow_id: id,
          next_status: body.status,
        },
      },
      admin
    );

    return NextResponse.json({ workflow: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workflow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
