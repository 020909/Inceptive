import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { embedText64, toPgVectorLiteral } from "@/lib/memory/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || "12")));

  if (!q) {
    const { data, error } = await admin()
      .from("agent_memory")
      .select("id, content, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ memories: data || [] });
  }

  const vec = toPgVectorLiteral(embedText64(q));
  const { data, error } = await admin().rpc("match_agent_memory", {
    p_user_id: userId,
    p_query_embedding: vec,
    p_match_count: limit,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memories: data || [] });
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { content?: string; metadata?: Record<string, unknown> };
  const content = (body.content || "").trim();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  const vec = toPgVectorLiteral(embedText64(content));

  const { data, error } = await admin()
    .from("agent_memory")
    .insert({ user_id: userId, content, metadata: body.metadata || {}, embedding: vec as any })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memory: data });
}
