import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const GOAL_PHRASE =
  /\b(finish|complete|ship|launch|build|grow|raise|hire|close|deliver|deploy)\b.{0,80}?[.!?\n]|goal:?\s*(.+)/gi;

function extractTitles(text: string): string[] {
  const titles = new Set<string>();
  const t = text.slice(0, 80_000);
  let m: RegExpExecArray | null;
  const re = GOAL_PHRASE;
  re.lastIndex = 0;
  while ((m = re.exec(t)) !== null) {
    const chunk = (m[0] || "").replace(/\s+/g, " ").trim();
    if (chunk.length > 12 && chunk.length < 200) titles.add(chunk);
  }
  const lines = t.split("\n");
  for (const line of lines) {
    const l = line.trim();
    if (/^[-*]\s+/.test(l) && l.length > 8 && l.length < 180) {
      titles.add(l.replace(/^[-*]\s+/, ""));
    }
  }
  return [...titles].slice(0, 12);
}

/** POST — scan recent chat + email subjects and upsert heuristic goals */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parts: string[] = [];

    const { data: sessions } = await admin()
      .from("chat_sessions")
      .select("messages, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    for (const s of sessions || []) {
      if (s.title) parts.push(String(s.title));
      const msgs = s.messages as { role?: string; content?: string }[] | null;
      if (Array.isArray(msgs)) {
        for (const m of msgs.slice(-20)) {
          if (m?.content) parts.push(String(m.content));
        }
      }
    }

    const { data: emails } = await admin()
      .from("emails")
      .select("subject, body")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);

    for (const e of emails || []) {
      if (e.subject) parts.push(String(e.subject));
      if (e.body) parts.push(String(e.body).slice(0, 500));
    }

    const corpus = parts.join("\n");
    const titles = extractTitles(corpus);
    let created = 0;

    for (const title of titles) {
      const short = title.slice(0, 200);
      const { data: existing } = await admin()
        .from("goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", short)
        .maybeSingle();
      if (existing) continue;

      const { error } = await admin().from("goals").insert({
        user_id: user.id,
        title: short,
        description: "Auto-detected from your inbox & chat",
        status: "active",
        progress_percent: 15,
        source: "auto_detect",
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      if (!error) created++;
    }

    return NextResponse.json({ ok: true, scanned: titles.length, created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "detect failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
