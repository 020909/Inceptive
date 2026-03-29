import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueJob } from "@/lib/agent/task-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const q = req.nextUrl.searchParams.get("secret");
  return header === secret || bearer === secret || q === secret;
}

function parseField(v: string, min: number, max: number): Set<number> | null {
  // supports: "*", "*/n", "n"
  if (v === "*") return null;
  if (v.startsWith("*/")) {
    const step = Number(v.slice(2));
    if (!Number.isFinite(step) || step <= 0) return null;
    const s = new Set<number>();
    for (let x = min; x <= max; x += step) s.add(x);
    return s;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return new Set([n]);
}

function nextRunAtFromCron(cron: string, from: Date): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;
  const mins = parseField(min, 0, 59);
  const hours = parseField(hour, 0, 23);
  const doms = parseField(dom, 1, 31);
  const mons = parseField(mon, 1, 12);
  const dows = parseField(dow, 0, 6); // 0=Sun

  // brute-force scan minute-by-minute up to 14 days
  const start = new Date(from.getTime() + 60_000);
  start.setUTCSeconds(0, 0);
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60_000);

  for (let t = start.getTime(); t <= end.getTime(); t += 60_000) {
    const d = new Date(t);
    const ok =
      (!mins || mins.has(d.getUTCMinutes())) &&
      (!hours || hours.has(d.getUTCHours())) &&
      (!doms || doms.has(d.getUTCDate())) &&
      (!mons || mons.has(d.getUTCMonth() + 1)) &&
      (!dows || dows.has(d.getUTCDay()));
    if (ok) return d;
  }

  return null;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const a = admin();
  const now = new Date();

  const { data: tasks, error } = await a
    .from("scheduled_tasks")
    .select("id, user_id, name, prompt, schedule_cron, timezone, enabled, next_run_at")
    .eq("enabled", true)
    .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`)
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enqueued = 0;
  for (const t of tasks || []) {
    try {
      const next = nextRunAtFromCron(t.schedule_cron, now);
      await enqueueJob({
        userId: t.user_id,
        kind: "scheduled.prompt",
        payload: { scheduled_task_id: t.id, name: t.name, prompt: t.prompt },
        nextRunAt: new Date().toISOString(),
      });

      await a
        .from("scheduled_tasks")
        .update({
          last_run_at: now.toISOString(),
          next_run_at: next ? next.toISOString() : null,
          last_status: "queued",
          last_error: null,
        })
        .eq("id", t.id);

      enqueued++;
    } catch (e: any) {
      await a
        .from("scheduled_tasks")
        .update({ last_status: "error", last_error: e?.message || "enqueue_failed" })
        .eq("id", t.id);
    }
  }

  return NextResponse.json({ ok: true, considered: (tasks || []).length, enqueued });
}

