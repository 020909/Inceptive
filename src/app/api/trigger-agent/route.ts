import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { trackEvent } from "@/lib/analytics";
import { inngest } from "@/lib/inngest/client";
import { checkRateLimit, getClientIP, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

const requestSchemaMessage = "Missing orgId.";

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const limit = await checkRateLimit({
    identifier: ip,
    route: "/api/trigger-agent",
    maxRequests: 5,
    windowMinutes: 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);

  const authenticatedUserId = await getAuthenticatedUserIdFromRequest(request);
  if (!authenticatedUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId } = body ?? {};

    if (!orgId) {
      return NextResponse.json({ error: requestSchemaMessage }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: membership, error } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", authenticatedUserId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!membership) {
      return NextResponse.json({ error: "You do not have access to this organization." }, { status: 403 });
    }

    const [{ data: organization, error: organizationError }, authUserResult] = await Promise.all([
      admin.from("organizations").select("slug").eq("id", orgId).single(),
      admin.auth.admin.getUserById(authenticatedUserId),
    ]);

    if (organizationError) {
      throw new Error(organizationError.message);
    }

    if (authUserResult.error || !authUserResult.data.user?.email) {
      throw new Error(authUserResult.error?.message || "Unable to resolve the authenticated user.");
    }

    const authUser = authUserResult.data.user;
    const userEmail = authUser.email!;
    const userName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.display_name ||
      authUser.user_metadata?.name ||
      userEmail.split("@")[0] ||
      "User";

    const { data: workflows, error: workflowError } = await admin
      .from("org_workflows")
      .select(
        `
          template:workflow_templates (
            slug
          )
        `
      )
      .eq("organization_id", orgId)
      .eq("status", "active");

    if (workflowError) {
      throw new Error(workflowError.message);
    }

    const workflowSlugs = (workflows ?? [])
      .map((row: any) => (Array.isArray(row.template) ? row.template[0] : row.template)?.slug)
      .filter((value: unknown): value is string => typeof value === "string");

    await inngest.send({
      name: "agent/overnight.triggered",
      data: {
        orgId,
        orgSlug: organization.slug,
        userId: authenticatedUserId,
        userEmail,
        userName,
        workflows: workflowSlugs,
      },
    });

    void trackEvent(orgId, authenticatedUserId, "agent_run_triggered", {
      org_id: orgId,
      trigger_type: "manual",
    });

    return NextResponse.json({ success: true, message: "Agent run triggered" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger agent run.";
    console.error("[trigger-agent]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
