import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getTenantIdFromRequest } from "@/lib/ubo/requestContext";
import { generateText } from "ai";
import { buildModel } from "@/lib/ai-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { query: string; topK?: number };
    const { query: searchQuery, topK = 5 } = body;

    if (!searchQuery?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: policies, error: fetchErr } = await admin
      .from("policies")
      .select("id, title, policy_number, category, version, status, content, summary, tags, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (fetchErr) throw new Error(fetchErr.message);

    if (!policies || policies.length === 0) {
      return NextResponse.json({ results: [], answer: "No active policies found in the vault." });
    }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "Search unavailable — AI service not configured" }, { status: 503 });
  }
  const model = buildModel(apiKey, "openai", "gpt-4o");

  const policyContexts = policies.slice(0, 20).map((p: any) => ({
    id: p.id,
    title: p.title,
    number: p.policy_number,
    category: p.category,
    content: (p.content || p.summary || "").slice(0, 3000),
  }));

    const prompt = `You are a compliance policy assistant. Given the following query and a set of active policies, find the most relevant policies and provide an answer with citations.

QUERY: ${searchQuery}

ACTIVE POLICIES:
${policyContexts.map((p: any, i: number) => `[${i + 1}] ${p.title} (${p.number || "no number"}) [${p.category}]:\n${p.content}`).join("\n\n---\n\n")}

Respond with JSON:
{
  "answer": "<detailed answer to the query referencing specific policies>",
  "matched_policies": [{"id": "<policy id>", "relevance_score": <0-1>, "reason": "<why this matches>"}],
  "citations": [{"policy_title": "<title>", "excerpt": "<relevant excerpt>"}]
}

Respond ONLY with valid JSON, no markdown fences.`;

    const { text } = await generateText({ model, prompt });

    let searchResult: any;
    try {
      searchResult = JSON.parse(text);
    } catch {
      searchResult = { answer: text, matched_policies: [], citations: [] };
    }

    return NextResponse.json({ results: searchResult.matched_policies || [], answer: searchResult.answer || "", citations: searchResult.citations || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search policies";
    console.error("Error searching policies:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
