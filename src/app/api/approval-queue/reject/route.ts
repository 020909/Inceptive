import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getIpAddressFromRequest, getTenantIdFromRequest } from "@/lib/ubo/requestContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
  }

  try {
    const body = await request.json() as {
      itemId: string;
      reason: string;
    };

    const { itemId, reason } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "Missing required field: itemId" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Fetch the approval queue item
    const { data: queueItem, error: fetchError } = await admin
      .from("approval_queue")
      .select("*")
      .eq("id", itemId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!queueItem) {
      return NextResponse.json(
        { error: "Approval queue item not found" },
        { status: 404 }
      );
    }

    if (queueItem.status !== "pending") {
      return NextResponse.json(
        { error: "Item has already been processed" },
        { status: 400 }
      );
    }

    // Update the approval queue item
    const { data: updatedItem, error: updateError } = await admin
      .from("approval_queue")
      .update({
        status: "rejected",
        reviewed_by: userId,
        review_notes: reason,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    await admin.from("audit_log").insert({
      tenant_id: tenantId,
      actor_id: userId,
      actor_email: "user@inceptive-ai.com",
      action_type: "approval_queue_rejected",
      entity_type: "approval_queue",
      entity_id: itemId,
      before_state: { status: "pending" },
      after_state: { status: "rejected", review_notes: reason },
      decision: "rejected",
      ip_address: getIpAddressFromRequest(request),
      citations: queueItem.citations ?? null,
    });

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject item";
    console.error("Error rejecting item:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
