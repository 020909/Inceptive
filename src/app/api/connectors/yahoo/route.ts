import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveYahooConnector } from "@/lib/email/yahoo-imap";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** POST — save Yahoo Mail app password (IMAP/SMTP). Body: { email, app_password } */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();
  const { data: { user }, error: authErr } = await admin().auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { email?: string; app_password?: string };
  if (!body.email?.trim() || !body.app_password?.trim()) {
    return NextResponse.json({ error: "email and app_password required" }, { status: 400 });
  }

  try {
    await saveYahooConnector(user.id, body.email, body.app_password);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
