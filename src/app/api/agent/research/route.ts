import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120; // Research can take time

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const body = await request.json();
  const { topic, user_id } = body;

  const targetUserId = user_id || authUser?.id;

  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  // Fetch user API key and provider from Supabase using service role for security
  // (Standard client is fine here as we're on the server)
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("api_provider, api_key_encrypted")
    .eq("id", targetUserId)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ error: "Could not fetch user settings" }, { status: 500 });
  }

  const { api_provider, api_key_encrypted } = userData;

  if (!api_key_encrypted) {
    return NextResponse.json(
      { error: "No API key found. Please add your API key in Settings." },
      { status: 400 }
    );
  }

  const systemPrompt = "You are a professional research analyst working for Inceptive, a 24/7 AI agent platform. Given a research topic, produce a detailed structured research report with the following clearly labeled sections: EXECUTIVE SUMMARY (2-3 sentences), KEY FINDINGS (exactly 5 bullet points starting with •), MARKET SIZE AND OPPORTUNITY (specific numbers and percentages), MAIN PLAYERS AND COMPETITION (list top 5 with one line each), KEY TRENDS (3 trends shaping the space), RISKS AND CHALLENGES (3 main risks), SOURCES AND REFERENCES (list 5 credible sources with URLs). Be specific, factual, data-driven, and professional.";

  let content = "";

  try {
    if (api_provider === "gemini") {
      const genAI = new GoogleGenerativeAI(api_key_encrypted);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt
      });
      const result = await model.generateContent(topic);
      content = result.response.text();
    } else if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey: api_key_encrypted });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topic },
        ],
      });
      content = response.choices[0]?.message?.content || "";
    } else if (api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey: api_key_encrypted });
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620", // Matches requirement for sonnet
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: topic }],
      });
      // Handle the content parts safely
      content = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n');
    } else {
      return NextResponse.json({ error: "Invalid API provider selected" }, { status: 400 });
    }

    // Count URLs in the response
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const urls = content.match(urlRegex) || [];
    const sources_count = urls.length;

    // Save report to Supabase
    const { data: report, error: insertError } = await supabase
      .from("research_reports")
      .insert({
        user_id: targetUserId,
        topic,
        content,
        sources_count,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert Error:", insertError);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        topic: report.topic,
        content: report.content,
        sources_count: report.sources_count,
        created_at: report.created_at
      }
    });
  } catch (err: any) {
    console.error("Research API Error:", err);
    return NextResponse.json(
      { error: err.message || "An error occurred during research" },
      { status: 500 }
    );
  }
}
