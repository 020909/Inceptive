import { createClient } from "@supabase/supabase-js";

export type ArtifactType =
  | "website"
  | "image"
  | "powerpoint"
  | "excel"
  | "pdf"
  | "report"
  | "file"
  | "other";

export interface ProjectArtifact {
  id: string;
  user_id: string;
  project_id: string;
  type: ArtifactType;
  title: string;
  source: string;
  status: "draft" | "ready" | "archived";
  summary: string;
  content_text: string | null;
  content_json: Record<string, unknown> | null;
  file_name: string | null;
  mime_type: string | null;
  preview_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export function getArtifactsAdminClient() {
  return admin();
}

export function deriveArtifactTitle(input: {
  type: ArtifactType;
  title?: string | null;
  fileName?: string | null;
  prompt?: string | null;
}) {
  const explicit = input.title?.trim();
  if (explicit) return explicit.slice(0, 120);
  const fileName = input.fileName?.trim();
  if (fileName) return fileName.slice(0, 120);
  const prompt = input.prompt?.trim();
  if (prompt) return prompt.slice(0, 120);

  const labels: Record<ArtifactType, string> = {
    website: "Website Build",
    image: "Generated Image",
    powerpoint: "Presentation",
    excel: "Spreadsheet",
    pdf: "PDF Document",
    report: "Report",
    file: "File",
    other: "Artifact",
  };
  return labels[input.type];
}

export async function listArtifactsForProject(userId: string, projectId: string, limit = 24) {
  const { data, error } = await admin()
    .from("project_artifacts")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as ProjectArtifact[];
}
