import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/supabase/activity";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      itemId: string;
      itemType: string;
      targetId: string;
      reason: string;
    };

    const { itemId, itemType, targetId, reason } = body;

    if (!itemId || !itemType || !targetId) {
      return NextResponse.json(
        { error: "Missing required fields: itemId, itemType, targetId" },
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
      .select("*, org:org_id(id, name)")
      .eq("id", itemId)
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
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Update the target item based on type
    if (itemType === "ubo_extraction") {
      const { error: uboError } = await admin
        .from("ubo_extractions")
        .update({
          status: "rejected",
          rejected_by: userId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);

      if (uboError) {
        console.error("Failed to update UBO extraction status:", uboError);
      }
    }

    // Create audit log
    await logActivity(
      {
        organizationId: queueItem.org_id,
        userId: userId,
        actionType: "approval_rejected",
        title: `Rejected ${itemType} extraction`,
        description: reason,
        metadata: {
          queue_item_id: itemId,
          target_id: targetId,
          item_type: itemType,
          reviewer_id: userId,
          rejection_reason: reason,
        },
      },
      admin
    );

    // Notify the requester if not the same as reviewer
    if (queueItem.requested_by && queueItem.requested_by !== userId) {
      await createNotification({
        userId: queueItem.requested_by,
        orgId: queueItem.org_id,
        title: "Extraction Rejected",
        message: `Your ${itemType} extraction has been rejected. Reason: ${reason}`,
        type: "error",
        link: `/approval-queue`,
      });
    }

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
