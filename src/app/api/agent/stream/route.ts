import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 120;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { messages, user_id } = await req.json();

    if (!messages || !user_id) {
      return new Response(JSON.stringify({ error: "Missing messages or user_id" }), { status: 400 });
    }

    const { data: userData, error: userError } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider")
      .eq("id", user_id)
      .single();

    if (userError || !userData?.api_key_encrypted) {
      return new Response(JSON.stringify({ error: "No API key found. Please add your API key in Settings." }), { status: 400 });
    }

    const { api_key_encrypted: apiKey, api_provider } = userData;
    
    let model;
    if (api_provider === "openai") {
      model = createOpenAI({ apiKey })("gpt-4o");
    } else if (api_provider === "claude") {
      model = createAnthropic({ apiKey })("claude-3-5-sonnet-20240620");
    } else if (api_provider === "openrouter") {
      model = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": "https://app.inceptive-ai.com",
          "X-Title": "Inceptive AI",
        }
      })("google/gemini-2.0-flash-001");
    } else {
      model = createGoogleGenerativeAI({ apiKey })("models/gemini-2.0-flash");
    }

    const systemPrompt = `You are Inceptive, an autonomous AI agent. 
RULES:
1. ALWAYS provide a text update before calling a tool.
2. If you need info, use the \`searchWeb\` tool.
3. Use specific tools (\`draftEmail\`, \`scheduleSocialPost\`) to save drafts.
4. NEVER ask the user to perform actions you can do yourself. Provide a final summary.`;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: (messages as any[]).filter(m => m.content?.trim() || (m.toolInvocations && m.toolInvocations.length > 0)),
      maxSteps: 10,
      tools: {
        searchWeb: {
          description: "Search the web for information.",
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }: any) => {
            console.log(`[Tool] searchWeb: ${query}`);
            return { results: `News for ${query}: SpaceX Starship success, AI trends 2026, tech market growth.` };
          }
        },
        draftEmail: {
          description: "Save email draft.",
          inputSchema: z.object({ recipient: z.string(), subject: z.string(), body: z.string(), topic: z.string() }),
          execute: async (args: any) => {
            await admin.from("emails").insert({ user_id, ...args, status: "draft" });
            return { message: "Draft saved." };
          }
        }
      }
    } as any);

    // v4.0.0: Manual Protocol Pipe for Real-Time UI updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = result.fullStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            let line = "";
            if (value.type === 'text-delta') {
              line = `0:${JSON.stringify(value.textDelta)}\n`;
            } else if (value.type === 'tool-call') {
              line = `1:${JSON.stringify(value)}\n`;
            } else if (value.type === 'tool-result') {
              line = `2:${JSON.stringify(value)}\n`;
            } else if (value.type === 'error' || value.type === 'finish') {
              // Finish silently or with meta
            }

            if (line) controller.enqueue(encoder.encode(line));
          }
        } catch (err: any) {
          controller.enqueue(encoder.encode(`3:${JSON.stringify(err.message)}\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Agent-Build": "v4.0.0-STABLE",
      }
    });

  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
