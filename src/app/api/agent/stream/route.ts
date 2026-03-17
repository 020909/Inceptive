import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 120;

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
  return createClient(url, key);
};

const admin = getAdmin();

/* =============================================
   FREE WEB SEARCH — DuckDuckGo (no API key)
   ============================================= */
async function duckDuckGoSearch(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "InceptiveAI/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error("DuckDuckGo request failed");

    const data = await res.json();
    const results: string[] = [];

    // Abstract / instant answer
    if (data.AbstractText) {
      results.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`);
    }

    // Definition
    if (data.Definition) {
      results.push(`Definition: ${data.Definition}`);
    }

    // Related topics
    if (data.RelatedTopics?.length > 0) {
      results.push("\nRelated results:");
      data.RelatedTopics
        .filter((t: any) => t.Text && !t.Topics)
        .slice(0, 6)
        .forEach((t: any) => results.push(`• ${t.Text}`));
    }

    // Direct results
    if (data.Results?.length > 0) {
      results.push("\nDirect results:");
      data.Results.slice(0, 3).forEach((r: any) => {
        results.push(`• ${r.Text} — ${r.FirstURL}`);
      });
    }

    if (results.length === 0) {
      return `No instant results found for "${query}". Consider rephrasing or asking for a more specific topic.`;
    }

    return results.join("\n");
  } catch (err: any) {
    return `Search temporarily unavailable: ${err.message}. Please answer based on your training knowledge.`;
  }
}

/* =============================================
   MODEL ROUTING — provider + model from DB
   ============================================= */
function buildModel(apiKey: string, provider: string, modelName?: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelName || "gpt-4o");

    case "claude":
    case "anthropic":
      return createAnthropic({ apiKey })(modelName || "claude-sonnet-4-5");

    case "openrouter":
      return createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": "https://app.inceptive-ai.com",
          "X-Title": "Inceptive AI",
        },
      })(modelName || "google/gemini-2.0-flash-001");

    case "google":
    default:
      return createGoogleGenerativeAI({ apiKey })(modelName || "gemini-2.0-flash");
  }
}

/* =============================================
   STREAM ROUTE
   ============================================= */
export async function POST(req: Request) {
  try {
    const { messages, user_id } = await req.json();

    if (!messages || !user_id) {
      return new Response(JSON.stringify({ error: "Missing messages or user_id" }), { status: 400 });
    }

    const { data: userData, error: userError } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider, api_model")
      .eq("id", user_id)
      .single();

    if (userError || !userData?.api_key_encrypted) {
      return new Response(
        JSON.stringify({ error: "No API key found. Please add your API key in Settings." }),
        { status: 400 }
      );
    }

    const { api_key_encrypted: apiKey, api_provider, api_model } = userData;
    const model = buildModel(apiKey, api_provider, api_model);

    const systemPrompt = `You are Inceptive, a world-class autonomous AI agent. You are precise, concise, and proactive.

BEHAVIOUR:
1. Always respond with a clear, structured answer.
2. Use the searchWeb tool whenever the user asks about current events, news, companies, people, or anything that benefits from real-time data.
3. Use draftEmail when the user wants to write or draft an email.
4. After using tools, synthesise the results into a helpful, well-formatted response.
5. Use markdown formatting for structure — headers, bullet points, bold text where appropriate.
6. Be direct. No unnecessary filler phrases.`;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: (messages as any[])
        .slice(-12)
        .map((m: any) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" }))
        .filter((m: any) => m.content),
      maxSteps: 10,
      tools: {
        searchWeb: {
          description: "Search the web for current information, news, facts, companies, or any real-time data.",
          inputSchema: z.object({ query: z.string().describe("The search query") }),
          execute: async ({ query }: { query: string }) => {
            console.log(`[Agent] Searching: ${query}`);
            const results = await duckDuckGoSearch(query);
            return { results };
          },
        },
        draftEmail: {
          description: "Save an email draft to the user's email section.",
          inputSchema: z.object({
            recipient: z.string().describe("Recipient name or email"),
            subject: z.string().describe("Email subject line"),
            body: z.string().describe("Full email body in plain text or markdown"),
          }),
          execute: async (args: { recipient: string; subject: string; body: string }) => {
            await admin.from("emails").insert({
              user_id,
              ...args,
              topic: "Draft",
              status: "draft",
            });
            return { status: "success", message: "Email draft saved to your Email Autopilot section." };
          },
        },
      },
    } as any);

    // Stream back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = result.fullStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            let line = "";
            if (value.type === "text-delta") {
              const text = (value as any).text || (value as any).textDelta || "";
              if (text) line = `0:${JSON.stringify(text)}\n`;
            } else if (value.type === "tool-call") {
              line = `1:${JSON.stringify(value)}\n`;
            } else if (value.type === "tool-result") {
              line = `2:${JSON.stringify(value)}\n`;
            } else if (value.type === "error") {
              line = `3:${JSON.stringify((value as any).error)}\n`;
            }

            if (line) controller.enqueue(encoder.encode(line));
          }
        } catch (err: any) {
          controller.enqueue(encoder.encode(`3:${JSON.stringify(err.message)}\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Agent-Build": "v6.0.0-INCEPTIVE",
      },
    });
  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
