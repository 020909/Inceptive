import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { getGenerationStatus, resultToJobRecord } from "@/lib/openmanus/client";

/**
 * GET /api/openmanus/task/:taskId
 * Poll async job status (maps to AI·ML GET /v2/video/generations?generation_id=).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ taskId: string }> }
) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await ctx.params;
  const id = decodeURIComponent(taskId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  }

  const result = await getGenerationStatus(id);
  const payload = resultToJobRecord(result);

  if (!result.ok) {
    const status = result.error.status && result.error.status < 600 ? result.error.status : 502;
    return NextResponse.json({ ok: false, ...payload }, { status: status >= 400 ? status : 502 });
  }

  return NextResponse.json({ ok: true, result: result.data });
}
