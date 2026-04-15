import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/supabase/activity";
import { getOrgMembershipForUser } from "@/lib/supabase/org";
import {
  createReviewRequestWithNotifications,
  queryGetOrganizationGovernanceSettings,
} from "@/lib/supabase/org-governance";
import { queryActivateWorkflow } from "@/lib/supabase/workflows-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      orgId?: string;
      templateId?: string;
    };

    if (!body.orgId || !body.templateId) {
      return NextResponse.json({ error: "Missing orgId or templateId." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const membership = await getOrgMembershipForUser(body.orgId, userId, admin);

    if (!membership) {
      return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });
    }

    const [{ data: template, error: templateError }, settings] = await Promise.all([
      admin
        .from("workflow_templates")
        .select("id, name")
        .eq("id", body.templateId)
        .maybeSingle(),
      queryGetOrganizationGovernanceSettings(admin, body.orgId),
    ]);

    if (templateError) {
      throw new Error(templateError.message);
    }

    if (!template?.id) {
      return NextResponse.json({ error: "Workflow template not found." }, { status: 404 });
    }

    if (settings.workflow_changes_require_approval) {
      const reviewItem = await createReviewRequestWithNotifications(admin, {
        organizationId: body.orgId,
        requestedBy: userId,
        requestType: "workflow_activate",
        title: `Activation requested for ${template.name}`,
        description: "A workspace member requested workflow activation.",
        payload: {
          templateId: template.id,
          templateName: template.name,
          activatedBy: userId,
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

    const activated = await queryActivateWorkflow(admin, {
      organizationId: body.orgId,
      templateId: template.id as string,
      activatedBy: userId,
      settings: {},
    });

    await logActivity(
      {
        organizationId: body.orgId,
        userId,
        actionType: "workflow_updated",
        title: `${template.name} activated`,
        description: "Workflow activated directly by a workspace member.",
        metadata: {
          workflow_id: activated.id,
          template_id: template.id,
          next_status: activated.status,
        },
      },
      admin
    );

    return NextResponse.json({ workflow: activated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate workflow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
