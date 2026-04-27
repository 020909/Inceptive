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
      notes?: string;
    };

    const { itemId, itemType, targetId, notes } = body;

    if (!itemId || !itemType || !targetId) {
      return NextResponse.json(
        { error: "Missing required fields: itemId, itemType, targetId" },
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
        status: "approved",
        reviewed_by: userId,
        review_notes: notes || null,
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
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
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
        actionType: "approval_approved",
        title: `Approved ${itemType} extraction`,
        description: notes || `Approved ${itemType} extraction`,
        metadata: {
          queue_item_id: itemId,
          target_id: targetId,
          item_type: itemType,
          reviewer_id: userId,
        },
      },
      admin
    );

    // Notify the requester if not the same as approver
    if (queueItem.requested_by && queueItem.requested_by !== userId) {
      await createNotification({
        userId: queueItem.requested_by,
        orgId: queueItem.org_id,
        title: "Extraction Approved",
        message: `Your ${itemType} extraction has been approved.`,
        type: "success",
        link: `/approval-queue`,
      });
    }

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
