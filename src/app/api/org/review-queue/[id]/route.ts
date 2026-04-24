import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getOrgMembershipForUser } from "@/lib/supabase/org";
import { queryResolveReviewRequest, type ReviewQueueStatus } from "@/lib/supabase/org-governance";

interface ReviewQueueRouteProps {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: ReviewQueueRouteProps) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      status?: ReviewQueueStatus;
      reviewNotes?: string;
    };

    if (!body.status || body.status === "pending") {
      return NextResponse.json({ error: "A final review status is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: reviewItem, error } = await admin
      .from("agent_review_queue")
      .select("organization_id")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!reviewItem?.organization_id) {
      return NextResponse.json({ error: "Review request not found." }, { status: 404 });
    }

    const membership = await getOrgMembershipForUser(reviewItem.organization_id as string, userId, admin);
    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Only workspace admins can resolve review requests." }, { status: 403 });
    }

    const item = await queryResolveReviewRequest(admin, {
      reviewRequestId: id,
      reviewerId: userId,
      status: body.status,
      reviewNotes: body.reviewNotes,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve review request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
