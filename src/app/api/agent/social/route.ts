import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  X: "Write an engaging tweet. Max 280 characters. No hashtag spam — 1-2 relevant hashtags max. Hook in the first line.",
  LinkedIn: "Write a professional LinkedIn post. 150-300 words. Use line breaks for readability. End with a question or call to action.",
  Instagram: "Write an engaging Instagram caption. Use emojis naturally. Include 5-8 relevant hashtags at the end.",
  Facebook: "Write a friendly, conversational Facebook post. 100-200 words. Encourage engagement.",
  TikTok: "Write a TikTok video hook/caption. Max 150 characters. Trendy and energetic.",
  YouTube: "Write a compelling YouTube video description. Include a hook (first 2 lines) and a call to subscribe.",
  WhatsApp: "Write a concise, personal-sounding status update. Max 150 characters.",
  Telegram: "Write an informative Telegram channel post. Can be detailed, use formatting.",
  Snapchat: "Write a fun, casual Snapchat caption. Very short, punchy, use emojis.",
  default: "Write an engaging social media post about the topic. Be authentic and compelling.",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, topic } = body;

    if (!platform || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider, api_model")
      .eq("id", user.id)
      .single();

    if (!userData?.api_key_encrypted) {
      return NextResponse.json({ error: "No API key found. Please add your API key in Settings." }, { status: 400 });
    }

    const { api_key_encrypted: apiKey, api_provider, api_model } = userData;
    const platformGuidance = PLATFORM_INSTRUCTIONS[platform] || PLATFORM_INSTRUCTIONS.default;
    const prompt = `${platformGuidance}\n\nTopic: ${topic}\n\nReturn only the post content — no labels, no explanation, no surrounding quotes.`;

    console.log(`[Social] platform=${platform} provider=${api_provider} model=${api_model}`);

    let responseText = "";

    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: api_model || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      });
      responseText = response.choices[0]?.message?.content || "";

    } else if (api_provider === "anthropic" || api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: api_model || "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
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
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(`OpenRouter: ${data.error.message}`);
      responseText = data.choices?.[0]?.message?.content || "";

    } else {
      // google (default)
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: api_model || "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    }

    const postContent = responseText.replace(/^["']|["']$/g, "").trim();
    if (!postContent) throw new Error("AI returned empty content");

    const { data: savedPost, error: insertError } = await admin
      .from("social_posts")
      .insert({
        user_id: user.id,
        platform,
        content: postContent,
        status: "draft",
        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Social insert error:", insertError);
      return NextResponse.json({ error: "Failed to save the social post." }, { status: 500 });
    }

    return NextResponse.json({ success: true, post: savedPost });

  } catch (err: any) {
    console.error("Social API Error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate social post" }, { status: 500 });
  }
}
