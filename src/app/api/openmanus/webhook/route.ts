import { NextResponse } from "next/server";

/**
 * POST /api/openmanus/webhook
 * Receives AI·ML API (or proxy) webhooks for async task updates.
 * Set OPENMANUS_WEBHOOK_SECRET — callers must send matching X-OpenManus-Secret header.
 */
export async function POST(request: Request) {
  const secret = process.env.OPENMANUS_WEBHOOK_SECRET?.trim();
  if (secret) {
    const got = request.headers.get("x-openmanus-secret")?.trim();
    if (got !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Hook for future persistence (e.g. update agent_jobs by external id). Ack quickly.
  if (process.env.NODE_ENV === "development") {
    console.info("[openmanus/webhook]", JSON.stringify(payload).slice(0, 500));
  }

  return NextResponse.json({ ok: true, received: true });
}
