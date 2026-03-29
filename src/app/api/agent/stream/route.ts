import {
  extractPlainTextFromGmailPayload,
  listUnreadGmail,
  sendGmailReply,
  getGmailClientForUser,
} from "@/lib/email/gmail-api";
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { buildModel } from "@/lib/ai-model";
import { routeModel } from "@/lib/ai/model-router";
import { checkCredits, deductCredits, getUserPlan } from "@/lib/credits";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { geocodePlaceQuery } from "@/lib/data/geocode";
import { fetchAggregatedNews } from "@/lib/data/news-fetch";
import { fetchWeatherForCoords } from "@/lib/data/weather-fetch";
import { getStockQuote } from "@/lib/tools/finance-tools";
import { browseUrlText, formatSearchResultsForPrompt, searchWeb } from "@/lib/search/provider";
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
  getWeather:          { icon: "", label: (a) => `Weather: ${a.location || "location"}` },
  getStockQuote:       { icon: "", label: (a) => `Quote: ${a.symbol}` },
  getNewsHeadlines:    { icon: "", label: (a) => `News: ${String(a.query || "headlines").slice(0, 48)}` },
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
   STREAM ROUTE
───────────────────────────────────────── */
export async function POST(req: Request) {
  try {
    const requestId = crypto.randomUUID();
    const user_id = await getAuthenticatedUserIdFromRequest(req);
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { messages, systemOverride, attachedFiles } = await req.json();
    console.log(`[agent.stream][${requestId}] start`, {
      user_id,
      messages: Array.isArray(messages) ? messages.length : 0,
      attachedFiles: Array.isArray(attachedFiles) ? attachedFiles.length : 0,
    });

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
    const lastUserMessage =
      (Array.isArray(messages) ? [...messages].reverse().find((m: any) => m?.role === "user")?.content : "") || "";
    // Free-only mode for launch: we only use free/cheap-friendly defaults.
    // If you later add paid keys/models, router can be expanded safely.
    const routed = routeModel({
      lastUserMessage,
      userPreferredProvider: coreData?.api_provider || null,
      userPreferredModel: (coreData as any)?.api_model || null,
      freeOnly: true,
    });

    if (coreData?.api_key_encrypted) {
      // BYOK users: respect their key but still route model name safely.
      model = buildModel(coreData.api_key_encrypted, routed.provider, routed.model);
    } else {
      // No BYOK: prefer Groq for low-latency chat when configured, then OpenRouter, then Gemini.
      const groqKey = process.env.GROQ_API_KEY?.trim();
      const groqModel = process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.3-70b-versatile";
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
      const openrouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";

      if (groqKey) {
        model = buildModel(groqKey, "groq", groqModel);
      } else if (openrouterKey) {
        model = buildModel(openrouterKey, "openrouter", routed.model);
      } else if (geminiKey) {
        model = buildModel(geminiKey, "gemini", "gemini-2.0-flash");
      } else {
        return new Response(
          JSON.stringify({
            error: "AI not configured. Add GROQ_API_KEY, OpenRouter, or Gemini in env, or BYOK in Settings.",
          }),
          { status: 400 }
        );
      }
    }

        // DYNAMIC CONTEXT: fetch live connectors + goals + memory
    const { data: _conns } = await getAdmin()
      .from('connected_accounts').select('provider, account_email').eq('user_id', user_id);
    const _ca = (_conns || []) as any[];
    const _gm = _ca.some((a:any) => a.provider === 'gmail');
    const _gmEmail = _ca.find((a:any) => a.provider === 'gmail')?.account_email || '';
    const _ol = _ca.some((a:any) => a.provider === 'outlook');
    const _tw = _ca.some((a:any) => a.provider === 'twitter');
    const _li = _ca.some((a:any) => a.provider === 'linkedin');
    const _ig = _ca.some((a:any) => a.provider === 'instagram');
    const _cs = [
      _gm ? 'Gmail (' + _gmEmail + ') CONNECTED - readGmail/sendGmail/summarizeEmail all work' : 'Gmail NOT connected - tell user to connect in Email section',
      _ol ? 'Outlook CONNECTED' : 'Outlook not connected',
      _tw ? 'Twitter/X CONNECTED - can post' : 'Twitter/X not connected',
      _li ? 'LinkedIn CONNECTED - can post' : 'LinkedIn not connected',
      _ig ? 'Instagram CONNECTED' : 'Instagram not connected',
    ].join('\n');
    const { data: _gl } = await getAdmin()
      .from('goals').select('title,progress_percent').eq('user_id',user_id).eq('status','active').limit(3);
    const _gs = (_gl||[]).map((g:any)=>g.title+'('+g.progress_percent+'%)').join(', ') || 'none';
    const systemPrompt = `You are Inceptive - a powerful AI agent for entrepreneurs and founders.

## CONNECTED ACCOUNTS (LIVE)
${_cs}

## ACTIVE GOALS: ${_gs}

## TOOLS
- searchWeb: real-time search
- browseURL: read any webpage
- getWeather: current weather by city or region name (e.g. "Tokyo", "Austin TX")
- getStockQuote: live stock quote by ticker (e.g. TSLA, AAPL)
- getNewsHeadlines: news headlines for a topic (aggregates configured sources)
- readGmail: read Gmail inbox (only if Gmail CONNECTED above)
- summarizeEmail: get full email body by ID
- sendGmail: send email via Gmail (only if Gmail CONNECTED)
- draftEmail: save email draft
- scheduleSocialPost: post to social media
- saveResearchReport: save research report
- createGoal/createTask/updateGoalProgress: manage goals
- analyzeData: calculations
- generateOutline: plans and roadmaps

## RULES
1. CHECK CONNECTED ACCOUNTS above - if Gmail shows CONNECTED, use readGmail immediately when asked about email. Never say you cannot access email if Gmail is connected.
2. ALWAYS USE TOOLS for real actions. When user says read my email -> call readGmail. When user says send email -> call sendGmail. For weather use getWeather; for a stock price use getStockQuote; for news headlines use getNewsHeadlines — do not invent numbers.
3. Be direct - no filler. Lead with action.
4. After tool calls, clearly summarize results.
5. If connector not connected, tell user exactly: go to Email section and click Connect.
6. If file context is provided, DO NOT repeat it verbatim or show "Attached Files" scaffolding. Summarize/answer directly from the relevant parts. Only reference file names if it helps clarity.
7. If [INCEPTIVE_FILE_CONTEXT_BEGIN] is present, treat it as real extracted file content. Never say you cannot access files or ask for a URL for those files.
8. Never print raw JSON tool arguments (e.g. {"location":"..."}) as your reply — answer in plain English after tools run.`;


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

    // Inject file contents into last user message if files attached
    if (attachedFiles && (attachedFiles as any[]).length > 0 && validHistory.length > 0) {
      const lastMsg = validHistory[validHistory.length - 1];
      if (lastMsg.role === 'user') {
        const fileCtx = (attachedFiles as any[])
          .map((f: any) => `[FILE:${f.name}]\n${f.content}`)
          .join('\n\n');
        lastMsg.content = lastMsg.content + `\n\n[INCEPTIVE_FILE_CONTEXT_BEGIN]\n${fileCtx}\n[INCEPTIVE_FILE_CONTEXT_END]`;
      }
    }

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
            const data = await searchWeb(query, 8);
            return {
              query,
              provider: data.provider,
              items: data.items,
              results: formatSearchResultsForPrompt(query, data),
            };
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
            const content = await browseUrlText(url, 6000);
            return { url, content };
          },
        },

        getWeather: {
          description:
            "Get current weather for a location. Pass a city, region, or address (e.g. 'San Francisco', 'Mumbai'). Uses the same backend as the dashboard weather widget.",
          parameters: z.object({
            location: z.string().describe("City, region, or place name (English is fine)"),
          }),
          execute: async ({ location }: { location: string }) => {
            await deductCredits(user_id, "web_search").catch(() => {});
            let lat = 19.076;
            let lon = 72.8777;
            const q = location.trim();
            if (q) {
              const g = await geocodePlaceQuery(q);
              if (g) {
                lat = g.lat;
                lon = g.lon;
              }
            }
            const w = await fetchWeatherForCoords(lat, lon);
            return {
              location: q || "default",
              lat,
              lon,
              current: w.current,
              source: w.source,
            };
          },
        },

        getStockQuote: {
          description:
            "Get a live stock quote by ticker symbol (e.g. TSLA, MSFT, AAPL). Uses Alpha Vantage when configured, else a public fallback.",
          parameters: z.object({
            symbol: z.string().describe("Ticker symbol, e.g. TSLA"),
          }),
          execute: async ({ symbol }: { symbol: string }) => {
            await deductCredits(user_id, "web_search").catch(() => {});
            const quote = await getStockQuote(symbol.trim());
            return {
              symbol: quote.symbol,
              price: quote.price,
              currency: quote.currency || null,
              source: quote.source,
            };
          },
        },

        getNewsHeadlines: {
          description:
            "Get recent news headlines for a topic or keyword (e.g. 'AI startups', 'climate'). Uses GNews when API key is set plus Hacker News.",
          parameters: z.object({
            query: z.string().optional().describe("Topic or keywords; default broad tech/business"),
            max: z.number().optional().describe("Max articles per source (1–15, default 8)"),
          }),
          execute: async (args: { query?: string; max?: number }) => {
            await deductCredits(user_id, "web_search").catch(() => {});
            const max = Math.min(15, Math.max(1, args.max ?? 8));
            const { gnews, hackernews } = await fetchAggregatedNews(args.query?.trim() || "technology", max);
            return {
              query: args.query?.trim() || "technology",
              gnews,
              hackernews,
              hasGNewsKey: Boolean(process.env.GNEWS_API_KEY?.trim()),
            };
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
          if (result.error) {
            if (result.error === "gmail_not_connected") {
              return { status: "error", message: "Gmail not connected. User should connect Gmail in the Email section." };
            }
            return { status: "error", message: `Gmail error (${result.error}): ${(result as any).reason || "Unknown reason"}` };
          }
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
              if ("error" in client) {
                return {
                  status: "error",
                  message: client.error === "gmail_not_connected" ? "Gmail not connected" : client.reason || "Gmail token invalid",
                };
              }
              const full = await client.gmail.users.messages.get({ userId: "me", id: args.email_id, format: "full" });
              const body =
                (full.data.payload ? extractPlainTextFromGmailPayload(full.data.payload) : "") ||
                full.data.snippet ||
                "";
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
        const getTextDelta = (v: any): string => {
          if (!v || typeof v !== "object") return "";
          if (typeof v.textDelta === "string") return v.textDelta;
          if (typeof v.text === "string") return v.text;
          if (typeof v.delta === "string") return v.delta;
          if (typeof v.content === "string") return v.content;
          if (typeof v.output_text === "string") return v.output_text;
          return "";
        };

        /** AI SDK may wrap execute() output as { type: "json", value: {...} } */
        const unwrapToolOutput = (o: any): any => {
          if (o == null) return null;
          if (typeof o === "object" && (o as any).type === "json" && "value" in o) return (o as any).value;
          return o;
        };

        const normalizeToolResult = (tr: any): any =>
          unwrapToolOutput(tr?.result ?? tr?.output ?? tr?.data ?? null);

        /** Model sometimes echoes tool arguments as "text" — never show that as the answer */
        const isGarbageUserFacingText = (s: string): boolean => {
          const t = s.trim();
          if (t.length < 2 || t.length > 800) return false;
          if (!t.startsWith("{") || !t.endsWith("}")) return false;
          try {
            const j = JSON.parse(t) as Record<string, unknown>;
            if (typeof j !== "object" || j === null) return false;
            const keys = Object.keys(j);
            const toolArgKeys = new Set([
              "location",
              "symbol",
              "query",
              "max",
              "reason",
              "url",
              "stdin",
              "language_id",
              "source_code",
            ]);
            if (keys.length === 0 || keys.length > 10) return false;
            return keys.every((k) => toolArgKeys.has(k));
          } catch {
            return false;
          }
        };

        const SKIP_OPPORTUNISTIC_TYPES = new Set([
          "tool-call",
          "tool-result",
          "tool-error",
          "tool-input-start",
          "tool-input-delta",
          "tool-input-end",
          "start-step",
          "finish-step",
          "file",
        ]);
        let producedAnyText = false;
        let producedMeaningfulText = false;
        let thinkingLogId: string | undefined;
        let fallbackFromTools = "";
        /** AI SDK v6 uses tool-input-available / tool-output-available; map id → name */
        const toolNameByCallId = new Map<string, string>();

        const inferToolNameFromOutput = (normalized: any): string => {
          if (!normalized || typeof normalized !== "object") return "";
          const o = normalized as any;
          if (typeof o.symbol === "string" && "price" in o && typeof o.source === "string") return "getStockQuote";
          if (o.current != null && o.source && (o.location !== undefined || o.lat !== undefined)) return "getWeather";
          if (Array.isArray(o.gnews) || Array.isArray(o.hackernews)) return "getNewsHeadlines";
          if (o.status === "success" && Array.isArray(o.emails)) return "readGmail";
          if (typeof o.results === "string") return "searchWeb";
          if (typeof o.content === "string" && o.url) return "browseURL";
          return "";
        };

        const handleToolFinished = async (tr: any) => {
          const normalized = normalizeToolResult(tr);
          let toolName =
            (tr?.toolName || tr?.name || tr?.tool?.name || toolNameByCallId.get(tr?.toolCallId) || "") as string;
          if (!toolName) toolName = inferToolNameFromOutput(normalized);

          if (!fallbackFromTools) {
            const r = normalized;
            if (r?.status === "success" && Array.isArray(r?.emails)) {
              const top = r.emails
                .slice(0, 5)
                .map((e: any, i: number) => `${i + 1}. ${e.subject || "(No subject)"} — ${e.from || "Unknown sender"}`)
                .join("\n");
              fallbackFromTools = `I checked your inbox and found ${r.emails.length} emails.\n${top}`;
            } else if (r?.status === "success" && typeof r?.results === "string") {
              fallbackFromTools = r.results.slice(0, 1200);
            } else if (toolName === "getWeather" && r?.current) {
              const c = r.current as Record<string, unknown>;
              const temp = c.temperature_2m ?? c.temp;
              fallbackFromTools = [
                r.location && `Place: ${r.location}`,
                temp != null && `Temperature: ${String(temp)}° (metric)`,
                c.description != null && String(c.description),
                r.source && `Source: ${r.source}`,
              ]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 1200);
            } else if (
              (toolName === "getStockQuote" ||
                (r &&
                  typeof r === "object" &&
                  typeof (r as any).symbol === "string" &&
                  "price" in (r as any) &&
                  typeof (r as any).source === "string")) &&
              r &&
              typeof r === "object"
            ) {
              const sym = (r as any).symbol;
              const pr = (r as any).price;
              if (pr != null && Number.isFinite(Number(pr))) {
                fallbackFromTools = `${sym}: ${pr} ${(r as any).currency || "USD"} (via ${(r as any).source})`.trim();
              } else {
                fallbackFromTools = `Could not fetch a live price for ${sym} (${(r as any).source}).`;
              }
            } else if (
              toolName === "getNewsHeadlines" &&
              r &&
              (Array.isArray((r as any).gnews) || Array.isArray((r as any).hackernews))
            ) {
              const gn = ((r as any).gnews || []).slice(0, 5).map((x: any) => `• ${x.title} — ${x.url}`).join("\n");
              const hn = ((r as any).hackernews || []).slice(0, 5).map((x: any) => `• ${x.title} — ${x.url}`).join("\n");
              fallbackFromTools = [`Headlines (${(r as any).query}):`, gn && `GNews:\n${gn}`, hn && `Hacker News:\n${hn}`]
                .filter(Boolean)
                .join("\n\n")
                .slice(0, 2000);
            } else if (r?.status === "error" && typeof r?.message === "string") {
              fallbackFromTools = `I hit an issue while running the tool: ${r.message}`;
            } else if (typeof r?.message === "string") {
              fallbackFromTools = r.message;
            }
          }

          if (!producedMeaningfulText) {
            const r = normalized;
            const inferred = inferToolNameFromOutput(r);
            const dataTools =
              toolName === "readGmail" ||
              toolName === "searchWeb" ||
              toolName === "browseURL" ||
              toolName === "getWeather" ||
              toolName === "getStockQuote" ||
              toolName === "getNewsHeadlines" ||
              inferred === "readGmail" ||
              inferred === "searchWeb" ||
              inferred === "browseURL" ||
              inferred === "getWeather" ||
              inferred === "getStockQuote" ||
              inferred === "getNewsHeadlines";
            if (dataTools && r) {
              const tn = toolName || inferred;
              if (tn === "readGmail" && r?.status === "success" && Array.isArray(r?.emails)) {
                const top = r.emails
                  .slice(0, 10)
                  .map((e: any, i: number) => `${i + 1}. ${e.subject || "(No subject)"} — ${e.from || "Unknown sender"}`)
                  .join("\n");
                const msg = `Here are your latest emails (${r.emails.length}):\n${top}`;
                enqueue(`0:${JSON.stringify(msg)}\n`);
                producedAnyText = true;
                producedMeaningfulText = true;
              } else if (tn === "searchWeb" && typeof r?.results === "string" && r.results.trim()) {
                const msg = r.results.slice(0, 2000);
                enqueue(`0:${JSON.stringify(msg)}\n`);
                producedAnyText = true;
                producedMeaningfulText = true;
              } else if (tn === "browseURL" && typeof r?.content === "string" && r.content.trim()) {
                const msg = r.content.slice(0, 2000);
                enqueue(`0:${JSON.stringify(msg)}\n`);
                producedAnyText = true;
                producedMeaningfulText = true;
              } else if (tn === "getWeather" && r?.current) {
                const c = r.current as Record<string, unknown>;
                const temp = c.temperature_2m ?? c.temp;
                const msg = [
                  `Weather for ${r.location}:`,
                  temp != null && `Temperature: ${String(temp)}°`,
                  c.description != null && String(c.description),
                  `(data: ${r.source})`,
                ]
                  .filter(Boolean)
                  .join(" ");
                enqueue(`0:${JSON.stringify(msg)}\n`);
                producedAnyText = true;
                producedMeaningfulText = true;
              } else if (
                (tn === "getStockQuote" ||
                  (r &&
                    typeof r === "object" &&
                    typeof (r as any).symbol === "string" &&
                    "price" in (r as any))) &&
                r &&
                typeof r === "object"
              ) {
                const pr = (r as any).price;
                const msg =
                  pr != null && Number.isFinite(Number(pr))
                    ? `${(r as any).symbol}: ${pr} ${(r as any).currency || "USD"} (source: ${(r as any).source})`
                    : `Could not fetch a live price for ${(r as any).symbol} (${(r as any).source}).`;
                enqueue(`0:${JSON.stringify(msg)}\n`);
                producedAnyText = true;
                producedMeaningfulText = true;
              } else if (
                tn === "getNewsHeadlines" &&
                (Array.isArray((r as any).gnews) || Array.isArray((r as any).hackernews))
              ) {
                const gn = ((r as any).gnews || []).slice(0, 6).map((x: any) => `• ${x.title}`).join("\n");
                const hn = ((r as any).hackernews || []).slice(0, 6).map((x: any) => `• ${x.title}`).join("\n");
                const msg = [`News for "${(r as any).query}":`, gn && `GNews:\n${gn}`, hn && `Hacker News:\n${hn}`]
                  .filter(Boolean)
                  .join("\n\n");
                enqueue(`0:${JSON.stringify(msg.slice(0, 2000))}\n`);
                producedAnyText = true;
                producedMeaningfulText = true;
              } else if (r?.status === "error" && typeof r?.message === "string") {
                const msg = `I couldn’t complete that action: ${r.message}`;
                enqueue(`0:${JSON.stringify(msg)}\n`);
                producedAnyText = true;
                producedMeaningfulText = true;
              }
            }
          }

          const existingId = toolLogIds.get(tr.toolCallId);
          if (existingId) {
            const resultStatus = (normalized as any)?.status === "error" ? "error" : "done";
            const { streamLine } = await logTask(
              user_id,
              "",
              resultStatus,
              "",
              agentMode,
              { result: typeof normalized === "string" ? normalized : normalized },
              existingId
            );
            enqueue(streamLine);
          }
          console.log(`[agent.stream][${requestId}] tool-output`, {
            toolName,
            hasFallback: Boolean(fallbackFromTools),
            producedMeaningfulText,
          });
        };

        try {
          // Log immediately so every message has multiple lines
          const { streamLine: initLine } = await logTask(user_id, "Processing input...", "done", "", agentMode);
          enqueue(initLine);

          for await (const value of result.fullStream) {
            // Some providers emit text deltas in different shapes. Never treat tool-* stream
            // events as user-facing text (avoids leaking tool args JSON into the chat).
            const isTextDeltaEvent = (value as any)?.type === "text-delta";
            const evtType = String((value as any)?.type || "");
            const opportunisticText =
              !isTextDeltaEvent && !SKIP_OPPORTUNISTIC_TYPES.has(evtType) ? getTextDelta(value as any) : "";
            if (opportunisticText) {
              const trimmed = opportunisticText.trim();
              if (!trimmed || trimmed === "{}" || isGarbageUserFacingText(trimmed)) {
                continue;
              }
              if (!thinkingLogId) {
                const { id, streamLine } = await logTask(user_id, "Composing response...", "running", "", agentMode);
                thinkingLogId = id;
                enqueue(streamLine);
              }
              enqueue(`0:${JSON.stringify(opportunisticText)}\n`);
              producedAnyText = true;
              producedMeaningfulText = true;
            }
            switch ((value as any).type) {
              case "text-delta": {
                const text = (value as any).text ?? (value as any).textDelta ?? "";
                if (text) {
                  const trimmed = text.trim();
                  if (!trimmed || trimmed === "{}" || isGarbageUserFacingText(trimmed)) break;
                  // Log "Thinking..." once when first text appears, save its ID
                  if (!thinkingLogId) {
                    const { id, streamLine } = await logTask(user_id, "Composing response...", "running", "", agentMode);
                    thinkingLogId = id;
                    enqueue(streamLine);
                  }
                  enqueue(`0:${JSON.stringify(text)}\n`);
                  producedAnyText = true;
                  producedMeaningfulText = true;
                }
                break;
              }
              case "tool-call": {
                const tc = value as any;
                if (tc.toolCallId && tc.toolName) toolNameByCallId.set(tc.toolCallId, tc.toolName);
                enqueue(`1:${JSON.stringify(value)}\n`);
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
              case "tool-input-available": {
                const v = value as any;
                if (v.toolCallId && v.toolName) toolNameByCallId.set(v.toolCallId, v.toolName);
                enqueue(`1:${JSON.stringify({ toolCallId: v.toolCallId, toolName: v.toolName, args: v.input })}\n`);
                const display = TOOL_DISPLAY[v.toolName];
                const action = display ? display.label(v.input || {}) : v.toolName;
                const icon = display?.icon || "⚡";
                const { id: logId, streamLine } = await logTask(
                  user_id, action, "running", icon, agentMode,
                  { toolName: v.toolName, args: v.input }
                );
                toolLogIds.set(v.toolCallId, logId);
                enqueue(streamLine);
                break;
              }
              case "tool-output-available": {
                const v = value as any;
                enqueue(`2:${JSON.stringify(value)}\n`);
                await handleToolFinished({
                  toolCallId: v.toolCallId,
                  toolName: toolNameByCallId.get(v.toolCallId) || "",
                  output: v.output,
                  result: v.output,
                });
                break;
              }
              case "tool-result": {
                enqueue(`2:${JSON.stringify(value)}\n`);
                const tr = value as any;
                if (tr.toolCallId && tr.toolName) toolNameByCallId.set(tr.toolCallId, tr.toolName);
                await handleToolFinished(tr);
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
          if (plan !== "basic" && producedAnyText) {
            await deductCredits(user_id, "chat_message").catch(() => {});
          }

          // ── Final completion updates ──
          if (thinkingLogId) {
            const { streamLine } = await logTask(user_id, "Composing response...", "done", "", agentMode, {}, thinkingLogId);
            enqueue(streamLine);
          }
          // If the model only emitted "{}" or whitespace, treat it as no real answer and use tool fallback.
          if (!producedMeaningfulText) {
            const fallback =
              fallbackFromTools ||
              "I completed the action, but could not generate a final response text. Please try again.";
            enqueue(`0:${JSON.stringify(fallback)}\n`);
          }
          console.log(`[agent.stream][${requestId}] complete`, {
            producedAnyText,
            producedMeaningfulText,
            usedFallback: !producedMeaningfulText,
          });
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
