import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("notifications")
    .select("id,title,message,type,link,read,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    notifications: (data || []).map((notification: any) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message ?? null,
      type: notification.type ?? "info",
      link: notification.link ?? null,
      read: notification.read,
      created_at: notification.created_at,
    })),
  });
}

export async function PATCH(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; read?: boolean; all?: boolean };

  if (body.all) {
    const { error } = await createAdminClient()
      .from("notifications")
      .update({ read: body.read ?? true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("notifications")
    .update({ read: body.read ?? true })
    .eq("id", body.id)
    .eq("user_id", userId)
    .select("id,title,message,type,link,read,created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    notification: {
      id: data.id,
      title: data.title,
      message: (data as any).message ?? null,
      type: (data as any).type ?? "info",
      link: (data as any).link ?? null,
      read: data.read,
      created_at: data.created_at,
    },
  });
}
