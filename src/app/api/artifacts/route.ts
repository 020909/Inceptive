import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import {
  deriveArtifactTitle,
  getArtifactsAdminClient,
  listArtifactsForProject,
  type ArtifactType,
} from "@/lib/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: ArtifactType[] = [
  "website",
  "image",
  "powerpoint",
  "excel",
  "pdf",
  "report",
  "file",
  "other",
];

function isValidType(value: unknown): value is ArtifactType {
  return typeof value === "string" && VALID_TYPES.includes(value as ArtifactType);
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id")?.trim();
  const limitParam = Number(searchParams.get("limit") || 24);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 24;

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  try {
    const artifacts = await listArtifactsForProject(userId, projectId, limit);
    return NextResponse.json({ artifacts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load artifacts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
  const type = body.type;

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  if (!isValidType(type)) {
    return NextResponse.json({ error: "Invalid artifact type" }, { status: 400 });
  }

  const admin = getArtifactsAdminClient();
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const payload = {
      user_id: userId,
      project_id: projectId,
      type,
      title: deriveArtifactTitle({
        type,
        title: typeof body.title === "string" ? body.title : null,
        fileName: typeof body.file_name === "string" ? body.file_name : null,
        prompt: typeof body.prompt === "string" ? body.prompt : null,
      }),
      source: typeof body.source === "string" ? body.source.slice(0, 80) : "manual",
      status: body.status === "draft" || body.status === "archived" ? body.status : "ready",
      summary: typeof body.summary === "string" ? body.summary.slice(0, 500) : "",
      content_text: typeof body.content_text === "string" ? body.content_text.slice(0, 100000) : null,
      content_json: body.content_json && typeof body.content_json === "object" ? body.content_json : {},
      file_name: typeof body.file_name === "string" ? body.file_name.slice(0, 200) : null,
      mime_type: typeof body.mime_type === "string" ? body.mime_type.slice(0, 200) : null,
      preview_url: typeof body.preview_url === "string" ? body.preview_url.slice(0, 2000) : null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    };

    const { data, error } = await admin
      .from("project_artifacts")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    await admin
      .from("projects")
      .update({ last_opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("user_id", userId);

    return NextResponse.json({ artifact: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create artifact" }, { status: 500 });
  }
}
