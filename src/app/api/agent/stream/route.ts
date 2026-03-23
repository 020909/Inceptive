import { listUnreadGmail, sendGmailReply, getGmailClientForUser } from '@/lib/email/gmail-api';
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { buildModel } from "@/lib/ai-model";
import { checkCredits, deductCredits, getUserPlan } from "@/lib/credits";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { assertUrlSafeForServerFetch } from "@/lib/url-safety";
import {
  computerClick,
  computerGoto,
  computerScreenshot,
  computerScroll,
  computerType,
  computerMoveMouse,
} from "@/lib/computer-use/session";
import { describeScreenshotBase64 } from "@/lib/vision/describe-screenshot";
import { z } from "zod";

export const maxDuration = 120;
export const runtime = "nodejs";

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
  return createClient(url, key);
};

const admin = getAdmin();

/* ─────────────────────────────────────────
   TOOL DISPLAY MAP — human-readable actions for Live Task Feed
───────────────────────────────────────── */
const TOOL_DISPLAY: Record<string, { icon: string; label: (args: any) => string }> = {
  searchWeb:           { icon: "", label: (a) => `Searching "${a.query}"` },
  browseURL:           { icon: "", label: (a) => `Reading ${new URL(a.url).hostname}` },
  computerUse:         { icon: "", label: (a) => `Browser: ${a.action}${a.url ? ` → ${a.url}` : ""}` },
  readGmail:           { icon: "", label: () => `Scanning Gmail inbox` },
  summarizeEmail:      { icon: "", label: (a) => `Reading email: "${a.subject}"` },
  sendGmail:           { icon: "", label: (a) => `Sending email to ${a.to}` },
  draftEmail:          { icon: "", label: (a) => `Drafting email: "${a.subject}"` },
  saveResearchReport:  { icon: "", label: (a) => `Saving report: "${a.topic}"` },
  scheduleSocialPost:  { icon: "", label: (a) => `Scheduling ${a.platform} post` },
  createGoal:          { icon: "", label: (a) => `Creating goal: "${a.title}"` },
  createTask:          { icon: "", label: (a) => `Adding task: "${a.title}"` },
  updateGoalProgress:  { icon: "", label: (a) => `Updating goal to ${a.progress_percent}%` },
  analyzeData:         { icon: "", label: (a) => `Analyzing: ${a.question?.slice(0, 50)}` },
  generateOutline:     { icon: "", label: (a) => `Generating ${a.type} outline` },
};

/**
 * Log a task action to Supabase + return a stream event line.
 * Fire-and-forget DB insert so it never blocks the stream.
 */
async function logTask(
  userId: string,
  action: string,
  status: "running" | "done" | "error",
  icon: string,
  agentMode: string | undefined,
  details: Record<string, unknown> = {},
  existingLogId?: string
): Promise<{ id: string; streamLine: string }> {
  const id = existingLogId || crypto.randomUUID();
  const now = new Date().toISOString();

  const logEntry = { id, action, status, icon, agent_mode: agentMode || null, details, created_at: now, updated_at: now };
  const streamLine = `4:${JSON.stringify(logEntry)}\n`;

  // Fire-and-forget — don't await, don't block
  if (existingLogId) {
    Promise.resolve(admin.from("task_logs").update({ status, details, updated_at: now }).eq("id", existingLogId)).catch(() => {});
  } else {
    Promise.resolve(admin.from("task_logs").insert({ ...logEntry, user_id: userId })).catch(() => {});
  }

  return { id, streamLine };
}

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
    assertUrlSafeForServerFetch(url);
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
    const user_id = await getAuthenticatedUserIdFromRequest(req);
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { messages, systemOverride } = await req.json();

    if (!messages) {
      return new Response(JSON.stringify({ error: "Missing messages" }), { status: 400 });
    }

    // ── Credit check (before hitting the AI provider) ─────────────────────
    const plan = await getUserPlan(user_id);
    // Basic plan = BYOK, no credit check. Free/Pro/Unlimited check credits.
    if (plan !== "basic") {
      const creditCheck = await checkCredits(user_id, "chat_message");
      if (!creditCheck.allowed && !creditCheck.unlimited) {
        return new Response(
          JSON.stringify({ error: creditCheck.reason }),
          { status: 402 } // Payment Required
        );
      }
    }
    // Fetch user API settings - fallback to default OpenRouter key if user has no personal key
    const { data: coreData } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider, api_model")
      .eq("id", user_id)
      .single();

    let model: ReturnType<typeof buildModel>;
    if (coreData?.api_key_encrypted) {
      const apiProvider = coreData.api_provider ?? "openrouter";
      const apiModel = (coreData as any)?.api_model ?? undefined;
      model = buildModel(coreData.api_key_encrypted, apiProvider, apiModel);
    } else {
      const defaultKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";
      if (!defaultKey) {
        return new Response(
          JSON.stringify({ error: "AI not configured. Add your API key in Settings." }),
          { status: 400 }
        );
      }
      model = buildModel(defaultKey, "openrouter", "google/gemini-2.0-flash-001");
    }

    const systemPrompt = `You are Inceptive — an AI assistant built for entrepreneurs and founders. You are direct, knowledgeable, and helpful.

## TOOLS AVAILABLE
- **searchWeb** — search for real-time info, news, market data (use when asked about current events, live data, or recent info)
- **browseURL** — read a specific webpage (use only when user gives a URL or when search results need deeper reading)
- **computerUse** — control a real headless browser: screenshot, open URL, click, type, scroll, optional vision summary (costs more credits)
- **readGmail** — read the user real Gmail inbox (unread emails, subjects, senders)
- **summarizeEmail** — get full body of a specific email by ID
- **sendGmail** — send a real email via connected Gmail
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
5. **Gmail is connected** — if the user asks about their inbox, emails, or wants to send/reply, use readGmail/sendGmail tools directly. Never say you cannot access email.

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
      system: systemOverride || systemPrompt,
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
            await deductCredits(user_id, "web_search").catch(() => {});
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
            await deductCredits(user_id, "browse_url").catch(() => {});
            const content = await browseURL(url);
            return { url, content };
          },
        },

        /* ── COMPUTER USE (Playwright) ── */
        computerUse: {
          description:
            "Control a headless browser: take screenshots, navigate to URLs (http/https only), click at x,y, type text, scroll, move mouse, or analyze the current view with vision. Use for 'open this site', 'click the login button', etc. Coordinates are viewport pixels (1280x720).",
          parameters: z.object({
            sessionId: z.string().optional().describe("Session id to keep the same browser tab; default 'default'"),
            action: z
              .enum(["screenshot", "goto", "click", "type", "scroll", "moveMouse", "analyze"])
              .describe("What to do"),
            url: z.string().optional().describe("For goto — full URL"),
            x: z.number().optional(),
            y: z.number().optional(),
            text: z.string().optional().describe("For type — text to type"),
            deltaY: z.number().optional().describe("For scroll — vertical pixels"),
            analyze: z.boolean().optional().describe("If true with screenshot/goto/click, run vision summary"),
          }),
          execute: async (args: {
            sessionId?: string;
            action: "screenshot" | "goto" | "click" | "type" | "scroll" | "moveMouse" | "analyze";
            url?: string;
            x?: number;
            y?: number;
            text?: string;
            deltaY?: number;
            analyze?: boolean;
          }) => {
            const sid = args.sessionId || "default";
            const pre = await checkCredits(user_id, "computer_use_action");
            if (!pre.allowed && !pre.unlimited) {
              return { status: "error", message: pre.reason };
            }
            await deductCredits(user_id, "computer_use_action").catch(() => {});

            let visionNote = "";
            const runVision = async (b64: string) => {
              if (args.analyze || args.action === "analyze") {
                visionNote = await describeScreenshotBase64(process.env.OPENROUTER_KEY || "", "openrouter", b64).catch(
                  () => ""
                );
              }
            };

            if (args.action === "goto" && args.url) {
              await computerGoto(user_id, sid, args.url);
              const b64 = await computerScreenshot(user_id, sid);
              await runVision(b64);
              return { status: "success", url: args.url, screenshot: true, vision: visionNote || undefined };
            }
            if (args.action === "click" && args.x != null && args.y != null) {
              await computerClick(user_id, sid, args.x, args.y);
              const b64 = await computerScreenshot(user_id, sid);
              await runVision(b64);
              return { status: "success", clicked: [args.x, args.y], vision: visionNote || undefined };
            }
            if (args.action === "type" && args.text) {
              await computerType(user_id, sid, args.text);
              const b64 = await computerScreenshot(user_id, sid);
              await runVision(b64);
              return { status: "success", typed: args.text.length, vision: visionNote || undefined };
            }
            if (args.action === "scroll") {
              await computerScroll(user_id, sid, args.deltaY ?? 400);
              const b64 = await computerScreenshot(user_id, sid);
              await runVision(b64);
              return { status: "success", scrolled: args.deltaY ?? 400, vision: visionNote || undefined };
            }
            if (args.action === "moveMouse" && args.x != null && args.y != null) {
              await computerMoveMouse(user_id, sid, args.x, args.y);
              return { status: "success", at: [args.x, args.y] };
            }
            if (args.action === "analyze") {
              const b64 = await computerScreenshot(user_id, sid);
              visionNote = await describeScreenshotBase64(process.env.OPENROUTER_KEY || "", "openrouter", b64).catch(() => "");
              return { status: "success", vision: visionNote };
            }
            const b64 = await computerScreenshot(user_id, sid);
            await runVision(b64);
            return { status: "success", screenshot: true, vision: visionNote || undefined };
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
            await deductCredits(user_id, "email_draft").catch(() => {});
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
            await deductCredits(user_id, "research_deep").catch(() => {});
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
            await deductCredits(user_id, "social_post").catch(() => {});
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

        /* -- READ GMAIL -- */
        readGmail: {
          description: "Read the user real Gmail inbox. Use when asked about emails, inbox, messages, or what emails they have.",
          parameters: z.object({ max_results: z.number().optional().describe("Max emails to return, default 10") }),
          execute: async (args: { max_results?: number }) => {
            await deductCredits(user_id, "web_search").catch(() => {});
            const result = await listUnreadGmail(user_id, args.max_results || 10);
            if (result.error) return { status: "error", message: "Gmail not connected. User should connect Gmail in the Email section." };
            return { status: "success", emails: result.messages, count: result.messages.length };
          },
        },
        /* -- SUMMARIZE EMAIL -- */
        summarizeEmail: {
          description: "Get the full body of a specific Gmail message by ID. Use after readGmail to read the full content.",
          parameters: z.object({ email_id: z.string().describe("Message ID from readGmail"), subject: z.string(), from: z.string() }),
          execute: async (args: { email_id: string; subject: string; from: string }) => {
            try {
              const client = await getGmailClientForUser(user_id);
              if (!client) return { status: "error", message: "Gmail not connected" };
              const full = await client.gmail.users.messages.get({ userId: "me", id: args.email_id, format: "full" });
              const extractBody = (part: any): string => {
                if (!part) return "";
                if (part.mimeType === "text/plain" && part.body && part.body.data)
                  return Buffer.from(part.body.data, "base64").toString("utf8");
                if (part.parts) { for (const p of part.parts) { const t = extractBody(p); if (t) return t; } }
                return "";
              };
              const body = (full.data.payload ? extractBody(full.data.payload) : "") || full.data.snippet || "";
              return { status: "success", subject: args.subject, from: args.from, body: body.slice(0, 4000) };
            } catch (e: any) { return { status: "error", message: e.message }; }
          },
        },
        /* -- SEND GMAIL -- */
        sendGmail: {
          description: "Send a real email via the connected Gmail account. Use when user asks to send or reply to an email.",
          parameters: z.object({ to: z.string().describe("Recipient email address"), subject: z.string(), body: z.string().describe("Email body plain text"), thread_id: z.string().optional() }),
          execute: async (args: { to: string; subject: string; body: string; thread_id?: string }) => {
            await deductCredits(user_id, "email_send").catch(() => {});
            const result = await sendGmailReply(user_id, { to: args.to, subject: args.subject, body: args.body, threadId: args.thread_id });
            if (!result.ok) return { status: "error", message: result.error || "Failed to send" };
            return { status: "success", message: "Email sent via Gmail to " + args.to };
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
            await deductCredits(user_id, "goal_create").catch(() => {});
            const { data, error } = await admin.from("goals").insert({
              user_id,
              title: args.title,
              description: args.description,
              status: args.status || "active",
              progress_percent: 0,
              source: "agent",
              last_updated: new Date().toISOString(),
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
            await deductCredits(user_id, "task_create").catch(() => {});
            if (args.goal_id) {
              const { data: goalRow, error: goalErr } = await admin
                .from("goals")
                .select("id")
                .eq("id", args.goal_id)
                .eq("user_id", user_id)
                .maybeSingle();
              if (goalErr || !goalRow) {
                return { status: "error", message: "Goal not found or access denied." };
              }
            }
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
            await deductCredits(user_id, "goal_update").catch(() => {});
            const updateData: Record<string, unknown> = {
              progress_percent: args.progress_percent,
              last_updated: new Date().toISOString(),
              source: "agent",
            };
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

    // Extract agent mode name from systemOverride (if present)
    const agentMode = systemOverride
      ? (systemOverride.match(/You are the (\w+) Agent/i)?.[1] || undefined)
      : undefined;

    // Track tool-call → log-id mapping for updating status on tool-result
    const toolLogIds = new Map<string, string>();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (line: string) => {
          try { controller.enqueue(encoder.encode(line)); } catch {}
        };
        let toolCallCount = 0;
        let producedText = false;
        let thinkingLogId: string | undefined;

        try {
          // Log immediately so every message has multiple lines
          const { streamLine: initLine } = await logTask(user_id, "Processing input...", "done", "", agentMode);
          enqueue(initLine);

          for await (const value of result.fullStream) {
            switch ((value as any).type) {
              case "text-delta": {
                const text = (value as any).text ?? (value as any).textDelta ?? "";
                if (text) {
                  // Log "Thinking..." once when first text appears, save its ID
                  if (!thinkingLogId) {
                    const { id, streamLine } = await logTask(user_id, "Composing response...", "running", "", agentMode);
                    thinkingLogId = id;
                    enqueue(streamLine);
                  }
                  enqueue(`0:${JSON.stringify(text)}\n`);
                  producedText = true;
                }
                break;
              }
              case "tool-call": {
                toolCallCount++;
                enqueue(`1:${JSON.stringify(value)}\n`);
                // Log the tool call with a human-readable label
                const tc = value as any;
                const display = TOOL_DISPLAY[tc.toolName];
                const action = display ? display.label(tc.args || {}) : tc.toolName;
                const icon = display?.icon || "⚡";
                const { id: logId, streamLine } = await logTask(
                  user_id, action, "running", icon, agentMode,
                  { toolName: tc.toolName, args: tc.args }
                );
                toolLogIds.set(tc.toolCallId, logId);
                enqueue(streamLine);
                break;
              }
              case "tool-result": {
                enqueue(`2:${JSON.stringify(value)}\n`);
                // Update the matching log to "done"
                const tr = value as any;
                const existingId = toolLogIds.get(tr.toolCallId);
                if (existingId) {
                  const resultStatus = (tr.result as any)?.status === "error" ? "error" : "done";
                  const { streamLine } = await logTask(
                    user_id, "", resultStatus, "", agentMode,
                    { result: typeof tr.result === "string" ? tr.result : tr.result },
                    existingId
                  );
                  enqueue(streamLine);
                }
                break;
              }
              case "error": {
                const raw = (value as any).error;
                const msg =
                  typeof raw === "string" ? raw
                  : raw?.message ? raw.message
                  : raw?.toString?.() !== "[object Object]" ? raw?.toString()
                  : JSON.stringify(raw);
                enqueue(`3:${JSON.stringify(msg ?? "Unknown error from AI provider")}\n`);
                // Log error
                const { streamLine } = await logTask(user_id, `Error: ${msg}`, "error", "", agentMode);
                enqueue(streamLine);
                break;
              }
            }
          }
          // ── Deduct base chat credit when the model produced visible text (tools bill separately) ──
          if (plan !== "basic" && producedText) {
            await deductCredits(user_id, "chat_message").catch(() => {});
          }

          // ── Final completion updates ──
          if (thinkingLogId) {
            const { streamLine } = await logTask(user_id, "Composing response...", "done", "", agentMode, {}, thinkingLogId);
            enqueue(streamLine);
          }
          const { streamLine: completeLine } = await logTask(user_id, "Task completed - replied to user", "done", "", agentMode);
          enqueue(completeLine);
        } catch (err: any) {
          enqueue(`3:${JSON.stringify(err?.message || "Stream error")}\n`);
          const { streamLine: errLine } = await logTask(user_id, "Task failed", "error", "", agentMode);
          enqueue(errLine);
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
