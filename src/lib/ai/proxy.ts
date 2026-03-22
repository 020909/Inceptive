/**
 * OpenRouter Gemini 2.0 Flash proxy — credit-powered AI chat.
 *
 * This module handles:
 * 1. Credit balance checks before making AI calls
 * 2. Forwarding requests to OpenRouter (Gemini 2.0 Flash)
 * 3. Deducting credits after response based on token usage
 * 4. Storing conversations in user_memory for persistent context
 */

import { createClient } from "@supabase/supabase-js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-2.0-flash-001";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";

// Safety multipliers so we never go negative on credits
const INPUT_TOKEN_COST_MULTIPLIER = 1.2;
const OUTPUT_TOKEN_COST_MULTIPLIER = 4.8;

// Minimum credits to allow a request (estimated ~500 tokens in + 1000 out)
const MIN_CREDITS_ESTIMATE = 10;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ProxyChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export interface ProxyChatRequest {
  messages: ProxyChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  stream?: boolean;
  apiKey?: string; // Optional custom API key
}

export interface CreditBalanceResult {
  allowed: boolean;
  remaining: number;
  reason?: string;
}

/**
 * Check if user has enough credits for an AI chat request.
 */
export async function checkCreditBalance(userId: string): Promise<CreditBalanceResult> {
  const admin = getAdmin();

  // Check if user has unlimited (BYOK / active subscription)
  const { data: userData } = await admin
    .from("users")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();

  // BYOK users (api_key_encrypted exists) get a pass as long as they have >0 credits or are pro
  const { data: userKeys } = await admin
    .from("users")
    .select("api_key_encrypted")
    .eq("id", userId)
    .single();
  
  const hasUserKey = !!userKeys?.api_key_encrypted;

  if (userData) {
    const isUnlimited =
      userData.plan === "basic" ||
      ((userData.plan === "pro" || userData.plan === "unlimited") &&
        (userData.subscription_status === "active" || userData.subscription_status === "trialing"));
    
    if (isUnlimited || hasUserKey) {
      return { allowed: true, remaining: 999_999 };
    }
  }

  // Check credit balance
  const { data: credits } = await admin
    .from("user_credits")
    .select("credits_remaining")
    .eq("user_id", userId)
    .single();

  const remaining = credits?.credits_remaining ?? 0;

  if (remaining < MIN_CREDITS_ESTIMATE) {
    return {
      allowed: false,
      remaining,
      reason: "Insufficient credits. Buy more → /upgrade",
    };
  }

  return { allowed: true, remaining };
}

/**
 * Calculate credit cost from token usage.
 */
export function calculateCreditCost(inputTokens: number, outputTokens: number): number {
  return Math.ceil(inputTokens * INPUT_TOKEN_COST_MULTIPLIER + outputTokens * OUTPUT_TOKEN_COST_MULTIPLIER);
}

/**
 * Deduct credits after a successful AI call.
 */
export async function deductAICreditCost(
  userId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<{ deducted: number; remaining: number }> {
  const admin = getAdmin();
  const cost = calculateCreditCost(inputTokens, outputTokens);

  // Use RPC to atomically decrement
  await admin.rpc("decrement_credits", {
    p_user_id: userId,
    p_amount: cost,
  });

  // Log the transaction
  await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: -cost,
    action: "ai_chat_gemini",
    description: `AI chat (${model}) — ${inputTokens} in / ${outputTokens} out tokens`,
  });

  // Get updated balance
  const { data: updated } = await admin
    .from("user_credits")
    .select("credits_remaining")
    .eq("user_id", userId)
    .single();

  return { deducted: cost, remaining: updated?.credits_remaining ?? 0 };
}

/**
 * Store conversation + tool calls in user_memory for persistent context.
 */
export async function storeConversationMemory(
  userId: string,
  messages: ProxyChatMessage[],
  assistantResponse: string,
  model: string,
  toolCalls?: unknown[]
): Promise<void> {
  const admin = getAdmin();

  await admin.from("user_memory").insert({
    user_id: userId,
    messages: JSON.stringify(messages),
    assistant_response: assistantResponse,
    model,
    tool_calls: toolCalls ? JSON.stringify(toolCalls) : null,
    created_at: new Date().toISOString(),
  });
}

/**
 * Forward a chat request to OpenRouter with Gemini 2.0 Flash.
 * Returns the raw Response for streaming support.
 */
export async function proxyToOpenRouter(
  request: ProxyChatRequest
): Promise<Response> {
  // Use provided apiKey or fallback to default
  const apiKey = request.apiKey || process.env.OPENROUTER_DEFAULT_KEY || process.env.OPENROUTER_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_DEFAULT_KEY is not configured");
  }

  const model = request.model || DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages: request.messages,
    stream: request.stream ?? true,
  };

  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
  if (request.tools && request.tools.length > 0) body.tools = request.tools;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": APP_URL,
      "X-Title": "Inceptive AI Employee",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${errorText}`);
  }

  return response;
}

/**
 * Make a non-streaming chat request and return parsed response with usage.
 */
export async function chatWithGemini(
  request: Omit<ProxyChatRequest, "stream">
): Promise<{
  content: string;
  toolCalls?: unknown[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  const response = await proxyToOpenRouter({ ...request, stream: false });
  const data = await response.json();

  const choice = data.choices?.[0];
  const content = choice?.message?.content || "";
  const toolCalls = choice?.message?.tool_calls;
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  return { content, toolCalls, usage };
}
