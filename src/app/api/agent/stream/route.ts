import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { buildModel } from "@/lib/ai-model";
import { z } from "zod";

export const maxDuration = 120;

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
  return createClient(url, key);
};

const admin = getAdmin();

/* ─────────────────────────────────────────
   WEB SEARCH — DuckDuckGo (free, no key)
───────────────────────────────────────── */
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
      results.push(`**Summary:** ${data.AbstractText}`);
      if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`);
    }
    if (data.Definition) results.push(`**Definition:** ${data.Definition}`);
    if (data.RelatedTopics?.length > 0) {
      results.push("\n**Related results:**");
      data.RelatedTopics
        .filter((t: any) => t.Text && !t.Topics)
        .slice(0, 8)
        .forEach((t: any) => results.push(`• ${t.Text}`));
    }
    if (data.Results?.length > 0) {
      results.push("\n**Direct results:**");
      data.Results.slice(0, 4).forEach((r: any) => {
        results.push(`• ${r.Text} — ${r.FirstURL}`);
      });
    }
    if (results.length === 0) {
      return `No instant results for "${query}". Use browseURL to fetch specific pages, or answer from training knowledge.`;
    }
    return results.join("\n");
  } catch (err: any) {
    return `Search unavailable (${err.message}). Answering from training knowledge.`;
  }
}

/* ─────────────────────────────────────────
   BROWSE URL — fetch and extract text
───────────────────────────────────────── */
async function browseURL(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InceptiveBot/1.0; +https://inceptive.ai)",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("text/plain") || contentType.includes("application/json")) {
      const text = await res.text();
      return text.slice(0, 6000);
    }

    // HTML — strip tags, extract meaningful text
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();

    return text.slice(0, 6000) + (text.length > 6000 ? "\n\n[content truncated — first 6000 chars shown]" : "");
  } catch (err: any) {
    return `Could not fetch ${url}: ${err.message}`;
  }
}

/* ─────────────────────────────────────────
   STREAM ROUTE
───────────────────────────────────────── */
export async function POST(req: Request) {
  try {
    const { messages, user_id } = await req.json();

    if (!messages || !user_id) {
      return new Response(JSON.stringify({ error: "Missing messages or user_id" }), { status: 400 });
    }

    // ── Step 1: fetch guaranteed columns (api_key_encrypted, api_provider always exist)
    const { data: coreData, error: coreErr } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider")
      .eq("id", user_id)
      .single();

    if (coreErr || !coreData?.api_key_encrypted) {
      const detail = coreErr ? ` (DB: ${coreErr.message})` : " (key is empty)";
      return new Response(
        JSON.stringify({ error: `No API key found. Go to Settings → AI Configuration and save your API key.${detail}` }),
        { status: 400 }
      );
    }

    // ── Step 2: fetch api_model separately — column may not exist if migration not run
    const { data: modelData } = await admin
      .from("users")
      .select("api_model")
      .eq("id", user_id)
      .single();
    // If this errors (e.g. column missing), modelData is null — buildModel uses provider default

    const apiKey = coreData.api_key_encrypted;
    const apiProvider = coreData.api_provider ?? "";
    const apiModel = (modelData as any)?.api_model ?? undefined;

    const model = buildModel(apiKey, apiProvider, apiModel);

    const systemPrompt = `You are Inceptive — an AI assistant built for entrepreneurs and founders. You are direct, knowledgeable, and helpful.

## TOOLS AVAILABLE
- **searchWeb** — search for real-time info, news, market data (use when asked about current events, live data, or recent info)
- **browseURL** — read a specific webpage (use only when user gives a URL or when search results need deeper reading)
- **draftEmail** — save an email draft to Email Autopilot
- **scheduleSocialPost** — schedule a social media post
- **saveResearchReport** — save a research report
- **createGoal** / **createTask** / **updateGoalProgress** — manage goals and tasks
- **analyzeData** — run calculations and analysis
- **generateOutline** — create structured plans and outlines

## WHEN TO USE TOOLS
- General knowledge questions (what is X, explain Y, top 10 Z) → **answer directly** from your training, no tools needed
- "Latest news", "current price", "what happened recently" → use **searchWeb once**, then answer
- User gives a specific URL → use **browseURL** on that URL
- User asks to save/draft/schedule something → use the relevant tool
- Complex research tasks → use searchWeb, then browseURL on 1-2 key results max

## CRITICAL RULES
1. **Answer immediately** — after 1-2 tool calls, always write your response. Never chain more than 2 tool calls before responding.
2. **Don't over-tool** — most questions can be answered from training knowledge. Only search when the answer genuinely requires current/live data.
3. **One search is enough** — never call searchWeb more than once per response unless the user explicitly asks for more research.
4. **Always respond with text** — every response must end with a text answer, even if brief.

## RESPONSE STYLE
- Direct and confident. No filler phrases.
- Use markdown: headers, bold, bullets, code blocks when helpful.
- Format responses clearly — the user should be able to read and act on them immediately.`;

    // ── Build valid message history ──────────────────────────────────────────
    // Rules:
    //  1. Messages must strictly alternate user / assistant
    //  2. Never send an assistant message with empty content (Anthropic rejects it)
    //  3. If an assistant message was empty (e.g. tool-only first turn with no text),
    //     drop that exchange entirely so we don't end up with consecutive user msgs
    //  4. Trim trailing whitespace from assistant content (Anthropic requirement)
    const rawHistory = (messages as any[])
      .slice(-20) // keep a bit more than we need before pruning
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content.trim() : "",
      }));

    const validHistory: { role: "user" | "assistant"; content: string }[] = [];
    let idx = 0;
    while (idx < rawHistory.length) {
      const cur = rawHistory[idx];
      // If this is a user message followed by an empty assistant message, skip the pair
      if (
        cur.role === "user" &&
        idx + 1 < rawHistory.length &&
        rawHistory[idx + 1].role === "assistant" &&
        !rawHistory[idx + 1].content
      ) {
        idx += 2; // skip both
        continue;
      }
      // Skip any orphaned empty message
      if (!cur.content) { idx++; continue; }
      // Prevent two consecutive same-role messages (merge them)
      if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === cur.role) {
        validHistory[validHistory.length - 1].content += "\n\n" + cur.content;
        idx++;
        continue;
      }
      validHistory.push(cur);
      idx++;
    }

    // Ensure the history ends with a user message (the current turn is always appended
    // by the client, so this should already be true — but guard just in case)
    while (validHistory.length > 0 && validHistory[validHistory.length - 1].role === "assistant") {
      validHistory.pop();
    }

    // Cap at 16 messages to keep context reasonable
    const finalHistory = validHistory.slice(-16);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: finalHistory,
      maxSteps: 5,
      // Disable sending reasoning/thinking blocks back in history —
      // they're stripped from client-side state anyway, so including them
      // would cause a mismatch and trigger "Invalid Responses API request"
      providerOptions: {
        anthropic: { sendReasoning: false },
      },
      tools: {

        /* ── SEARCH ── */
        searchWeb: {
          description: "Search the web for current information, news, companies, people, market data, or any real-time facts.",
          parameters: z.object({
            query: z.string().describe("The search query — be specific and descriptive"),
          }),
          execute: async ({ query }: { query: string }) => {
            console.log(`[Agent:search] ${query}`);
            return { query, results: await duckDuckGoSearch(query) };
          },
        },

        /* ── BROWSE URL ── */
        browseURL: {
          description: "Fetch and read the full content of any URL — websites, articles, competitor pages, documentation, LinkedIn profiles, GitHub repos, pricing pages, news articles, etc.",
          parameters: z.object({
            url: z.string().describe("The full URL to browse (must start with http:// or https://)"),
            reason: z.string().optional().describe("Brief note on why you're browsing this URL"),
          }),
          execute: async ({ url, reason }: { url: string; reason?: string }) => {
            console.log(`[Agent:browse] ${url}${reason ? ` — ${reason}` : ""}`);
            const content = await browseURL(url);
            return { url, content };
          },
        },

        /* ── DRAFT EMAIL ── */
        draftEmail: {
          description: "Save a professionally written email draft to the user's Email Autopilot section.",
          parameters: z.object({
            recipient: z.string().describe("Recipient name or email address"),
            subject: z.string().describe("Email subject line"),
            body: z.string().describe("Full email body in plain text or light markdown"),
          }),
          execute: async (args: { recipient: string; subject: string; body: string }) => {
            const { error } = await admin.from("emails").insert({
              user_id,
              ...args,
              status: "draft",
              created_at: new Date().toISOString(),
            });
            if (error) return { status: "error", message: "Failed to save email draft: " + error.message };
            return { status: "success", message: `Email draft saved to Email Autopilot. Subject: "${args.subject}"` };
          },
        },

        /* ── SAVE RESEARCH ── */
        saveResearchReport: {
          description: "Save a comprehensive research report to the user's Research section after conducting thorough research.",
          parameters: z.object({
            topic: z.string().describe("The research topic title"),
            content: z.string().describe("The full research report in markdown — include headers, findings, data, sources"),
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
            if (error) return { status: "error", message: "Failed to save: " + error.message };
            return { status: "success", message: `Research report "${args.topic}" saved to your Research section.` };
          },
        },

        /* ── SCHEDULE SOCIAL POST ── */
        scheduleSocialPost: {
          description: "Create and schedule a social media post.",
          parameters: z.object({
            platform: z.enum(["X", "LinkedIn", "Instagram", "Facebook", "TikTok", "YouTube"]),
            content: z.string().describe("The post content — platform-optimized"),
            scheduled_for: z.string().optional().describe("ISO timestamp (optional, defaults to tomorrow)"),
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
            if (error) return { status: "error", message: "Failed to schedule: " + error.message };
            return { status: "success", message: `Post scheduled for ${args.platform}. Find it in Social Media Manager.` };
          },
        },

        /* ── CREATE GOAL ── */
        createGoal: {
          description: "Create a new goal for the user in the Goals section.",
          parameters: z.object({
            title: z.string().describe("Goal title — clear and specific"),
            description: z.string().describe("Detailed description of the goal"),
            status: z.enum(["active", "paused"]).default("active"),
          }),
          execute: async (args: { title: string; description: string; status: "active" | "paused" }) => {
            const { data, error } = await admin.from("goals").insert({
              user_id,
              title: args.title,
              description: args.description,
              status: args.status || "active",
              progress_percent: 0,
              created_at: new Date().toISOString(),
            }).select().single();
            if (error) return { status: "error", message: "Failed to create goal: " + error.message };
            return { status: "success", goal_id: data.id, message: `Goal created: "${args.title}". Find it in your Goals section.` };
          },
        },

        /* ── CREATE TASK ── */
        createTask: {
          description: "Add a sub-task under a goal, or as a standalone action item to track.",
          parameters: z.object({
            goal_id: z.string().optional().describe("Goal ID to attach this task to (from createGoal result)"),
            title: z.string().describe("Task title"),
            description: z.string().optional().describe("Task description or notes"),
            due_date: z.string().optional().describe("ISO date string for due date"),
          }),
          execute: async (args: { goal_id?: string; title: string; description?: string; due_date?: string }) => {
            const insertData: Record<string, unknown> = {
              user_id,
              title: args.title,
              status: "pending",
              created_at: new Date().toISOString(),
            };
            if (args.goal_id) insertData.goal_id = args.goal_id;
            if (args.description) insertData.description = args.description;
            if (args.due_date) insertData.due_date = args.due_date;

            // Try tasks table first, fall back gracefully
            const { error } = await admin.from("tasks").insert(insertData);
            if (error) return { status: "error", message: "Failed to create task: " + error.message };
            return { status: "success", message: `Task "${args.title}" added.` };
          },
        },

        /* ── UPDATE GOAL PROGRESS ── */
        updateGoalProgress: {
          description: "Update the progress percentage of an existing goal.",
          parameters: z.object({
            goal_id: z.string().describe("The goal ID to update"),
            progress_percent: z.number().min(0).max(100).describe("New progress percentage (0-100)"),
            status: z.enum(["active", "completed", "paused"]).optional(),
          }),
          execute: async (args: { goal_id: string; progress_percent: number; status?: "active" | "completed" | "paused" }) => {
            const updateData: Record<string, unknown> = { progress_percent: args.progress_percent };
            if (args.status) updateData.status = args.status;
            const { error } = await admin.from("goals").update(updateData).eq("id", args.goal_id).eq("user_id", user_id);
            if (error) return { status: "error", message: "Failed to update: " + error.message };
            return { status: "success", message: `Goal progress updated to ${args.progress_percent}%.` };
          },
        },

        /* ── ANALYZE DATA ── */
        analyzeData: {
          description: "Perform calculations, statistical analysis, comparisons, financial projections, or data interpretation on any structured data.",
          parameters: z.object({
            data: z.string().describe("The data to analyze (CSV, JSON, list, or plain text with numbers)"),
            analysis_type: z.enum(["summary_stats", "comparison", "projection", "roi_calc", "market_sizing", "custom"]),
            question: z.string().describe("What specific analysis or insight you want"),
          }),
          execute: async (args: { data: string; analysis_type: string; question: string }) => {
            // Return structured data for model to reason over
            return {
              data: args.data,
              analysis_type: args.analysis_type,
              question: args.question,
              instruction: "Analyze this data and answer the question. Show your calculations. Be specific with numbers.",
            };
          },
        },

        /* ── GENERATE OUTLINE ── */
        generateOutline: {
          description: "Create a structured outline or step-by-step plan for a project, article, business plan, marketing strategy, product roadmap, or any complex topic.",
          parameters: z.object({
            topic: z.string().describe("The topic or project to outline"),
            type: z.enum(["business_plan", "content_calendar", "product_roadmap", "marketing_strategy", "article", "launch_plan", "investor_pitch", "custom"]),
            detail_level: z.enum(["high_level", "detailed", "full_breakdown"]).default("detailed"),
          }),
          execute: async (args: { topic: string; type: string; detail_level: string }) => {
            return {
              topic: args.topic,
              type: args.type,
              detail_level: args.detail_level,
              instruction: `Generate a comprehensive ${args.detail_level} ${args.type} outline for: ${args.topic}. Include specific action items, metrics, and timelines where relevant.`,
            };
          },
        },

      },
    } as any);

    // ReadableStream with async start() — the async work is tied to the stream
    // lifetime so it runs to completion even in serverless environments.
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (line: string) => {
          try { controller.enqueue(encoder.encode(line)); } catch {}
        };
        try {
          for await (const value of result.fullStream) {
            switch ((value as any).type) {
              case "text-delta": {
                const text = (value as any).textDelta ?? "";
                if (text) enqueue(`0:${JSON.stringify(text)}\n`);
                break;
              }
              case "tool-call":
                enqueue(`1:${JSON.stringify(value)}\n`);
                break;
              case "tool-result":
                enqueue(`2:${JSON.stringify(value)}\n`);
                break;
              case "error": {
                const raw = (value as any).error;
                const msg =
                  typeof raw === "string" ? raw
                  : raw?.message ? raw.message
                  : raw?.toString?.() !== "[object Object]" ? raw?.toString()
                  : JSON.stringify(raw);
                enqueue(`3:${JSON.stringify(msg ?? "Unknown error from AI provider")}\n`);
                break;
              }
              // step-start / step-finish / finish — no-op
            }
          }
        } catch (err: any) {
          enqueue(`3:${JSON.stringify(err?.message || "Stream error")}\n`);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Agent-Build": "v9.0.0-INCEPTIVE",
      },
    });
  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
