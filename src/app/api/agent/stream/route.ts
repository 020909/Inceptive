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
      signal: AbortSignal.timeout(12000),
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

    // Fetch user settings — try with api_model first; if that column doesn't exist yet
    // (migration not run), fall back to selecting without it so the agent still works.
    type UserSettings = { api_key_encrypted: string; api_provider: string; api_model?: string | null };
    let userData: UserSettings | null = null;
    let userFetchError: any = null;

    const result1 = await admin
      .from("users")
      .select("api_key_encrypted, api_provider, api_model")
      .eq("id", user_id)
      .single();

    if (result1.error) {
      const msg = (result1.error.message || "").toLowerCase();
      // If the error is about api_model column not existing, retry without it
      if (msg.includes("api_model") || (msg.includes("column") && msg.includes("exist"))) {
        const result2 = await admin
          .from("users")
          .select("api_key_encrypted, api_provider")
          .eq("id", user_id)
          .single();
        userData = (result2.data as any) ?? null;
        userFetchError = result2.error;
      } else {
        userFetchError = result1.error;
      }
    } else {
      userData = (result1.data as any) ?? null;
    }

    if (userFetchError || !userData || !(userData as UserSettings).api_key_encrypted) {
      const detail = userFetchError ? ` (${userFetchError.message})` : "";
      return new Response(
        JSON.stringify({ error: `No API key found. Please add your API key in Settings.${detail}` }),
        { status: 400 }
      );
    }

    const settings = userData as UserSettings;
    const model = buildModel(settings.api_key_encrypted, settings.api_provider ?? "", settings.api_model ?? undefined);

    const systemPrompt = `You are Inceptive — a world-class autonomous AI agent built for entrepreneurs and founders. You think step-by-step, act decisively, and deliver results.

## YOUR CAPABILITIES

### Research & Information
- **searchWeb** — search for real-time information, news, market data, company info
- **browseURL** — visit ANY website and read its full content (articles, docs, competitor sites, LinkedIn pages, GitHub repos, product pages, pricing pages, etc.)

### Content Creation
- **draftEmail** — compose and save professional emails to Email Autopilot
- **scheduleSocialPost** — create and schedule social media posts
- **saveResearchReport** — save comprehensive research reports with sources

### Task & Goal Management
- **createGoal** — create a new goal with title, description, and target date
- **createTask** — add a task/sub-task under a goal
- **updateGoalProgress** — update the progress percentage of a goal

### Intelligence
- **analyzeData** — perform calculations, comparisons, and analysis on any data
- **generateOutline** — create a detailed outline or plan for any project/content

## BEHAVIOR RULES

1. **Always use tools** — don't just answer from memory when you can verify with searchWeb or browseURL
2. **Multi-step by default** — break complex tasks into steps, use multiple tools in sequence
3. **Browse, don't guess** — if user mentions a company, product, or URL, browseURL it before commenting
4. **Save important outputs** — after research, save with saveResearchReport; after writing emails, use draftEmail
5. **Be an operator** — when asked to "do" something, actually do it using tools, don't just explain how
6. **Startup mindset** — think like a seasoned founder: practical, data-driven, ROI-focused
7. **Format responses** — use markdown: headers, bold, bullets, code blocks as appropriate

## RESPONSE STYLE
- Direct and confident. No filler like "Great question!" or "Certainly!"
- Concise summaries after tool results
- Always tell the user what you did and where to find saved content`;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: (messages as any[])
        .slice(-16)
        .map((m: any) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" }))
        .filter((m: any) => m.content),
      maxSteps: 20,
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
        "X-Agent-Build": "v9.0.0-INCEPTIVE",
      },
    });
  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
