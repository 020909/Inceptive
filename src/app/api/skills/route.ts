import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { z } from "zod";

export const runtime = "nodejs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CATEGORY_OPTIONS = ["Research", "Sales", "Marketing", "Email", "Productivity"] as const;

const SkillCreateSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(250).optional().default(""),
  category: z.enum([...CATEGORY_OPTIONS]),
  tags: z.array(z.string()).optional(),
  prompt: z.string().min(1),
});

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await admin
    .from("user_skills")
    .select("id, title, description, category, tags, prompt, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ skills: data || [] });
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = SkillCreateSchema.parse(await request.json());
    const tags = body.tags && body.tags.length > 0 ? body.tags : [body.category];

    const { data, error } = await admin
      .from("user_skills")
      .insert({
        user_id: userId,
        title: body.title,
        description: body.description || "",
        category: body.category,
        tags,
        prompt: body.prompt,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ skill: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create skill" }, { status: 400 });
  }
}

