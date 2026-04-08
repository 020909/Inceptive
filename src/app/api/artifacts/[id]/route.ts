import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { getArtifactsAdminClient } from "@/lib/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of ["title", "summary", "status", "content_text", "content_json", "metadata"]) {
    if (key in body) clean[key] = body[key];
  }

  try {
    const { data, error } = await getArtifactsAdminClient()
      .from("project_artifacts")
      .update(clean)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ artifact: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update artifact" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const { error } = await getArtifactsAdminClient()
      .from("project_artifacts")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to archive artifact" }, { status: 500 });
  }
}
