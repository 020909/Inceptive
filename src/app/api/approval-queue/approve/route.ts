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
      notes?: string;
    };

    const { itemId, notes } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "Missing required field: itemId" },
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
        status: "approved",
        reviewed_by: userId,
        review_notes: notes || null,
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
      action_type: "approval_queue_approved",
      entity_type: "approval_queue",
      entity_id: itemId,
      before_state: { status: "pending" },
      after_state: { status: "approved", review_notes: notes || null },
      decision: "approved",
      ip_address: getIpAddressFromRequest(request),
      citations: queueItem.citations ?? null,
    });

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve item";
    console.error("Error approving item:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
