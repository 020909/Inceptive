import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120; // Allow 2 minutes for research

export async function POST(request: Request) {
  const body = await request.json()
  const { topic, user_id } = body

  if (!topic || !user_id) {
    return NextResponse.json({ error: 'Missing topic or user_id' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: userData, error: userError } = await admin
    .from('users')
    .select('api_key_encrypted, api_provider')
    .eq('id', user_id)
    .single()

  if (userError || !userData || !userData.api_key_encrypted) {
    return NextResponse.json({ error: 'No API key found. Please add your API key in Settings.' }, { status: 400 })
  }

  const verifiedUserId = user_id; // For consistency with lower code

  const { api_key_encrypted: apiKey, api_provider } = userData;
  const systemPrompt = "You are a professional research analyst working for Inceptive, a 24/7 AI agent platform. Given a research topic, produce a detailed structured research report with these clearly labeled sections: EXECUTIVE SUMMARY (2-3 sentences), KEY FINDINGS (exactly 5 bullet points starting with •), MARKET SIZE AND OPPORTUNITY (specific numbers), MAIN PLAYERS AND COMPETITION (top 5 with one line each), KEY TRENDS (3 trends), RISKS AND CHALLENGES (3 risks), SOURCES AND REFERENCES (5 sources with URLs). Be specific, factual, and professional.";

  let responseText = "";

  try {
    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topic },
        ],
      });
      responseText = response.choices[0]?.message?.content || "";
    } else if (api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: topic }],
      });
      const contentBlock = response.content[0];
      if (contentBlock.type === 'text') {
        responseText = contentBlock.text;
      }
    } else {
      // Default to gemini or explicit gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(systemPrompt + "\n\nTopic: " + topic);
      responseText = result.response.text();
    }

    // Count URLs in the response for sources_count
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const urls = responseText.match(urlRegex) || [];
    const sources_count = urls.length;

    // Save to research_reports table
    const { data: savedReport, error: insertError } = await admin
      .from("research_reports")
      .insert({
        user_id: verifiedUserId,
        topic,
        content: responseText,
        sources_count,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert Error:", insertError);
      return NextResponse.json({ error: "Failed to save the report." }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: savedReport });
  } catch (err: any) {
    console.error("Research API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate research report" },
      { status: 500 }
    );
  }
}
