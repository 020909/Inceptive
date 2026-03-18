import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120;

const getAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const admin = getAdmin();

/* Depth-aware prompt configuration */
function buildPrompt(topic: string, depth: string) {
  if (depth === "Fast") {
    return {
      system: `You are a professional research analyst. Given a topic, produce a concise research brief with these sections:

EXECUTIVE SUMMARY (2 sentences)
KEY FINDINGS (3 bullet points starting with •)
MAIN PLAYERS (top 3 companies/entities, one line each)
SOURCES (3 URLs)

Be direct and factual. No padding.`,
      maxTokens: 800,
    };
  }

  if (depth === "Ultra") {
    return {
      system: `You are a senior research analyst at a top-tier strategy firm. Given a topic, produce the most comprehensive research report possible with these sections:

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

Be exhaustive, data-driven, and professional.`,
      maxTokens: 4000,
    };
  }

  // Default: Deep Research
  return {
    system: `You are a professional research analyst working for Inceptive, a 24/7 AI agent platform. Given a research topic, produce a detailed structured research report with these clearly labeled sections:

EXECUTIVE SUMMARY (2-3 sentences)
KEY FINDINGS (exactly 5 bullet points starting with •)
MARKET SIZE AND OPPORTUNITY (specific numbers)
MAIN PLAYERS AND COMPETITION (top 5 with one line each)
KEY TRENDS (3 trends)
RISKS AND CHALLENGES (3 risks)
SOURCES AND REFERENCES (5 sources with URLs)

Be specific, factual, and professional.`,
    maxTokens: 2000,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, user_id, depth = "Deep Research" } = body;

    if (!topic || !user_id) {
      return NextResponse.json({ error: "Missing topic or user_id" }, { status: 400 });
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

    if (!userData?.api_key_encrypted) {
      return NextResponse.json({ error: "No API key found. Please go to Settings and add your API key." }, { status: 400 });
    }

    const { api_key_encrypted: apiKey, api_provider, api_model } = userData;
    const { system: systemPrompt, maxTokens } = buildPrompt(topic, depth);

    console.log(`[Research] provider=${api_provider} model=${api_model} depth=${depth}`);

    let responseText = "";

    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: api_model || "gpt-4o",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Research topic: ${topic}` },
        ],
      });
      responseText = response.choices[0]?.message?.content || "";

    } else if (api_provider === "anthropic" || api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: api_model || "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: `Research topic: ${topic}` }],
      });
      const block = response.content[0];
      if (block.type === "text") responseText = block.text;

    } else if (api_provider === "openrouter") {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://app.inceptive-ai.com",
          "X-Title": "Inceptive",
        },
        body: JSON.stringify({
          model: api_model || "google/gemini-2.0-flash-001",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Research topic: ${topic}` },
          ],
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(`OpenRouter: ${data.error.message}`);
      responseText = data.choices?.[0]?.message?.content || "";

    } else {
      // google (default)
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: api_model || "gemini-2.0-flash" });
      const result = await model.generateContent(`${systemPrompt}\n\nResearch topic: ${topic}`);
      responseText = result.response.text();
    }

    if (!responseText) throw new Error("Empty response from AI provider");

    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const urls = responseText.match(urlRegex) || [];

    const { data: savedReport, error: insertError } = await admin
      .from("research_reports")
      .insert({ user_id, topic, content: responseText, sources_count: urls.length, created_at: new Date().toISOString() })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: savedReport });

  } catch (err: any) {
    console.error("Research API Error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate report" }, { status: 500 });
  }
}
