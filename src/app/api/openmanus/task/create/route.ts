import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createOpenManusTask, resultToJobRecord } from "@/lib/openmanus/client";

/**
 * POST /api/openmanus/task/create
 * Authenticated proxy to AI·ML API task execution (default: chat completions).
 */
export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { task?: string; model?: string };
  try {
    body = (await request.json()) as { task?: string; model?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  const result = await createOpenManusTask({ task, model: body.model });
  const payload = resultToJobRecord(result);

  if (!result.ok) {
    const status =
      result.error.code === "unauthorized"
        ? 401
        : result.error.code === "rate_limited"
          ? 429
          : result.error.code === "bad_request"
            ? 400
            : result.error.code === "missing_api_key"
              ? 503
              : result.error.status && result.error.status >= 400 && result.error.status < 600
                ? result.error.status
                : 502;

    return NextResponse.json({ ok: false, ...payload }, { status });
  }

  return NextResponse.json({ ok: true, result: payload });
}
