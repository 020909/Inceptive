import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { buildModel } from "@/lib/ai-model";
import { generateText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BulkSchema = z.object({
  files: z.array(z.object({
    name: z.string(),
    content: z.string().max(20000),
    mime_type: z.string().optional(),
    file_type: z.string().optional(),
  })).min(1).max(30),
  prompt: z.string().min(1).max(2000).optional(),
});

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const can = await checkCredits(userId, "research_deep");
  if (!can.unlimited && !can.allowed) {
    return NextResponse.json({ error: can.reason }, { status: 402 });
  }

  const body = BulkSchema.parse(await req.json());
  const prompt = body.prompt?.trim() || "Analyze these files together. Find cross-file patterns, conflicts, and key insights.";

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
  const openrouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";
  const model = geminiKey
    ? buildModel(geminiKey, "gemini", "gemini-2.0-flash")
    : openrouterKey
      ? buildModel(openrouterKey, "openrouter", "google/gemini-2.0-flash-001")
      : null;

  if (!model) {
    return NextResponse.json({ error: "AI not configured (set GEMINI_API_KEY or OPENROUTER_KEY)" }, { status: 400 });
  }

  const combined = body.files
    .map((f, i) => {
      const typeLabel = [f.file_type, f.mime_type].filter(Boolean).join(" / ");
      const cleaned = normalizeForModel(f.content, f.file_type || f.mime_type || "");
      return `FILE ${i + 1}: ${f.name}${typeLabel ? ` (${typeLabel})` : ""}\n${cleaned}`;
    })
    .join("\n\n---\n\n");

  const result = await generateText({
    model,
    system:
      "You are a multi-file analyst. Produce: 1) Executive Summary, 2) Cross-file Insights, 3) Contradictions, 4) Actionable Recommendations.",
    prompt: `${prompt}\n\n${combined}`,
  });

  await deductCredits(userId, "research_deep", "files.bulk_process").catch(() => {});
  return NextResponse.json({ summary: result.text, files_count: body.files.length });
}

function normalizeForModel(input: string, typeHint: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "[No extractable text content]";

  const lowered = typeHint.toLowerCase();
  if (lowered.includes("json")) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2).slice(0, 9000);
    } catch {
      return trimmed.slice(0, 9000);
    }
  }

  // Keep line structure for code/docs, collapse extremely noisy whitespace for others.
  if (lowered.includes("code") || lowered.includes("javascript") || lowered.includes("typescript") || lowered.includes("markdown")) {
    return trimmed.slice(0, 9000);
  }

  return trimmed.replace(/\s{3,}/g, "\n\n").slice(0, 9000);
}

