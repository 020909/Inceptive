import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getOrgMembershipForUser } from "@/lib/supabase/org";
import {
  queryGetOrganizationGovernanceSettings,
  queryUpsertOrganizationGovernanceSettings,
} from "@/lib/supabase/org-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = new URL(request.url).searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const membership = await getOrgMembershipForUser(orgId, userId, admin);

    if (!membership) {
      return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });
    }

    const settings = await queryGetOrganizationGovernanceSettings(admin, orgId);
    return NextResponse.json({
      settings,
      role: membership.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workspace settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      orgId?: string;
      manual_runs_require_approval?: boolean;
      workflow_changes_require_approval?: boolean;
      notify_admins_on_review_requests?: boolean;
      require_rejection_reason?: boolean;
    };

    if (!body.orgId) {
      return NextResponse.json({ error: "Missing orgId." }, { status: 400 });
    }

    const admin = createAdminClient();
    const membership = await getOrgMembershipForUser(body.orgId, userId, admin);

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Only workspace admins can update these settings." }, { status: 403 });
    }

    const settings = await queryUpsertOrganizationGovernanceSettings(admin, {
      organizationId: body.orgId,
      updatedBy: userId,
      settings: {
        manual_runs_require_approval: body.manual_runs_require_approval,
        workflow_changes_require_approval: body.workflow_changes_require_approval,
        notify_admins_on_review_requests: body.notify_admins_on_review_requests,
        require_rejection_reason: body.require_rejection_reason,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workspace settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
