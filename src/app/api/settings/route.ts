import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const EXCLUDED_FIELDS = ["password", "salt"]; // Security precaution

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("api_provider, api_key_encrypted")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask the API key for security (e.g., sk-...def)
  let maskedKey = "";
  if (data?.api_key_encrypted) {
    const key = data.api_key_encrypted;
    if (key.length > 8) {
      maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
    } else {
      maskedKey = "••••••••";
    }
  }

  return NextResponse.json({
    api_provider: data?.api_provider || "openai",
    api_key_masked: maskedKey,
    has_key: !!data?.api_key_encrypted
  });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { api_provider, api_key } = body;

  const updates: Record<string, string> = {};
  if (api_provider) updates.api_provider = api_provider;
  if (api_key) updates.api_key_encrypted = api_key;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // We use the authenticated user's ID to ensure they only update their own record
  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
