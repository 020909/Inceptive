import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const q = req.nextUrl.searchParams.get("secret");
  return header === secret || bearer === secret || q === secret;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = admin();
    const [taskLogs, recentReports] = await Promise.all([
      db
        .from("task_logs")
        .select("id,action,status,created_at,updated_at,details")
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("weekly_reports")
        .select("id,user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const errorLogs = (taskLogs.data || []).filter((l: any) => l.status === "error");

    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      task_logs: {
        total_recent: (taskLogs.data || []).length,
        errors_recent: errorLogs.length,
        latest_errors: errorLogs.slice(0, 10),
      },
      reports: {
        latest_count: (recentReports.data || []).length,
        latest: recentReports.data || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "diag failed" }, { status: 500 });
  }
}

