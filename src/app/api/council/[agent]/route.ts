import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { buildModel } from "@/lib/ai-model";
import { serverOpenRouterKeyFromEnv } from "@/lib/ai/openrouter-env";
import {
  defaultCouncilOpenRouterMiniMaxId,
  defaultCouncilOpenRouterQwenId,
} from "@/lib/agent/council-model-router";
import {
  AGENT_CHAINS,
  SYSTEM_PROMPTS,
  getNextAgent,
  isLastAgent,
} from "@/lib/council/config";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * One model for every session agent (simplest BYOK). Otherwise planner uses LIGHT, others HEAVY.
 */
function openRouterModelForSessionAgent(agent: string): string {
  const single = process.env.COUNCIL_SESSION_OPENROUTER_MODEL?.trim();
  if (single) return single;
  // Keep session agents on the same stable pair: Qwen (primary) / MiniMax (planner bias).
  return agent === "planner" ? defaultCouncilOpenRouterMiniMaxId() : defaultCouncilOpenRouterQwenId();
}

function maxOutTokensForAgent(agent: string): number {
  if (agent === "orchestrator" || agent === "coder") return 12_000;
  if (agent === "architect" || agent === "critic") return 6_000;
  return 4_000;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export async function POST(req: NextRequest, segment: { params: Promise<{ agent: string }> }) {
  const { agent: agentParam } = await segment.params;
  const agent = decodeURIComponent(agentParam);

  if (!SYSTEM_PROMPTS[agent]) {
    return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.session_id || typeof body.session_id !== "string") {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }
  const { session_id } = body;

  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const openrouterKey = serverOpenRouterKeyFromEnv();
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
  if (!openrouterKey && !geminiKey) {
    return NextResponse.json(
      {
        error:
          "Session Council needs OpenRouter (OPENROUTER_KEY / OPENROUTER_API_KEY) and/or Gemini (GEMINI_API_KEY / GOOGLE_AI_API_KEY) in Vercel env.",
      },
      { status: 503 }
    );
  }

  const admin = getAdmin();
  const { data: session, error: sessionError } = await admin
    .from("council_sessions")
    .select("*")
    .eq("id", session_id)
    .eq("user_id", userId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "done" || session.status === "failed") {
    return NextResponse.json({ error: `Session already ${session.status}` }, { status: 409 });
  }

  const chain = AGENT_CHAINS[session.plan as string] ?? AGENT_CHAINS.free;
  if (!chain.includes(agent)) {
    return NextResponse.json(
      { error: `Agent "${agent}" is not in the chain for plan "${session.plan}"` },
      { status: 400 }
    );
  }

  await admin
    .from("council_sessions")
    .update({ status: "running", current_agent: agent })
    .eq("id", session_id);

  const outputs = (session.outputs as Record<string, string>) ?? {};
  const previousOutputs = Object.entries(outputs)
    .map(([role, output]) => `\n\n=== ${role.toUpperCase().replace(/_/g, " ")} OUTPUT ===\n${output}`)
    .join("");

  const userMessage = previousOutputs
    ? `ORIGINAL TASK:\n${session.prompt}${previousOutputs}`
    : `ORIGINAL TASK:\n${session.prompt}`;

  let agentOutput = "";
  try {
    const model = openrouterKey
      ? buildModel(openrouterKey, "openrouter", openRouterModelForSessionAgent(agent))
      : buildModel(geminiKey, "gemini", "gemini-2.0-flash");
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPTS[agent],
      prompt: userMessage,
      maxOutputTokens: maxOutTokensForAgent(agent),
      temperature: 0.3,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(265_000),
    });
    agentOutput = (text || "").trim();

    if (!agentOutput) {
      throw new Error("AI returned empty response");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("council_sessions")
      .update({
        status: "failed",
        error: message,
        current_agent: agent,
      })
      .eq("id", session_id);

    return NextResponse.json({ error: "AI call failed", detail: message }, { status: 500 });
  }

  const nextAgent = getNextAgent(session.plan as string, agent);
  const done = isLastAgent(session.plan as string, agent);
  const updatedOutputs = { ...outputs, [agent]: agentOutput };
  const prevCompleted = Array.isArray(session.agents_completed) ? session.agents_completed : [];
  const completed = [...prevCompleted, agent];

  const { error: updateError } = await admin
    .from("council_sessions")
    .update({
      outputs: updatedOutputs,
      agents_completed: completed,
      current_agent: nextAgent,
      status: done ? "done" : "running",
      ...(done ? { final_output: agentOutput } : {}),
    })
    .eq("id", session_id);

  if (updateError) {
    console.error("[council/agent] save failed", updateError);
  }

  return NextResponse.json({
    agent,
    output: agentOutput,
    next: nextAgent,
    done,
    session_id,
  });
}
