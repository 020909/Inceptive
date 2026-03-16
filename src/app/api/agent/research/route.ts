import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, user_id } = body;

    if (!topic || !user_id) {
      return NextResponse.json({ error: "Missing topic or user_id" }, { status: 400 });
    }

    // First ensure user row exists — create it if missing
    const { data: existingUser } = await admin
      .from("users")
      .select("id, api_key_encrypted, api_provider")
      .eq("id", user_id)
      .single();

    let userData = existingUser;

    if (!userData) {
      // Get user from auth and create their row
      const { data: authUser } = await admin.auth.admin.getUserById(user_id);
      if (!authUser?.user) {
        return NextResponse.json({ error: "Auth user not found" }, { status: 404 });
      }
      const { data: newUser } = await admin
        .from("users")
        .insert({
          id: user_id,
          email: authUser.user.email,
          created_at: new Date().toISOString(),
          api_provider: "openrouter"
        })
        .select()
        .single();
      userData = newUser;
    }

    if (!userData?.api_key_encrypted) {
      return NextResponse.json({
        error: "No API key found. Please go to Settings and add your API key."
      }, { status: 400 });
    }

    const { api_key_encrypted: apiKey, api_provider } = userData;
    console.log(`[ResearchAPI] Using provider: ${api_provider} for user: ${user_id}`);

    const systemPrompt = `You are a professional research analyst working for Inceptive, a 24/7 AI agent platform. Given a research topic, produce a detailed structured research report with these clearly labeled sections:

EXECUTIVE SUMMARY (2-3 sentences)
KEY FINDINGS (exactly 5 bullet points starting with •)
MARKET SIZE AND OPPORTUNITY (specific numbers)
MAIN PLAYERS AND COMPETITION (top 5 with one line each)
KEY TRENDS (3 trends)
RISKS AND CHALLENGES (3 risks)
SOURCES AND REFERENCES (5 sources with URLs)

Be specific, factual, and professional.`;

    let responseText = "";

    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topic }
        ]
      });
      responseText = response.choices[0]?.message?.content || "";

    } else if (api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240622",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: topic }]
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
          "X-Title": "Inceptive"
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: topic }
          ]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "OpenRouter error");
      responseText = data.choices?.[0]?.message?.content || "";

    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(systemPrompt + "\n\nTopic: " + topic);
      responseText = result.response.text();
    }

    if (!responseText) {
      throw new Error("Empty response from AI provider");
    }

    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const urls = responseText.match(urlRegex) || [];

    const { data: savedReport, error: insertError } = await admin
      .from("research_reports")
      .insert({
        user_id,
        topic,
        content: responseText,
        sources_count: urls.length,
        created_at: new Date().toISOString()
      })
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
