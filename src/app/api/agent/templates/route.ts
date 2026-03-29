import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { z } from "zod";

export const runtime = "nodejs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_KINDS = new Set([
  "browser.probe",
  "connector.health",
  "inbox.monitor",
  "inbox.monitor.stub",
  "slack.ping",
  "computer.use",
  "computer.use.stub",
]);

const TemplateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(250).optional().default(""),
  kind: z.string().min(1),
  payload: z.record(z.string(), z.any()).optional().default({}),
});

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await admin
    .from("user_agent_templates")
    .select("id, name, description, kind, payload, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: data || [] });
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = TemplateSchema.parse(await request.json());
    if (!ALLOWED_KINDS.has(body.kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("user_agent_templates")
      .insert({
        user_id: userId,
        name: body.name,
        description: body.description || "",
        kind: body.kind,
        payload: body.payload ?? {},
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ template: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create template" }, { status: 400 });
  }
}

