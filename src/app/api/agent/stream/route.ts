import {
  extractPlainTextFromGmailPayload,
  listUnreadGmail,
  sendGmailReply,
  getGmailClientForUser,
} from "@/lib/email/gmail-api";
import { YoutubeTranscript } from "youtube-transcript";
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
import { isPistonConfigured, runPistonSubmission, PISTON_LANGUAGE_IDS } from "@/lib/code/piston-client";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

export const maxDuration = 300; // 5 minutes
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
  searchWeb:           { icon: "", label: () => "Searching the web..." },
  deepResearch:        { icon: "", label: () => "Running deep research..." },
  browseURL:           { icon: "", label: () => "Reading webpage..." },
  summarizeURL:        { icon: "📋", label: () => "Summarizing URL content..." },
  getWeather:          { icon: "", label: () => "Checking weather..." },
  getStockQuote:       { icon: "", label: () => "Fetching stock price..." },
  getNewsHeadlines:    { icon: "", label: () => "Fetching latest news..." },
  computerUse:         { icon: "", label: () => "Using the browser..." },
  readGmail:           { icon: "", label: () => "Scanning Gmail inbox..." },
  summarizeEmail:      { icon: "", label: () => "Reading email..." },
  sendGmail:           { icon: "", label: () => "Sending email..." },
  draftEmail:          { icon: "", label: () => "Drafting email..." },
  saveResearchReport:  { icon: "", label: () => "Saving report..." },
  scheduleSocialPost:  { icon: "", label: () => "Scheduling social post..." },
  runCode:             { icon: "", label: () => "Executing code..." },
  createGoal:          { icon: "", label: () => "Creating goal..." },
  createTask:          { icon: "", label: () => "Adding task..." },
  updateGoalProgress:  { icon: "", label: () => "Updating goal progress..." },
  analyzeData:         { icon: "", label: () => "Analyzing data..." },
  generateOutline:     { icon: "", label: () => "Generating outline..." },
  generateExcel:       { icon: "", label: () => "Creating Excel spreadsheet..." },
  generatePowerPoint:  { icon: "", label: () => "Creating PowerPoint presentation..." },
  generatePDF:         { icon: "", label: () => "Creating PDF document..." },
  generateImage:       { icon: "🎨", label: () => "Generating AI image..." },
  projectMap:          { icon: "📁", label: () => "Mapping project structure..." },
  codeGrep:            { icon: "🔍", label: (args: any) => `Searching for "${args.query}"...` },
  readProjectFile:     { icon: "📄", label: (args: any) => `Reading ${args.path.split('/').pop()}...` },
  multiAgentDebate:    { icon: "🧠", label: () => `Running 10-Agent Council Protocol...` },
  saveStylePreference: { icon: "🎨", label: () => "Saving style preference..." },
  createProject:       { icon: "📁", label: () => "Creating new project..." },
  fetchUrl:            { icon: "🌐", label: (args: any) => `Fetching ${args.url?.slice(0, 40)}...` },
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

    const nvidiaKey = process.env.NVIDIA_NIM_API_KEY || "";
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
    const openrouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const groqModel = process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.3-70b-versatile";

    if (routed.provider === "debate") {
      // Orchestrator for debate requires extremely stable tool calling (Gemini 2.0 Flash)
      const key = coreData?.api_key_encrypted || openrouterKey || geminiKey;
      model = buildModel(key, "debate", routed.model);
    } else if (routed.provider === "nvidia") {
      const key = coreData?.api_key_encrypted || nvidiaKey;
      model = buildModel(key, "nvidia", routed.model);
    } else if (coreData?.api_key_encrypted) {
      // BYOK users: respect their key but still route model name safely.
      model = buildModel(coreData.api_key_encrypted, routed.provider, routed.model);
    } else {
      // No BYOK: prefer Groq, then OpenRouter, then Gemini.
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
    const { data: userData } = await getAdmin()
      .from('users').select('agent_preferences, raw_user_meta_data').eq('id', user_id).single();
    const prefs = userData?.agent_preferences || {};
    const aiName = prefs.aiName || "Inceptive";
    const aiPersonality = prefs.aiPersonality || "Professional";
    const aiTone = prefs.aiTone || "Helpful";
    const userName = userData?.raw_user_meta_data?.display_name || "User";

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
    const systemPrompt = `You are ${aiName} - a powerful AI agent for entrepreneurs and founders.
The user you are speaking to is named: ${userName}. Address them appropriately.
Your Personality is: ${aiPersonality}.
Your Tone is: ${aiTone}.

Adopt this persona and tone throughout the entire conversation. Be helpful, deeply intelligent, and direct.

## CONNECTED ACCOUNTS (LIVE)
${_cs}

## ACTIVE GOALS: ${_gs}

## TOOLS
- searchWeb: real-time search
- fetchUrl: read, extract, and analyze ANY URL, webpage, article, or YouTube video transcript
- browseURL: read any webpage
- summarizeURL: fetch + deeply summarize any URL, PDF link, or article
- projectMap: list all files in the current codebase to understand project structure
- codeGrep: search for patterns or strings (functions, variables) across the entire project
- readProjectFile: read the full content of any file in the project
- runCode: execute Python or JavaScript in a sandbox to verify logic or perform calculations
- getStockQuote/getWeather/getNewsHeadlines: live data
- createGoal/createTask/updateGoalProgress: manage dashboard goals
- analyzeData/generateOutline: strategy and data tools
- generateExcel/generatePowerPoint/generatePDF/generateImage: file generation tools
- computerUse: control a headless browser with vision
- multiAgentDebate: the 10-Agent Council Protocol (Planner, UX Designer, Architect, Coder, Critic, Tester, Doc Specialist, Visual Polish, Deployer, Orchestrator)
- saveStylePreference: remember user's design/coding preferences across sessions
- createProject: create a new organized project for the user

## QUALITY STANDARDS (CRITICAL)
13. Be thorough and detailed. For factual questions (history, science, finance, tech), provide comprehensive answers with context, nuance, and examples — not 2-sentence replies.
14. Structure long answers with ## headers, bullet points, or numbered lists so they're easy to scan.
15. When doing research or analysis, reason step-by-step before concluding. Show your thinking.
16.2. SUPERCODED AGENT WORKFLOW (CRITICAL):
   - For all coding, debugging, or architectural tasks, ALWAYS follow this 4-step loop. Never summarize or skip steps.
     1. **REASON & PLAN**: Take at least 60 seconds of internal 'thinking' time to architect the entire solution. Do not rush.
     2. **MAP REPOSITORY**: Use \`projectMap\` and \`codeGrep\` to find every relevant file. Use \`readProjectFile\` to understand the existing implementation before suggesting changes.
     3. **10-AGENT COUNCIL**: You MUST call the \`multiAgentDebate\` tool for all code generation. This activates the full 10-Agent Council: Planner, UX Designer, Architect, Coder (Qwen 3.6 + Minimax M2.5), Critic, Tester, Doc Specialist, Visual Polish, Deployer, and Orchestrator. Do not write code yourself unless it's a 1-line trivial fix. 
     4. **PERFECTIONIST SYNTHESIS**: The Council's Orchestrator will synthesize the ULTIMATE, bug-free, 100% production-ready code from all 10 agents. Present it to the user. 
   - **NO LAZINESS**: If asked for a "full web app", you must provide at least 400-600 lines of comprehensive HTML/CSS/JS. Include complex layouts, landing pages, footers, animations, and interactive logic. NEVER use placeholders like "additional code here...".
   - **QUALITY OVER SPEED**: You are being judged on the quality and thoroughness of your result, not how fast you finish. Take the full 10 steps if necessary.
3. ALWAYS USE TOOLS for real actions. When user says read my email → call readGmail. When user says send email → call sendGmail. For weather use getWeather; for a stock price use getStockQuote; for news headlines use getNewsHeadlines — do not invent numbers. 
4. Be direct - no filler. Lead with action or the key insight.
5. If connector not connected, tell user exactly: go to Email section and click Connect.
6. If file context is provided, DO NOT repeat it verbatim or show "Attached Files" scaffolding. Summarize/answer directly from the relevant parts.
7. If [INCEPTIVE_FILE_CONTEXT_BEGIN] is present, treat it as real extracted file content. Never say you cannot access files.
8. Never print raw JSON tool arguments as your reply — answer in plain English after tools run.
9. STYLE MEMORY: When a user mentions a design preference (e.g. "I like rounded corners", "always use Inter font", "dark mode only"), call \`saveStylePreference\` to remember it. The 10-Agent Council will use these preferences in future sessions.
10. URL ANALYSIS: When user shares a URL or asks to read/analyze/summarize any webpage, article, or YouTube video, use the \`fetchUrl\` tool IMMEDIATELY. Never say you cannot access URLs.
11. DOCUMENT GENERATION (CRITICAL): When asked to generate Excel, PDF, or PowerPoint: NEVER refuse, NEVER say you cannot guarantee accuracy, NEVER ask for clarification unless something truly ambiguous. You have FULL knowledge in training data - use it. The content MUST contain actual data (names, numbers, etc.) not placeholder text.
12. IMAGE GENERATION (CRITICAL): When asked to generate an image → call generateImage IMMEDIATELY with a detailed descriptive prompt.
9. PREVIEW WEBSITES IN CHAT (ULTIMATE QUALITY): If the user asks you to create a website, landing page, pricing page, or UI component:
   - YOU MUST write a COMPLETE, PRODUCTION-READY document wrapped in a \`\`\`html code block. 
   - **TAKE YOUR TIME**: Write massive, detailed HTML documents. Include 10+ feature sections, pricing tables, testimonials, and FAQs.
   - ALWAYS start with <!DOCTYPE html> and include <html>, <head>, <body> tags
   - ALWAYS include <meta name="viewport" content="width=device-width, initial-scale=1.0">
   - ALWAYS include Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>
   - ALWAYS use Google Fonts (Inter or similar): <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
   - Use DARK MODE by default (dark backgrounds like #0a0a0a, #111, #1a1a2e)
   - Use vibrant gradient accents (purple-to-blue, pink-to-orange, etc.)
   - Include smooth CSS animations and hover effects using Tailwind's \`hover:\` or custom CSS.
   - Make it LOOK like a $50,000 professionally designed website. NOT a basic template.
   - DO NOT use placeholder images — use CSS gradients, SVG patterns, or emoji instead
   - IF YOU ARE LAZY, YOU FAIL. Quality and depth are your only goals.
10. DATA VISUALIZATION: If the user asks you to show a chart, graph, or data visualization, output a Chart.js configuration JSON inside a \`\`\`chart code block. Example format:
\`\`\`chart
{"type":"bar","data":{"labels":["Jan","Feb","Mar"],"datasets":[{"label":"Sales","data":[12,19,3],"backgroundColor":["#6366f1","#8b5cf6","#a78bfa"]}]}}
\`\`\`
The chat interface will automatically render this as an interactive chart. Use vibrant colors.`;


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
    if (attachedFiles && Array.isArray(attachedFiles) && attachedFiles.length > 0 && validHistory.length > 0) {
      const lastMsg = validHistory[validHistory.length - 1];
      if (lastMsg.role === 'user') {
        const fileCtx = attachedFiles
          .map((f: any) => `[FILE:${f.name}]\n${f.content || "(No text preview available)"}`)
          .join('\n\n');
        
        const imageUrls = attachedFiles
          .filter((f: any) => f.content && typeof f.content === 'string' && f.content.includes("Signed URL: https://") && (f.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i) || f.content.includes("image/")))
          .map((f: any) => {
            const match = f.content.match(/Signed URL: (https:\/\/[^\s\)]+)/);
            return match ? match[1] : null;
          })
          .filter(Boolean);

        const newTextContent = lastMsg.content + `\n\n[INCEPTIVE_FILE_CONTEXT_BEGIN]\n${fileCtx}\n[INCEPTIVE_FILE_CONTEXT_END]`;

        if (imageUrls.length > 0) {
          // Convert the last message to an array of parts for multimodal parsing
          const parts: any[] = [{ type: 'text', text: newTextContent }];
          for (const url of imageUrls) {
            parts.push({ type: 'image', image: url });
          }
          lastMsg.content = parts as any;
        } else {
          lastMsg.content = newTextContent as any;
        }
      }
    }

    // Shared enqueue ref — lets tools stream events to the response in real-time.
    // Set inside the ReadableStream start() closure, captured by tool execute closures.
    let streamEnqueue: ((line: string) => void) | null = null;

    const result = streamText({
      model,
      system: systemOverride || systemPrompt,
      messages: finalHistory,
      maxSteps: 25,
      maxTokens: 8000,
      // Disable sending reasoning/thinking blocks back in history —
      // they're stripped from client-side state anyway, so including them
      // would cause a mismatch and trigger "Invalid Responses API request"
      providerOptions: {
        anthropic: { sendReasoning: false },
      },
      tools: {

        /* ── REPOSITORY ANALYSIS ── */
        projectMap: {
          description: "List all files in the current project to understand the structure. Use this as as a first step to find relevant files.",
          parameters: z.object({
            directory: z.string().optional().describe("Directory to list (relative to project root). Default is root."),
            depth: z.number().optional().default(2).describe("How many levels deep to list"),
          }),
          execute: async ({ directory, depth }: { directory?: string; depth?: number }) => {
            const root = process.cwd();
            const target = path.join(root, directory || "");
            
            // Security: ensure target is within root
            if (!target.startsWith(root)) {
              return { status: "error", message: "Access denied: outside project root" };
            }

            const ignore = ['.git', 'node_modules', '.next', 'dist', '.vercel', 'logs', 'tmp'];
            
            const listFiles = async (dir: string, currentDepth: number): Promise<string[]> => {
              if (currentDepth > (depth || 2)) return [];
              try {
                const entries = await readdir(dir, { withFileTypes: true });
                let results: string[] = [];
                for (const entry of entries) {
                  if (ignore.includes(entry.name)) continue;
                  const res = path.resolve(dir, entry.name);
                  const rel = path.relative(root, res);
                  if (entry.isDirectory()) {
                    results.push(rel + "/");
                    results.push(...(await listFiles(res, currentDepth + 1)));
                  } else {
                    results.push(rel);
                  }
                }
                return results;
              } catch (e) {
                return [];
              }
            };

            const files = await listFiles(target, 0);
            return { status: "success", files: files.slice(0, 500) };
          },
        },

        /* ── MULTI-AGENT COUNCIL (10 Agents) ── */
        multiAgentDebate: {
          description: "Runs the full 10-Agent Council Protocol: Planner, Architect, UX Designer, Coder (Qwen 3.6 + Minimax M2.5), Critic, Tester, Doc Specialist, Visual Polish, Deployer, and Orchestrator. Use this for ALL complex programming, design, and document tasks.",
          parameters: z.object({
            codingRequest: z.string().describe("The comprehensive task, prompt, or bug to solve. Provide full context including file contents."),
          }),
          execute: async ({ codingRequest }: { codingRequest: string }) => {
            const openrouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";
            if (!openrouterKey) {
              return { error: "OpenRouter key missing, cannot run Council Protocol." };
            }

            try {
              const { runCouncil } = await import("@/lib/agent/council");

              // Load user's style memory for design agents
              let styleMemory: Record<string, string> = {};
              try {
                const { data: prefs } = await admin
                  .from("style_preferences")
                  .select("preference_key, preference_value, context")
                  .eq("user_id", user_id);
                if (prefs) {
                  for (const p of prefs) {
                    styleMemory[`${p.context}:${p.preference_key}`] = p.preference_value;
                  }
                }
              } catch {} // Style memory is optional

              const councilResult = await runCouncil({
                task: codingRequest,
                openrouterKey,
                styleMemory,
                onAgentEvent: (event) => {
                  const logEntry = {
                    id: `council-${event.agentRole}-${Date.now()}`,
                    action: `${event.agentName}: ${event.status === "thinking" ? "analyzing..." : event.status}`,
                    status: event.status === "done" ? "done" as const : event.status === "error" ? "error" as const : "running" as const,
                    icon: "🧠",
                    agent_mode: "council",
                    details: {
                      agentRole: event.agentRole,
                      agentName: event.agentName,
                      agentStatus: event.status,
                      phase: event.phase,
                      agentOutput: event.output || "",
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  const streamLine = `4:${JSON.stringify(logEntry)}\n`;
                  if (streamEnqueue) streamEnqueue(streamLine);
                  void (async () => { try { await admin.from("task_logs").insert({ ...logEntry, user_id }); } catch {} })();
                },
              });

              // Emit trust score as a final council event
              const trustEvent = {
                id: `council-trust-${Date.now()}`,
                action: `Trust Score: ${councilResult.trustScore}/100`,
                status: "done" as const,
                icon: "🛡️",
                agent_mode: "council",
                details: { trustScore: councilResult.trustScore, agentsUsed: councilResult.agentsUsed.length },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              if (streamEnqueue) streamEnqueue(`4:${JSON.stringify(trustEvent)}\n`);

              const contributionSummary = councilResult.contributions
                .filter((c) => c.status === "done")
                .map((c) => `### ${c.name}\n${c.output}`)
                .join("\n\n---\n\n");

              return {
                status: "success",
                message: `10-Agent Council completed in ${(councilResult.totalDurationMs / 1000).toFixed(1)}s. ${councilResult.agentsUsed.length} agents. Trust: ${councilResult.trustScore}/100.`,
                agentsUsed: councilResult.agentsUsed,
                totalDurationMs: councilResult.totalDurationMs,
                trustScore: councilResult.trustScore,
                synthesis: councilResult.synthesis,
                fullDeliberation: contributionSummary,
              };
            } catch (err: any) {
              return { error: `Council Protocol failed: ${err.message}` };
            }
          },
        },

        /* ── SAVE STYLE PREFERENCE ── */
        saveStylePreference: {
          description: "Remember a user's design/code style preference. Call this when the user says things like 'I prefer dark mode', 'use rounded corners', 'I like Inter font', etc.",
          parameters: z.object({
            key: z.string().describe("Preference key, e.g. 'font', 'border-radius', 'color-scheme', 'framework', 'coding-style'"),
            value: z.string().describe("Preference value, e.g. 'Inter', '12px', 'dark', 'React with TypeScript'"),
          }),
          execute: async ({ key, value }: { key: string; value: string }) => {
            try {
              await admin.from("style_preferences").upsert({
                user_id,
                preference_key: key,
                preference_value: value,
                context: "global",
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id,preference_key,context" });
              return { status: "success", message: `Style preference saved: ${key} = ${value}. I'll remember this for future sessions.` };
            } catch (err: any) {
              return { status: "success", message: `Noted: ${key} = ${value}. (Could not persist to DB: ${err.message})` };
            }
          },
        },

        /* ── CREATE PROJECT ── */
        createProject: {
          description: "Create a new project for organizing code, documents, or any creative work. Use when user says 'start a new project', 'create a project', etc.",
          parameters: z.object({
            name: z.string().describe("Project name"),
            description: z.string().optional().describe("Brief project description"),
            template: z.enum(["blank", "nextjs", "react", "landing-page", "api", "document"]).optional(),
          }),
          execute: async ({ name, description, template }: { name: string; description?: string; template?: string }) => {
            const { data, error } = await admin.from("projects").insert({
              user_id,
              name,
              description: description || "",
              template: template || "blank",
              files: [],
              settings: {},
            }).select().single();
            if (error) return { status: "error", message: `Failed to create project: ${error.message}` };
            return { status: "success", project_id: data.id, message: `Project "${name}" created! Find it in your Projects section.` };
          },
        },

        codeGrep: {
          description: "Search for a specific string or pattern across all project files. Use this to find where functions or variables are defined or used.",
          parameters: z.object({
            query: z.string().describe("The string or regex to search for"),
            include: z.string().optional().describe("Glob pattern to limit search (e.g. 'src/**/*.ts')"),
          }),
          execute: async ({ query, include }: { query: string; include?: string }) => {
            const root = process.cwd();
            const ignore = ['.git', 'node_modules', '.next', 'dist', '.vercel', 'logs', 'tmp'];
            
            const results: { path: string; line: number; content: string }[] = [];
            const searchDir = async (dir: string) => {
              const entries = await readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (ignore.includes(entry.name)) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  await searchDir(fullPath);
                } else {
                  // Only search text files
                  if (/\.(ts|tsx|js|jsx|json|md|css|html|txt)$/i.test(entry.name)) {
                    const content = await readFile(fullPath, 'utf8');
                    const lines = content.split('\n');
                    lines.forEach((line, i) => {
                      if (line.includes(query)) {
                        results.push({
                          path: path.relative(root, fullPath),
                          line: i + 1,
                          content: line.trim().slice(0, 200),
                        });
                      }
                    });
                  }
                }
                if (results.length > 50) break;
              }
            };

            await searchDir(root);
            return { status: "success", matches: results.slice(0, 50) };
          },
        },

        readProjectFile: {
          description: "Read the full content of a specific file in the project. Use this before editing a file or to understand implementation details.",
          parameters: z.object({
            path: z.string().describe("Relative path to the file from project root"),
          }),
          execute: async (args: { path: string }) => {
            const root = process.cwd();
            const fullPath = path.join(root, args.path);
            
            if (!fullPath.startsWith(root)) {
              return { status: "error", message: "Access denied" };
            }

            try {
              const content = await readFile(fullPath, 'utf8');
              return { status: "success", path: args.path, content };
            } catch (e: any) {
              return { status: "error", message: e.message };
            }
          },
        },

        /* ── FETCH & ANALYZE URL ── */
        fetchUrl: {
          description: "Fetch and extract clean text content from any URL, webpage, article, or YouTube video. Use when user asks to read, analyze, or summarize a URL or YouTube link.",
          parameters: z.object({
            url: z.string().describe("The full URL to fetch (supports any webpage, article, blog, YouTube video, etc.)"),
            extractType: z.enum(["text", "summary", "full"]).optional().describe("Type of extraction: text (plain text), summary (key points), full (everything)"),
          }),
          execute: async ({ url, extractType }: { url: string; extractType?: string }) => {
            await deductCredits(user_id, "web_search").catch(() => {});

            try {
              // YouTube handling
              const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
              if (youtubeMatch) {
                const videoId = youtubeMatch[1];
                // Try to get transcript via free API
                try {
                  const transcriptRes = await fetch(
                    `https://yt-transcript-api.vercel.app/api/transcript?videoId=${videoId}`,
                    { signal: AbortSignal.timeout(10000) }
                  );
                  if (transcriptRes.ok) {
                    const transcriptData = await transcriptRes.json();
                    const transcript = Array.isArray(transcriptData)
                      ? transcriptData.map((t: any) => t.text || t.snippet || "").join(" ")
                      : typeof transcriptData === "string" ? transcriptData : JSON.stringify(transcriptData);
                    return {
                      status: "success",
                      type: "youtube",
                      videoId,
                      url,
                      transcript: transcript.slice(0, 8000),
                      message: `YouTube transcript extracted (${transcript.length} chars). Analyze and summarize this content.`,
                    };
                  }
                } catch {}
                // Fallback: return video info
                return {
                  status: "partial",
                  type: "youtube",
                  videoId,
                  url,
                  message: "Could not extract YouTube transcript. The user may need to paste the content or use a different approach.",
                  embedUrl: `https://www.youtube.com/embed/${videoId}`,
                };
              }

              // General webpage fetching
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);

              const res = await fetch(url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; InceptiveBot/1.0)",
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                signal: controller.signal,
                redirect: "follow",
              });
              clearTimeout(timeout);

              if (!res.ok) {
                return { status: "error", message: `Failed to fetch URL: HTTP ${res.status}` };
              }

              const contentType = res.headers.get("content-type") || "";
              if (contentType.includes("application/json")) {
                const json = await res.json();
                return { status: "success", type: "json", url, content: JSON.stringify(json, null, 2).slice(0, 8000) };
              }

              const html = await res.text();

              // Simple but effective HTML to text extraction
              let text = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
                .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
                .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, " ")
                .trim();

              // Extract title
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
              const title = titleMatch ? titleMatch[1].trim() : url;

              // Extract meta description
              const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
              const description = descMatch ? descMatch[1].trim() : "";

              return {
                status: "success",
                type: "webpage",
                url,
                title,
                description,
                content: text.slice(0, 8000),
                contentLength: text.length,
                message: `Webpage content extracted from "${title}" (${text.length} chars). Analyze this content as requested.`,
              };
            } catch (err: any) {
              return { status: "error", message: `Failed to fetch URL: ${err.message}` };
            }
          },
        },

        /* ── SEARCH ── */
        searchWeb: {
          description: "Search the web for current information, news, companies, people, market data, or any real-time facts.",
          parameters: z.object({
            query: z.string().describe("The search query — be specific and descriptive"),
            depth: z.enum(["basic", "advanced"]).optional().default("basic").describe("Search depth: 'basic' for quick results, 'advanced' for deeper research"),
          }),
          execute: async (args: { query: string; depth?: "basic" | "advanced" }) => {
            console.log(`[Agent:search] ${args.query} (${args.depth || "basic"})`);
            await deductCredits(user_id, args.depth === "advanced" ? "research_deep" : "web_search").catch(() => {});
            const data = await searchWeb(args.query, 8, args.depth || "basic");
            return {
              query: args.query,
              provider: data.provider,
              items: data.items,
              results: formatSearchResultsForPrompt(args.query, data),
            };
          },
        },

        deepResearch: {
          description: "Perform an exhaustive, multi-source deep research study on a topic. Use this when the user asks for 'wide research', 'deep dive', or 'thorough analysis'.",
          parameters: z.object({
            query: z.string().describe("The comprehensive research topic or question"),
          }),
          execute: async ({ query }: { query: string }) => {
            console.log(`[Agent:deepResearch] ${query}`);
            await deductCredits(user_id, "research_deep").catch(() => {});
            const data = await searchWeb(query, 12, "advanced");
            return {
              query,
              provider: data.provider,
              items: data.items,
              results: formatSearchResultsForPrompt(query, data),
              instruction: "This is a deep research result. Analyze all sources, synthesize the findings, and provide a comprehensive structured report with citations.",
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

        summarizeURL: {
          description: "Fetch and deeply summarize any URL, article, or webpage. Use when the user pastes a link and asks to summarize, explain, analyze, or understand it.",
          parameters: z.object({
            url: z.string().describe("The full URL to fetch and summarize (must start with http:// or https://)"),
          }),
          execute: async ({ url }: { url: string }) => {
            await deductCredits(user_id, "browse_url").catch(() => {});
            try {
              let rawContent = "";
              let isYouTube = false;

              // Specialized YouTube Transcript extraction
              if (url.includes("youtube.com") || url.includes("youtu.be")) {
                isYouTube = true;
                try {
                  const transcript = await YoutubeTranscript.fetchTranscript(url);
                  rawContent = transcript.map(t => t.text).join(" ");
                } catch (ytErr) {
                  console.error("[Agent:summarizeURL] YT Transcript failed, preventing browse fallback", ytErr);
                  return { url, summary: "I could not extract captions from this video. It may be a Short without captions, private, or restricted.", keyPoints: [], wordCount: 0 };
                }
              }

              if (!rawContent) {
                rawContent = await browseUrlText(url, 8000);
              }

              if (!rawContent || rawContent.trim().length < 50) {
                return { url, summary: "Could not extract content from this URL or video.", keyPoints: [], wordCount: 0 };
              }
              // Extract key points heuristically (first 6 substantial sentences)
              const sentences = rawContent
                .split(/[.!?]\s+/)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 40 && s.length < 300)
                .slice(0, 6);
              const wordCount = rawContent.split(/\s+/).length;
              // Return full content so the AI model can produce a comprehensive summary
              return {
                url,
                isYouTube,
                rawContent: rawContent.slice(0, 10000),
                keyPoints: sentences,
                wordCount,
                instruction: isYouTube 
                  ? "Based on the VIDEO TRANSCRIPT above, write a detailed summary. Mention specific parts of the video, the speaker's main points, and any key takeaways."
                  : "Based on the rawContent above, write a comprehensive structured summary with: (1) a 2-3 sentence overview, (2) bullet-point key insights, (3) any numbers/data mentioned, (4) your analysis/opinion if relevant.",
              };
            } catch (err: any) {
              return { url, summary: `Failed to fetch URL: ${err.message}`, keyPoints: [], wordCount: 0 };
            }
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

        /* ── RUN CODE (Piston) ── */
        runCode: {
          description:
            "Execute Python or JavaScript in a sandboxed runner (Piston). Use when the user asks to run code, verify output, or compute something programmatically.",
          parameters: z.object({
            language: z.enum(["python", "javascript"]).describe("Programming language"),
            code: z.string().describe("Full source to execute"),
            stdin: z.string().optional().describe("Standard input for the program, if any"),
          }),
          execute: async (args: { language: "python" | "javascript"; code: string; stdin?: string }) => {
            await deductCredits(user_id, "tool_small").catch(() => {});
            if (!isPistonConfigured()) {
              return {
                status: "error" as const,
                run_code: true as const,
                message:
                  "Code execution is not configured.",
              };
            }
            const language_id = PISTON_LANGUAGE_IDS[args.language];
            const r = await runPistonSubmission({
              source_code: args.code,
              language_id,
              stdin: args.stdin,
            });
            if (!r.ok) {
              return {
                status: "error" as const,
                run_code: true as const,
                language: args.language,
                message: r.error || "Code run failed",
              };
            }
            return {
              status: "success" as const,
              run_code: true as const,
              language: args.language,
              stdout: r.stdout ?? "",
              stderr: r.stderr ?? "",
              compile_output: r.compile_output ?? "",
              time: null,
              memory: null,
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

        /* ── GENERATE EXCEL ── */
        generateExcel: {
          description: "Create an Excel (.xlsx) file with data. Use when user asks to create spreadsheet, Excel file, export data to Excel, make a table in Excel, etc. DO NOT CALL THIS TOOL IF YOU ARE ASKING A QUESTION. ONLY CALL WITH FULL DATA.",
          parameters: z.object({
            data: z.array(z.record(z.string(), z.any())).describe("Array of objects - each object is a row. MUST BE FULLY POPULATED with data."),
            sheetName: z.string().optional().describe("Name of the sheet (default: Sheet1)"),
            filename: z.string().optional().describe("Output filename (default: export.xlsx)"),
          }),
          execute: async (args: { data: Record<string, any>[]; sheetName?: string; filename?: string }) => {
            await deductCredits(user_id, "tool_small").catch(() => {});
            try {
              if (!args.data || args.data.length === 0) {
                 return { status: "error", message: "Excel generation aborted: No data provided." };
              }
              const safeData = args.data;
              const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com"}/api/generate/excel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  data: safeData,
                  sheetName: args.sheetName || "Sheet1",
                  filename: args.filename || "export.xlsx",
                  user_id: user_id,  // Pass user_id for authentication
                }),
              });
              const result = await response.json();
              if (result.status !== "success") {
                return { status: "error", message: result.error || "Failed to generate Excel" };
              }
              return {
                status: "success",
                filename: result.filename,
                content: result.content,
                rowCount: result.rowCount,
                message: `Excel file "${result.filename}" created with ${result.rowCount} rows. The file is ready for download.`,
              };
            } catch (err: any) {
              return { status: "error", message: err.message || "Failed to generate Excel" };
            }
          },
        },

        /* ── GENERATE POWERPOINT ── */
        generatePowerPoint: {
          description: "Create a PowerPoint (.pptx) presentation. Use when user asks to create a presentation, slide deck, pitch deck, PowerPoint, etc. DO NOT CALL THIS TOOL IF YOU ARE ASKING A QUESTION. ONLY CALL WITH FULL DATA.",
          parameters: z.object({
            slides: z.array(z.object({
              title: z.string().optional().describe("Slide title"),
              content: z.union([z.array(z.string()), z.string()]).optional().describe("Slide content - either array of bullet points or plain text"),
              notes: z.string().optional().describe("Speaker notes for this slide"),
              backgroundColor: z.string().optional().describe("Optional background color (hex)"),
            })).describe("Array of slides. MUST BE FULLY POPULATED with data."),
            title: z.string().optional().describe("Presentation title"),
            filename: z.string().optional().describe("Output filename (default: presentation.pptx)"),
          }),
          execute: async (args: { slides: any[]; title?: string; filename?: string }) => {
            await deductCredits(user_id, "tool_small").catch(() => {});
            try {
              if (!args.slides || args.slides.length === 0) {
                 return { status: "error", message: "PowerPoint generation aborted: No slides provided." };
              }
              const safeSlides = args.slides;
              const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com"}/api/generate/powerpoint`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  slides: args.slides,
                  title: args.title || "Presentation",
                  filename: args.filename || "presentation.pptx",
                  user_id: user_id,  // Pass user_id for authentication
                }),
              });
              const result = await response.json();
              if (result.status !== "success") {
                return { status: "error", message: result.error || "Failed to generate PowerPoint" };
              }
              return {
                status: "success",
                filename: result.filename,
                title: result.title,
                slideCount: result.slideCount,
                content: result.content,
                message: `PowerPoint "${result.filename}" created with ${result.slideCount} slides. The file is ready for download.`,
              };
            } catch (err: any) {
              return { status: "error", message: err.message || "Failed to generate PowerPoint" };
            }
          },
        },

        /* ── GENERATE PDF ── */
        generatePDF: {
          description: "Create a PDF document. Use when user asks to create PDF, generate invoice, make PDF report, etc. DO NOT CALL THIS TOOL IF YOU ARE ASKING THE USER A CLARIFICATION QUESTION. ONLY CALL IT WHEN YOU HAVE FULL DATA.",
          parameters: z.object({
            content: z.string().describe("The dense text/markdown content to put in the PDF. MUST BE FULLY POPULATED with data. Do not summarize."),
            title: z.string().describe("Document title (appears at top, e.g. 'Top 10 Richest People 2025')"),
            filename: z.string().describe("Output filename (e.g. 'report.pdf')"),
          }),
          execute: async (args: { content: string; title: string; filename: string }) => {
            await deductCredits(user_id, "tool_small").catch(() => {});
            try {
              if (!args.content || args.content.trim().length < 5) {
                return { status: "error", message: "PDF generation aborted: No content provided by the AI." };
              }
              const safeContent = args.content;
              const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com"}/api/generate/pdf`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: safeContent,
                  title: args.title || "Document",
                  filename: args.filename || "document.pdf",
                  user_id: user_id,  // Pass user_id for authentication
                }),
              });
              const result = await response.json();
              if (result.status !== "success") {
                return { status: "error", message: result.error || "Failed to generate PDF" };
              }
              return {
                status: "success",
                filename: result.filename,
                title: result.title,
                content: result.content,
                pageCount: result.pageCount,
                message: `PDF "${result.filename}" created. The file is ready for download.`,
              };
            } catch (err: any) {
              return { status: "error", message: err.message || "Failed to generate PDF" };
            }
          },
        },

        /* ── GENERATE IMAGE ── */
        generateImage: {
          description: "Generate AI images from text prompts. Use when user asks to create an image, generate a picture, make art, create a photo, generate image of something, etc.",
          parameters: z.object({
            prompt: z.string().describe("Extremely detailed visual prompt - e.g., 'a cinematic photorealistic shot of a young European male in his 40s driving a red sports car in Monaco'"),
          }),
          execute: async (args: { prompt: string }) => {
            await deductCredits(user_id, "tool_small").catch(() => {});
            // Directly return the Pollinations URL. This completely bypasses Vercel Serverless Timeouts!
            // The browser will load the image instantly without proxying through our API route.
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}?nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
            return {
              status: "success",
              image: imageUrl, // Pass direct URL
              prompt: args.prompt,
              message: "Image generated successfully.",
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
        // Wire shared enqueue so tools can stream events
        streamEnqueue = enqueue;
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
              "language",
              "code",
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
          if (o.run_code === true) return "runCode";
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
            } else if (toolName === "summarizeURL" && r) {
              const kc = Array.isArray(r.keyPoints) && r.keyPoints.length > 0 
                ? r.keyPoints.map((k: string) => `• ${k}`).join("\n") 
                : "";
              fallbackFromTools = r.summary || `I've analyzed the URL (${r.wordCount || 0} words).\n\nKey Insights:\n${kc}`;
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
            } else if (
              (toolName === "runCode" || (r as any)?.run_code === true) &&
              r &&
              typeof r === "object"
            ) {
              const rr = r as any;
              if (rr.status === "error" && typeof rr.message === "string") {
                fallbackFromTools = rr.message.slice(0, 1200);
              } else {
                const parts = [
                  rr.stdout && `stdout:\n${String(rr.stdout)}`,
                  rr.stderr && `stderr:\n${String(rr.stderr)}`,
                  rr.compile_output && `compile:\n${String(rr.compile_output)}`,
                ].filter(Boolean);
                fallbackFromTools = (parts.length ? parts.join("\n\n") : "(no output)").slice(0, 2000);
              }
            } else if (r?.status === "error" && typeof r?.message === "string") {
              fallbackFromTools = `I hit an issue while running the tool: ${r.message}`;
            } else if (typeof r?.message === "string") {
              fallbackFromTools = r.message;
            }
            // Council synthesis fallback — capture the full synthesis as text
            if (toolName === "multiAgentDebate" && r?.synthesis) {
              fallbackFromTools = r.synthesis;
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
              toolName === "runCode" ||
              inferred === "readGmail" ||
              inferred === "searchWeb" ||
              inferred === "browseURL" ||
              inferred === "getWeather" ||
              inferred === "getStockQuote" ||
              inferred === "getNewsHeadlines" ||
              inferred === "runCode";
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
              } else if (tn === "runCode" || (r as any)?.run_code === true) {
                const rr = r as any;
                let msg: string;
                if (rr.status === "error" && typeof rr.message === "string") {
                  msg = `Code run failed: ${rr.message}`;
                } else {
                  const bits = [
                    `Ran ${rr.language || "code"}:`,
                    rr.stdout != null && String(rr.stdout).trim() && `Output:\n${String(rr.stdout).trim()}`,
                    rr.stderr != null && String(rr.stderr).trim() && `Errors:\n${String(rr.stderr).trim()}`,
                    rr.compile_output != null &&
                      String(rr.compile_output).trim() &&
                      `Compile:\n${String(rr.compile_output).trim()}`,
                  ].filter(Boolean);
                  msg = bits.length > 1 ? bits.join("\n\n") : bits[0] || "Code finished with no output.";
                }
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
