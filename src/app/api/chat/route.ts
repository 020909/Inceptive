import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const getAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

/* ── helpers ── */
async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data } = await getAdmin().auth.getUser(token);
  return data.user?.id || null;
}

/* ── GET /api/chat  — fetch recent 5 sessions ── */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getAdmin()
    .from("chat_sessions")
    .select("id, title, created_at, messages")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sessions: data || [] });
}

/* ── POST /api/chat  — save a session ── */
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, messages } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages to save" }, { status: 400 });
  }

  const { data, error } = await getAdmin()
    .from("chat_sessions")
    .insert({ user_id: userId, title: title || "Chat", messages })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}

/* ── DELETE /api/chat?id=xxx  — delete a session ── */
export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { error } = await getAdmin()
    .from("chat_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/* ── PATCH /api/chat  — update memory_enabled in users table ── */
export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { memory_enabled } = await req.json();
  const { error } = await getAdmin()
    .from("users")
    .update({ memory_enabled })
    .eq("id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
