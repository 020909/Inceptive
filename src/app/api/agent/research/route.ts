import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { checkRateLimit, getClientIP, rateLimitResponse } from "@/lib/rate-limit";
import { browseUrlText, extractUrls, formatSearchResultsForPrompt, searchWeb } from "@/lib/search/provider";
import { gatherResearchEnrichment } from "@/lib/research/enrichment";
import {
  ensureRetrievalUrlsListed,
  normalizeReportFormatting,
  stripInlineNumericCitations,
} from "@/lib/research/report-format";

export const maxDuration = 120;

/** Model must answer even when automated retrieval is thin (fixes “sources contain nothing” refusals). */
const ANSWER_POLICY = `

Answer policy (mandatory)
- If SOURCES (web retrieval) or ENRICHMENT blocks are empty, incomplete, or missing specific facts, you MUST still answer using well-established general knowledge.
- Put uncited factual claims under a heading: GENERAL KNOWLEDGE (not from retrieved URLs).
- Never refuse the entire question only because automated retrieval returned little or no text.
- For rankings, box office, or “top N” lists: give the best-known answer; cite provided URLs where you can; note uncertainty or conflicting sources when needed.`;

function withAnswerPolicy(system: string) {
  return `${system}${ANSWER_POLICY}`;
}

const getAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const admin = getAdmin();

async function fetchWikipediaSummary(topic: string): Promise<{ url: string; content: string } | null> {
  try {
    const title = encodeURIComponent(topic.trim().replace(/\s+/g, " "));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "InceptiveAI/1.0 (research)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const extract = (data?.extract as string) || "";
    const pageUrl = (data?.content_urls?.desktop?.page as string) || `https://en.wikipedia.org/wiki/${title}`;
    if (!extract) return null;
    return { url: pageUrl, content: extract.slice(0, 2000) };
  } catch {
    return null;
  }
}

async function fetchArxiv(topic: string): Promise<{ url: string; content: string } | null> {
  try {
    const q = encodeURIComponent(topic.trim());
    const url = `https://export.arxiv.org/api/query?search_query=all:${q}&start=0&max_results=3`;
    const res = await fetch(url, { headers: { "User-Agent": "InceptiveAI/1.0 (research)" }, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const xml = await res.text();
    // lightweight parse: pull titles + summaries from first few entries
    const entries = xml.split("<entry>").slice(1, 4);
    if (entries.length === 0) return null;
    const lines: string[] = [];
    for (const e of entries) {
      const title = (e.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/\s+/g, " ").trim();
      const summary = (e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "").replace(/\s+/g, " ").trim();
      const link = e.match(/<id>(.*?)<\/id>/)?.[1]?.trim() || "";
      if (title) lines.push(`- ${title}${link ? ` (${link})` : ""}`);
      if (summary) lines.push(`  ${summary.slice(0, 500)}${summary.length > 500 ? "…" : ""}`);
    }
    return { url, content: lines.join("\n").slice(0, 2500) };
  } catch {
    return null;
  }
}

/* Depth-aware prompt configuration */
function isEntertainmentQuery(topic: string): boolean {
  return /(cast|box office|movie|film|actor|actress|director|release date|collection|trailer|bollywood|hollywood)/i.test(topic);
}

const REPORT_FORMAT = `

FORMATTING (mandatory — professional report, no markdown hashes):
- Do NOT use #, ##, or ###. Never start a line with #.
- Number every major section: "1. Executive Summary", "2. Key Findings", etc. Put the number and title on its own line.
- Section titles use the same font size as body text in the UI but are shown bold — write them as plain numbered lines only.
- Use • for bullet points. You may use **short labels** for emphasis inside bullets.
- Do NOT use inline citation markers like [1], [2], or [N] after sentences. No bracketed reference numbers in the body.
- Always end with a final section titled "Sources" or "Sources and references" and list every URL you relied on from the SOURCES (web retrieval) block below (bullet each URL). Nothing should be only cited by a number in brackets.`;

function buildPrompt(topic: string, depth: string) {
  const entertainment = isEntertainmentQuery(topic);
  if (entertainment) {
    return {
      system: withAnswerPolicy(`You are a factual entertainment research analyst.${REPORT_FORMAT}

For movie/actor/cast queries, provide:
DIRECT ANSWER (1-2 lines)
CAST / KEY PEOPLE (bullet list)
VERIFIED FACTS (numbers, dates, figures only if present in sources)
SOURCES (URL list)

Rules:
- If exact data is unavailable, say "Not publicly verified yet" (do not invent).
- Never replace the answer with generic market analysis unless the user asked for that.
- Keep it precise and user-intent focused.`),
      maxTokens: depth === "Ultra" ? 2500 : 1500,
    };
  }
  if (depth === "Fast") {
    return {
      system: withAnswerPolicy(`You are a professional research analyst. Given a topic, produce a concise research brief with these sections:${REPORT_FORMAT}

EXECUTIVE SUMMARY (2 sentences)
KEY FINDINGS (3 bullet points starting with •)
MAIN PLAYERS (top 3 companies/entities, one line each)
SOURCES (3 URLs)

Be direct and factual. No padding.`),
      maxTokens: 800,
    };
  }

  if (depth === "Ultra") {
    return {
      system: withAnswerPolicy(`You are a senior research analyst at a top-tier strategy firm. Given a topic, produce the most comprehensive research report possible with these sections:${REPORT_FORMAT}

EXECUTIVE SUMMARY (3-4 sentences)
KEY FINDINGS (7 bullet points starting with •)
MARKET SIZE AND OPPORTUNITY (specific numbers, growth rates, TAM/SAM/SOM)
MAIN PLAYERS AND COMPETITION (top 8 with strengths/weaknesses)
KEY TRENDS (5 trends with supporting data)
TECHNOLOGY LANDSCAPE (key tech, tools, platforms)
RISKS AND CHALLENGES (5 risks with mitigation strategies)
STRATEGIC RECOMMENDATIONS (5 actionable recommendations)
FUTURE OUTLOOK (3-5 year projections)
SOURCES AND REFERENCES (8+ sources with URLs)

Be exhaustive, data-driven, and professional.`),
      maxTokens: 4000,
    };
  }

  // Default: Deep
  return {
    system: withAnswerPolicy(`You are a professional research analyst working for Inceptive, a 24/7 AI agent platform. Given a research topic, produce a detailed structured research report with these clearly labeled sections:${REPORT_FORMAT}

EXECUTIVE SUMMARY (2-3 sentences)
KEY FINDINGS (exactly 5 bullet points starting with •)
MARKET SIZE AND OPPORTUNITY (specific numbers)
MAIN PLAYERS AND COMPETITION (top 5 with one line each)
KEY TRENDS (3 trends)
RISKS AND CHALLENGES (3 risks)
SOURCES AND REFERENCES (5 sources with URLs)

Be specific, factual, and professional.`),
    maxTokens: 2000,
  };
}

export async function POST(request: Request) {
  let contextUserId: string | null = null;
  let contextTopic = "";
  let contextDepth = "Deep";
  try {
    const ip = getClientIP(request);
    const limit = await checkRateLimit({
      identifier: ip,
      route: "/api/research",
      maxRequests: 20,
      windowMinutes: 60,
    });
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);

    const requestId = crypto.randomUUID();
    const user_id = await getAuthenticatedUserIdFromRequest(request);
    contextUserId = user_id;
    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { topic, depth = "Deep" } = body;
    contextTopic = String(topic || "");
    contextDepth = String(depth || "Deep");
    const normalizedDepth = depth === "Deep Research" ? "Deep" : depth;
    const action =
      normalizedDepth === "Fast"
        ? "research_fast"
        : normalizedDepth === "Ultra"
          ? "research_ultra"
          : "research_deep";
    const creditCheck = await checkCredits(user_id, action);
    if (!creditCheck.allowed && !creditCheck.unlimited) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 402 });
    }


    if (!topic) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    }

    // Ensure user row exists
    const { data: existingUser } = await admin
      .from("users")
      .select("id, api_key_encrypted, api_provider, api_model")
      .eq("id", user_id)
      .single();

    let userData = existingUser;

    if (!userData) {
      const { data: authUser } = await admin.auth.admin.getUserById(user_id);
      if (!authUser?.user) {
        return NextResponse.json({ error: "Auth user not found" }, { status: 404 });
      }
      const { data: newUser } = await admin
        .from("users")
        .insert({ id: user_id, email: authUser.user.email, created_at: new Date().toISOString(), api_provider: "openrouter" })
        .select()
        .single();
      userData = newUser;
    }

    let apiKey = userData?.api_key_encrypted;
    let api_provider = userData?.api_provider || "openrouter";
    let api_model = userData?.api_model;

    if (!apiKey) {
      const groq = process.env.GROQ_API_KEY?.trim();
      if (groq) {
        apiKey = groq;
        api_provider = "groq";
        api_model = process.env.GROQ_RESEARCH_MODEL?.trim() || "llama-3.3-70b-versatile";
      } else {
        apiKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";
        api_provider = "openrouter";
        api_model = "google/gemini-2.0-flash-001";
        if (!apiKey) {
          return NextResponse.json({ error: "AI not configured." }, { status: 400 });
        }
      }
    }
    const { system: systemPrompt, maxTokens } = buildPrompt(topic, normalizedDepth);

    console.log(`[Research] provider=${api_provider} model=${api_model} depth=${normalizedDepth}`);

    // ── Retrieval step (web-backed) ───────────────────────────────────────
    // Uses unified provider: SearXNG (if configured) with DuckDuckGo fallback.
    let sourcesBlock = "";
    /** URLs we actually fetched text from — used to guarantee a Sources list */
    let retrievalUrls: string[] = [];
    let sourcesCount = 0;
    let providerUsed: "tavily" | "brave" | "searxng" | "duckduckgo" = "duckduckgo";
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      null;
    try {
      const queries = Array.from(
        new Set([
          topic,
          `${topic} cast`,
          `${topic} box office collection`,
          `${topic} movie box office`,
          `${topic} wikipedia`,
          `${topic} release date`,
        ])
      );

      const searchTexts: string[] = [];
      for (const q of queries.slice(0, 4)) {
        try {
          const results = await searchWeb(q, 8);
          providerUsed = results.provider;
          searchTexts.push(formatSearchResultsForPrompt(q, results));
        } catch {
          // ignore a single query failure
        }
      }

      const urls = Array.from(
        new Set(searchTexts.flatMap((t) => extractUrls(t)))
      ).slice(0, normalizedDepth === "Ultra" ? 6 : 4);

      const browsed: { url: string; content: string }[] = [];
      const wiki = await fetchWikipediaSummary(topic);
      if (wiki) browsed.push(wiki);
      const arxiv = await fetchArxiv(topic);
      if (arxiv) browsed.push(arxiv);

      const pageReads = await Promise.allSettled(
        urls.map(async (url) => {
          const content = await browseUrlText(url, 5500);
          if (content && !content.startsWith("Could not fetch")) {
            return { url, content: content.slice(0, 5500) };
          }
          throw new Error("skip");
        })
      );
      for (const r of pageReads) {
        if (r.status === "fulfilled") browsed.push(r.value);
      }

      sourcesCount = browsed.length;
      retrievalUrls = browsed.map((b) => b.url);
      if (browsed.length > 0) {
        sourcesBlock =
          `\n\nSOURCES (web retrieval)\n` +
          browsed
            .map((s, i) => `SOURCE ${i + 1}: ${s.url}\n${s.content}`)
            .join("\n\n---\n\n");
      }
    } catch {
      // If retrieval fails entirely, we still produce a report (but require the model to be explicit).
      sourcesBlock = "";
      retrievalUrls = [];
      sourcesCount = 0;
    }

    let enrichmentBlock = "";
    try {
      const { text, meta } = await gatherResearchEnrichment(topic, { clientIp });
      if (text.trim()) {
        enrichmentBlock = `\n\nENRICHMENT (public APIs: ${meta.sources.join(", ")})\n${text}`;
        sourcesCount += Math.min(meta.sources.length, 12);
      }
    } catch {
      // enrichment is optional
    }

    const retrievalRules = `\n\nIMPORTANT:\n- Use SOURCES (web retrieval) and ENRICHMENT when they help.\n- Do not put [1], [2], or [N] markers in the report body; put URLs only in the final Sources section.\n- If a specific fact is missing from retrieved text, you may still answer from general knowledge under a section titled "GENERAL KNOWLEDGE" (not from retrieved URLs).\n- Do NOT claim something is fictional just because it is unfamiliar.\n`;

    let responseText = "";

    const userContent = `Research topic: ${topic}${retrievalRules}${sourcesBlock}${enrichmentBlock}`;

    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: api_model || "gpt-4o",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });
      responseText = response.choices[0]?.message?.content || "";

    } else if (api_provider === "anthropic" || api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: api_model || "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      });
      const block = response.content[0];
      if (block.type === "text") responseText = block.text;

    } else if (api_provider === "openrouter" || api_provider === "groq") {
      const isGroq = api_provider === "groq";
      const endpoint = isGroq
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      if (!isGroq) {
        headers["HTTP-Referer"] = "https://app.inceptive-ai.com";
        headers["X-Title"] = "Inceptive";
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model:
            api_model ||
            (isGroq ? "llama-3.3-70b-versatile" : "google/gemini-2.0-flash-001"),
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(isGroq ? `Groq: ${data.error.message}` : `OpenRouter: ${data.error.message}`);
      responseText = data.choices?.[0]?.message?.content || "";

    } else {
      // google (default)
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: api_model || "gemini-2.0-flash" });
      const result = await model.generateContent(`${systemPrompt}\n\n${userContent}`);
      responseText = result.response.text();
    }

    if (!responseText) throw new Error("Empty response from AI provider");
    await deductCredits(user_id, action).catch(() => {});

    const startedAt = new Date().toISOString();

    const finalReportText = sanitizeReport(responseText, retrievalUrls);
    const urls = extractUrls(finalReportText);

    const { data: savedReport, error: insertError } = await admin
      .from("research_reports")
      .insert({
        user_id,
        topic,
        content: finalReportText,
        sources_count: Math.max(sourcesCount, urls.length),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }

    const { data: sessionRow, error: sessionInsertError } = await admin
      .from("research_sessions")
      .insert({
        user_id,
        topic,
        depth: normalizedDepth,
        provider_used: providerUsed,
        status: "completed",
        sources_json: { urls, sources_count: Math.max(sourcesCount, urls.length) },
        report_text: finalReportText,
        report_id: savedReport.id,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (sessionInsertError) {
      console.warn(`[research][${requestId}] failed to persist research_session`, sessionInsertError.message);
    }

    return NextResponse.json({ success: true, report: savedReport, session_id: sessionRow?.id || null });

  } catch (err: any) {
    if (contextUserId && contextTopic) {
      const { error: sessionErr } = await admin.from("research_sessions").insert({
        user_id: contextUserId,
        topic: contextTopic.slice(0, 300),
        depth: contextDepth,
        status: "failed",
        error_message: String(err?.message || "Research failed"),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
      if (sessionErr) {
        console.warn("[research] failed to persist failed session", sessionErr.message);
      }
    }
    console.error("Research API Error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate report" }, { status: 500 });
  }
}

function sanitizeReport(content: string, retrievalUrls: string[] = []) {
  let out = normalizeReportFormatting(content);
  out = stripInlineNumericCitations(out);
  out = out
    .replace(/^\*\s+/gm, "• ")
    .replace(/^-\s+/gm, "• ")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (retrievalUrls.length > 0) {
    out = ensureRetrievalUrlsListed(out, retrievalUrls);
  }
  return out.trim();
}

export async function GET(request: Request) {
  try {
    const user_id = await getAuthenticatedUserIdFromRequest(request);
    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [reportsRes, sessionsRes] = await Promise.all([
      admin
        .from("research_reports")
        .select("id, topic, content, sources_count, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("research_sessions")
        .select("id, status, provider_used, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (reportsRes.error) {
      return NextResponse.json({ error: reportsRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      reports: reportsRes.data || [],
      sessions: sessionsRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
