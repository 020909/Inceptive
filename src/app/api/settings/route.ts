import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query the users table
  let { data, error } = await supabase
    .from("users")
    .select("api_provider, api_key_encrypted")
    .eq("id", user.id)
    .single();

  // If no row exists, insert one first as requested
  if (error && error.code === 'PGRST116') {
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({ id: user.id, email: user.email })
      .select("api_provider, api_key_encrypted")
      .single();
    
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    data = newUser;
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask the API key showing only last 4 characters as requested
  let maskedKey = "";
  if (data?.api_key_encrypted) {
    const key = data.api_key_encrypted;
    if (key.length > 4) {
      maskedKey = `••••${key.slice(-4)}`;
    } else {
      maskedKey = "••••";
    }
  }

  return NextResponse.json({
    api_provider: data?.api_provider || "gemini",
    api_key_masked: maskedKey,
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
  const { api_provider, api_key: api_key_encrypted } = body;

  // Upsert into users table as requested
  const { error } = await supabase
    .from("users")
    .upsert({ 
      id: user.id, 
      api_provider, 
      api_key_encrypted 
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
