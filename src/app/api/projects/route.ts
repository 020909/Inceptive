import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
  return createClient(url, key);
};

// GET /api/projects — list user's projects
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdmin();
  const { data, error } = await admin
    .from("projects")
    .select("id, name, description, template, status, github_repo, github_branch, last_opened_at, created_at, updated_at")
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("last_opened_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projects = data || [];
  if (projects.length === 0) return NextResponse.json({ projects: [] });

  const projectIds = projects.map((project) => project.id);
  const { data: artifacts } = await admin
    .from("project_artifacts")
    .select("project_id, type, created_at")
    .in("project_id", projectIds)
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  const artifactMeta = new Map<string, { count: number; latestType: string | null }>();
  for (const project of projects) {
    artifactMeta.set(project.id, { count: 0, latestType: null });
  }
  for (const artifact of artifacts || []) {
    const current = artifactMeta.get(artifact.project_id) || { count: 0, latestType: null };
    artifactMeta.set(artifact.project_id, {
      count: current.count + 1,
      latestType: current.latestType || artifact.type || null,
    });
  }

  return NextResponse.json({
    projects: projects.map((project) => {
      const meta = artifactMeta.get(project.id);
      return {
        ...project,
        artifact_count: meta?.count || 0,
        latest_artifact_type: meta?.latestType || null,
      };
    }),
  });
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, description, template, github_repo, github_branch } = body;

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data, error } = await admin
    .from("projects")
    .insert({
      user_id: userId,
      name: name.trim(),
      description: description || "",
      template: template || "blank",
      github_repo: github_repo || null,
      github_branch: github_branch || "main",
      files: [],
      settings: {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data }, { status: 201 });
}

// PATCH /api/projects — update a project (expects { id, ...fields })
export async function PATCH(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

  const allowed = ["name", "description", "status", "files", "settings", "github_repo", "github_branch"];
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in updates) clean[key] = updates[key];
  }

  const admin = getAdmin();
  const { data, error } = await admin
    .from("projects")
    .update(clean)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

// DELETE /api/projects — soft-delete (expects { id } in body)
export async function DELETE(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

  const admin = getAdmin();
  const { error } = await admin
    .from("projects")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
