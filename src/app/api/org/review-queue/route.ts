import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getOrgMembershipForUser } from "@/lib/supabase/org";
import { queryGetReviewQueue, type ReviewQueueStatus } from "@/lib/supabase/org-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId." }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const membership = await getOrgMembershipForUser(orgId, userId, admin);

    if (!membership) {
      return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });
    }

    const statuses = url.searchParams
      .get("statuses")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) as ReviewQueueStatus[] | undefined;

    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "25"), 1), 100);

    const items = await queryGetReviewQueue(admin, {
      organizationId: orgId,
      statuses,
      limit,
    });

    return NextResponse.json({
      items,
      role: membership.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load review queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
