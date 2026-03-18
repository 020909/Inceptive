import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const getAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

/** GET /api/connectors — returns list of connected accounts (no tokens) */
export async function GET(request: Request) {
  const admin = getAdmin();
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: fetchError } = await admin
    .from("connected_accounts")
    .select("provider, account_email, account_name, account_id, created_at, metadata")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ accounts: data || [] });
}

/** DELETE /api/connectors?provider=gmail — disconnect a provider */
export async function DELETE(request: Request) {
  const admin = getAdmin();
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = new URL(request.url).searchParams.get("provider");
  if (!provider) return NextResponse.json({ error: "Missing provider" }, { status: 400 });

  const { error: deleteError } = await admin
    .from("connected_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
