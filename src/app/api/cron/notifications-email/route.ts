import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ ok: true, emailed: 0, reason: "RESEND_API_KEY missing" });
  const resend = new Resend(resendKey);

  const a = admin();
  const { data: rows } = await a
    .from("notifications")
    .select("id,user_id,title,body,emailed")
    .eq("emailed", false)
    .eq("read", false)
    .order("created_at", { ascending: true })
    .limit(30);

  let emailed = 0;
  for (const n of rows || []) {
    const { data: u } = await a.from("users").select("email").eq("id", n.user_id).single();
    if (!u?.email) continue;
    try {
      await resend.emails.send({
        from: "Inceptive AI <reports@inceptive-ai.com>",
        to: u.email,
        subject: n.title,
        html: `<p>${n.body.replace(/</g, "&lt;")}</p>`,
      });
      await a.from("notifications").update({ emailed: true, channel: "email" }).eq("id", n.id);
      emailed++;
    } catch {
      // skip
    }
  }

  return NextResponse.json({ ok: true, emailed });
}

