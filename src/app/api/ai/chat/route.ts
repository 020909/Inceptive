/**
 * POST /api/ai/chat — Credit-powered AI chat via OpenRouter Gemini 2.0 Flash.
 *
 * Flow:
 * 1. Authenticate user via Supabase session
 * 2. Check credit balance (402 if insufficient)
 * 3. Forward to OpenRouter Gemini 2.0 Flash
 * 4. Stream response back to client
 * 5. After stream completes, deduct credits + store in user_memory
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkCreditBalance,
  proxyToOpenRouter,
  calculateCreditCost,
  storeConversationMemory,
  type ProxyChatMessage,
} from "@/lib/ai/proxy";

const getAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data } = await getAdmin().auth.getUser(token);
  return data.user?.id || null;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const body = await req.json();
    const messages: ProxyChatMessage[] = body.messages || [];
    const model = body.model || "google/gemini-2.0-flash-001";
    const temperature = body.temperature;
    const maxTokens = body.max_tokens;
    const tools = body.tools;
    const stream = body.stream !== false; // Default to streaming

    if (!messages.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // 3. Get user settings (API key, credits)
    const admin = getAdmin();
    const { data: userData, error: userErr } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider, api_model")
      .eq("id", userId)
      .single();

    if (userErr && userErr.code !== "PGRST116") {
      throw new Error(`Failed to fetch user settings: ${userErr.message}`);
    }

    // 4. Check credit balance
    const balanceCheck = await checkCreditBalance(userId);
    if (!balanceCheck.allowed) {
      return NextResponse.json(
        {
          error: balanceCheck.reason || "Insufficient credits",
          credits_remaining: balanceCheck.remaining,
          upgrade_url: "/upgrade",
        },
        { status: 402 }
      );
    }

    // 5. Determine API Key and Model
    let apiKey: string | undefined;
    let isFallback = false;
    let usedModel = model;

    if (userData?.api_key_encrypted) {
      const { decryptToken } = await import("@/lib/token-crypto");
      apiKey = decryptToken(userData.api_key_encrypted);
    } else {
      isFallback = true;
      usedModel = "google/gemini-2.0-flash-001"; // Force Gemini 2.0 Flash for fallback
    }

    // 6. Log fallback usage if applicable
    if (isFallback) {
      await admin.from("usage_logs").insert({
        user_id: userId,
        model: usedModel,
        usage_type: "fallback",
        metadata: { stream, message_count: messages.length },
      });
    }

    // 7. Forward to OpenRouter
    if (stream) {
      // Streaming mode
      const openRouterResponse = await proxyToOpenRouter({
        messages,
        model: usedModel,
        temperature,
        max_tokens: maxTokens,
        tools,
        stream: true,
        apiKey,
      });

      // Create a transform stream that collects tokens for credit deduction
      let fullContent = "";
      let estimatedInputTokens = 0;
      let estimatedOutputTokens = 0;
      const toolCalls: unknown[] = [];

      // Estimate input tokens from messages
      for (const msg of messages) {
        estimatedInputTokens += Math.ceil((msg.content?.length || 0) / 4);
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          controller.enqueue(chunk);

          // Parse SSE events to collect content
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) {
                  fullContent += delta.content;
                }
                if (delta?.tool_calls) {
                  toolCalls.push(...delta.tool_calls);
                }
                // Check for usage in the final chunk
                if (parsed.usage) {
                  estimatedInputTokens = parsed.usage.prompt_tokens || estimatedInputTokens;
                  estimatedOutputTokens = parsed.usage.completion_tokens || 0;
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }
        },
        async flush() {
          // Estimate output tokens if not provided by API
          if (estimatedOutputTokens === 0) {
            estimatedOutputTokens = Math.ceil(fullContent.length / 4);
          }

          // Deduct credits
          const cost = calculateCreditCost(estimatedInputTokens, estimatedOutputTokens);
          
          try {
            await admin.rpc("decrement_credits", {
              p_user_id: userId,
              p_amount: cost,
            });

            await admin.from("credit_transactions").insert({
              user_id: userId,
              amount: -cost,
              action: "ai_chat_gemini",
              description: `AI chat (${usedModel}) — ${estimatedInputTokens} in / ${estimatedOutputTokens} out`,
            });
          } catch (e) {
            console.error("[ai/chat] Credit deduction failed:", e);
          }

          // Store conversation memory
          try {
            await storeConversationMemory(
              userId,
              messages,
              fullContent,
              usedModel,
              toolCalls.length > 0 ? toolCalls : undefined
            );
          } catch (e) {
            console.error("[ai/chat] Memory storage failed:", e);
          }
        },
      });

      const responseBody = openRouterResponse.body;
      if (!responseBody) {
        return NextResponse.json({ error: "No response body from AI" }, { status: 502 });
      }

      const transformedStream = responseBody.pipeThrough(transformStream);

      return new Response(transformedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Credits-Remaining": String(balanceCheck.remaining),
        },
      });
    } else {
      // Non-streaming mode
      const openRouterResponse = await proxyToOpenRouter({
        messages,
        model: usedModel,
        temperature,
        max_tokens: maxTokens,
        tools,
        stream: false,
        apiKey,
      });

      const data = await openRouterResponse.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || "";
      const responseTool = choice?.message?.tool_calls;
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };

      // Deduct credits
      const cost = calculateCreditCost(usage.prompt_tokens, usage.completion_tokens);

      await admin.rpc("decrement_credits", {
        p_user_id: userId,
        p_amount: cost,
      });

      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -cost,
        action: "ai_chat_gemini",
        description: `AI chat (${usedModel}) — ${usage.prompt_tokens} in / ${usage.completion_tokens} out`,
      });

      // Store memory
      await admin.from("user_memory").insert({
        user_id: userId,
        messages: JSON.stringify(messages),
        assistant_response: content,
        model: usedModel,
        tool_calls: responseTool ? JSON.stringify(responseTool) : null,
        created_at: new Date().toISOString(),
      });

      // Get updated balance
      const { data: updated } = await admin
        .from("user_credits")
        .select("credits_remaining")
        .eq("user_id", userId)
        .single();

      return NextResponse.json({
        ...data,
        credits: {
          deducted: cost,
          remaining: updated?.credits_remaining ?? 0,
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[api/ai/chat] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
