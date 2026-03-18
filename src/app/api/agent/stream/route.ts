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

    if (data.AbstractText) {
      results.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`);
    }
    if (data.Definition) results.push(`Definition: ${data.Definition}`);
    if (data.RelatedTopics?.length > 0) {
      results.push("\nRelated results:");
      data.RelatedTopics
        .filter((t: any) => t.Text && !t.Topics)
        .slice(0, 6)
        .forEach((t: any) => results.push(`• ${t.Text}`));
    }
    if (data.Results?.length > 0) {
      results.push("\nDirect results:");
      data.Results.slice(0, 3).forEach((r: any) => {
        results.push(`• ${r.Text} — ${r.FirstURL}`);
      });
    }
    if (results.length === 0) {
      return `No instant results found for "${query}". Answering from training knowledge.`;
    }
    return results.join("\n");
  } catch (err: any) {
    return `Search temporarily unavailable: ${err.message}. Answering from training knowledge.`;
  }
}

/* =============================================
   MODEL ROUTING
   ============================================= */
function buildModel(apiKey: string, provider: string, modelName?: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelName || "gpt-4o");
    case "claude":
    case "anthropic":
      return createAnthropic({ apiKey })(modelName || "claude-sonnet-4-6");
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

    const systemPrompt = `You are Inceptive, a world-class autonomous AI agent for entrepreneurs and founders. You are precise, proactive, and deeply helpful.

CAPABILITIES:
1. searchWeb — use for any current events, news, market data, company info, or real-time facts
2. draftEmail — save an email draft to the user's Email Autopilot section
3. saveResearchReport — save a detailed research report to the user's Research section
4. scheduleSocialPost — schedule a social media post for the user

BEHAVIOR:
- Always search the web when asked about current events, companies, people, or data that changes over time
- Use markdown formatting — headers, bullet points, bold text — for structured responses
- After using tools, synthesise results into a clear, actionable response
- Be direct. No filler phrases like "Great question!" or "Certainly!"
- When saving content (emails, reports, posts), confirm what was saved and where to find it
- For startup/business questions, think like a seasoned founder — practical, data-driven, concise`;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: (messages as any[])
        .slice(-12)
        .map((m: any) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" }))
        .filter((m: any) => m.content),
      maxSteps: 12,
      tools: {
        searchWeb: {
          description: "Search the web for current information, news, market data, companies, people, or any real-time facts.",
          inputSchema: z.object({ query: z.string().describe("The search query") }),
          execute: async ({ query }: { query: string }) => {
            console.log(`[Agent] Searching: ${query}`);
            return { results: await duckDuckGoSearch(query) };
          },
        },
        draftEmail: {
          description: "Save an email draft to the user's Email Autopilot section.",
          inputSchema: z.object({
            recipient: z.string().describe("Recipient name or email address"),
            subject: z.string().describe("Email subject line"),
            body: z.string().describe("Full email body in plain text"),
          }),
          execute: async (args: { recipient: string; subject: string; body: string }) => {
            const { error } = await admin.from("emails").insert({
              user_id,
              ...args,
              status: "draft",
              created_at: new Date().toISOString(),
            });
            if (error) return { status: "error", message: "Failed to save email draft." };
            return { status: "success", message: "Email draft saved to Email Autopilot." };
          },
        },
        saveResearchReport: {
          description: "Save a research report to the user's Research section after conducting research.",
          inputSchema: z.object({
            topic: z.string().describe("The research topic title"),
            content: z.string().describe("The full research report content in markdown"),
            sources_count: z.number().optional().describe("Number of sources referenced"),
          }),
          execute: async (args: { topic: string; content: string; sources_count?: number }) => {
            const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
            const urls = args.content.match(urlRegex) || [];
            const { error } = await admin.from("research_reports").insert({
              user_id,
              topic: args.topic,
              content: args.content,
              sources_count: args.sources_count ?? urls.length,
              created_at: new Date().toISOString(),
            });
            if (error) return { status: "error", message: "Failed to save research report." };
            return { status: "success", message: "Research report saved to your Research section." };
          },
        },
        scheduleSocialPost: {
          description: "Schedule a social media post for the user.",
          inputSchema: z.object({
            platform: z.enum(["X", "LinkedIn", "Instagram", "Facebook", "TikTok", "YouTube"]).describe("The social platform"),
            content: z.string().describe("The post content"),
            scheduled_for: z.string().optional().describe("ISO timestamp for when to post (optional, defaults to tomorrow)"),
          }),
          execute: async (args: { platform: string; content: string; scheduled_for?: string }) => {
            const { error } = await admin.from("social_posts").insert({
              user_id,
              platform: args.platform,
              content: args.content,
              status: "scheduled",
              scheduled_for: args.scheduled_for || new Date(Date.now() + 86400000).toISOString(),
              created_at: new Date().toISOString(),
            });
            if (error) return { status: "error", message: "Failed to schedule post." };
            return { status: "success", message: `Post scheduled for ${args.platform}.` };
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
        "X-Agent-Build": "v7.0.0-INCEPTIVE",
      },
    });
  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
