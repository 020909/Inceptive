import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getAdmin = () => createAdminClient();

// GET /api/style-memory — fetch user's style preferences
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdmin();
  const { data, error } = await admin
    .from("style_preferences")
    .select("preference_key, preference_value, context")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const prefs: Record<string, string> = {};
  for (const row of data || []) {
    prefs[`${row.context}:${row.preference_key}`] = row.preference_value;
  }

  return NextResponse.json({ preferences: prefs });
}

// POST /api/style-memory — upsert a style preference
export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { key, value, context } = body;

  if (!key || !value) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const admin = getAdmin();
  const { error } = await admin
    .from("style_preferences")
    .upsert(
      {
        user_id: userId,
        preference_key: key,
        preference_value: value,
        context: context || "global",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,preference_key,context" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
