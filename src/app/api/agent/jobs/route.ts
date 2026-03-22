import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { enqueueJob, listJobsForUser } from "@/lib/agent/task-queue";

const ALLOWED_KINDS = new Set([
  "browser.probe",
  "connector.health",
  "inbox.monitor",
  "inbox.monitor.stub",
  "slack.ping",
  "computer.use",
  "computer.use.stub",
]);

/** GET — list recent jobs for the authenticated user */
export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const jobs = await listJobsForUser(userId);
    return NextResponse.json({ jobs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list jobs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — enqueue a new job */
export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      kind?: string;
      payload?: Record<string, unknown>;
      schedule_cron?: string | null;
      next_run_at?: string | null;
    };
    if (!body.kind || !ALLOWED_KINDS.has(body.kind)) {
      return NextResponse.json({ error: "Invalid or missing kind" }, { status: 400 });
    }
    const job = await enqueueJob({
      userId,
      kind: body.kind,
      payload: body.payload,
      scheduleCron: body.schedule_cron ?? null,
      nextRunAt: body.next_run_at ?? new Date().toISOString(),
    });
    return NextResponse.json({ job });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to enqueue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
