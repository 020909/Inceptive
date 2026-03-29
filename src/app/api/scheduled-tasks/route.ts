import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  prompt: z.string().min(1).max(5000),
  schedule_cron: z.string().min(5).max(64),
  timezone: z.string().min(1).max(64).optional(),
  enabled: z.boolean().optional(),
});

function parseField(v: string, min: number, max: number): Set<number> | null {
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
  const dows = parseField(dow, 0, 6);
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

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await admin()
    .from("scheduled_tasks")
    .select("id, name, prompt, schedule_cron, timezone, enabled, last_run_at, next_run_at, last_status, last_error, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = CreateSchema.parse(await req.json());
    const now = new Date();
    const next = nextRunAtFromCron(body.schedule_cron, now);

    const { data, error } = await admin()
      .from("scheduled_tasks")
      .insert({
        user_id: userId,
        name: body.name,
        prompt: body.prompt,
        schedule_cron: body.schedule_cron,
        timezone: body.timezone || "UTC",
        enabled: body.enabled ?? true,
        next_run_at: next ? next.toISOString() : null,
        last_status: "created",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid request" }, { status: 400 });
  }
}

