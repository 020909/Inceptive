import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const verifiedUserId = user.id;

    // Query user settings
    const { data: userData, error: userError } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider")
      .eq("id", verifiedUserId)
      .single();

    if (userError || !userData?.api_key_encrypted) {
      return NextResponse.json(
        { error: "No API key found. Please add your API key in Settings." },
        { status: 400 }
      );
    }

    const { api_key_encrypted: apiKey, api_provider } = userData;
    const systemPrompt = `Write an engaging social media post for ${platform} about ${topic}. Keep it under 280 characters for X, under 700 for LinkedIn. Be authentic and engaging. Return only the post text, nothing else.`;

    let responseText = "";

    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: systemPrompt }],
      });
      responseText = response.choices[0]?.message?.content || "";
    } else if (api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1000,
        messages: [{ role: "user", content: systemPrompt }],
      });
      const contentBlock = response.content[0];
      if (contentBlock.type === 'text') {
        responseText = contentBlock.text;
      }
    } else {
      // Default to gemini or explicit gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(systemPrompt);
      responseText = result.response.text();
    }

    const postContent = responseText.replace(/^["']|["']$/g, '').trim();

    // The user prompt said: "Save to social_posts table. Return post."
    // We should schedule it default to somewhat recent or allow user to set scheduled time.
    // The prompt says POST generates and we save. But wait, in part 5: "If Generate with AI is checked... generate the post content using the AI API before saving".
    // Actually wait, looking closely at Part 5: "Top right 'Create Post' button opens modal... Schedule time picker, Generate with AI checkbox... If Generate with AI is checked show a Topic input and generate the post content using the AI API before saving". So the front-end might generate via API then save? Or the api saves it directly?
    // "Social post generation API at src/app/api/agent/social/route.ts: verify Bearer token, get user API key, call AI with prompt... Save to social_posts table. Return post."
    
    const { data: savedPost, error: insertError } = await admin
      .from("social_posts")
      .insert({
        user_id: verifiedUserId,
        platform,
        content: postContent,
        status: "draft",
        scheduled_for: new Date(Date.now() + 86400000).toISOString(), // next day as placeholder
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert Error:", insertError);
      return NextResponse.json({ error: "Failed to save the social post." }, { status: 500 });
    }

    return NextResponse.json({ success: true, post: savedPost });
  } catch (err: any) {
    console.error("Social API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate social post" },
      { status: 500 }
    );
  }
}
