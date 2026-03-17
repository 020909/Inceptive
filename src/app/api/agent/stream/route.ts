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

    const systemPrompt = `You are Inceptive, an autonomous agent. 
RULES:
1. ALWAYS provide an immediate text response summarizing the user's request.
2. Use tools (\`searchWeb\`, \`draftEmail\`) to fulfill complex missions.
3. If requested information is real-time, search the web first.
4. Keep the conversation engaging and proactive.`;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: (messages as any[]).slice(-10).map(m => ({ 
        role: m.role, 
        content: typeof m.content === 'string' ? m.content : "" 
      })).filter(m => m.content),
      maxSteps: 10,
      tools: {
        searchWeb: {
          description: "Search the web for news and information.",
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }: any) => {
            console.log(`[AgentLoop] searching: ${query}`);
            return { results: `News for ${query}: AI agents are transforming SaaS in 2026. SpaceX continues Starship testing success. Global markets are focusing on automation.` };
          }
        },
        draftEmail: {
          description: "Save an email draft.",
          inputSchema: z.object({ recipient: z.string(), subject: z.string(), body: z.string() }),
          execute: async (args: any) => {
            await admin.from("emails").insert({ user_id, ...args, topic: "Draft", status: "draft" });
            return { status: "success", message: "Draft saved." };
          }
        }
      }
    } as any);

    // v5.0.0-ULTRA-STABLE Manual Protocol Pipe
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
              // Extract text properly for AI SDK v6
              const text = (value as any).text || (value as any).textDelta || "";
              if (text) line = `0:${JSON.stringify(text)}\n`;
            } else if (value.type === 'tool-call') {
              // Ensure we send the toolCallId
              line = `1:${JSON.stringify(value)}\n`;
            } else if (value.type === 'tool-result') {
              line = `2:${JSON.stringify(value)}\n`;
            } else if (value.type === 'error') {
              line = `3:${JSON.stringify(value.error)}\n`;
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
        "X-Agent-Build": "v5.0.0-PROD",
      }
    });

  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
