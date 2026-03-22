import { NextRequest, NextResponse } from "next/server";
import { runAgentOrchestratorTick } from "@/lib/agent/orchestrator";

export const runtime = "nodejs";

/**
 * Called on a schedule by `scripts/agent-worker.mjs`, Coolify cron, or Vercel Cron.
 * Protect with CRON_SECRET.
 */
function authorizeTick(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const q = req.nextUrl.searchParams.get("secret");
  return header === secret || bearer === secret || q === secret;
}

async function runTick() {
  const { processed } = await runAgentOrchestratorTick(5);
  return NextResponse.json({ ok: true, processed });
}

/** POST — worker / Compose (header x-cron-secret). */
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorizeTick(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runTick();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "tick failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET — Vercel Cron (Bearer or ?secret=). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorizeTick(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runTick();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "tick failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
