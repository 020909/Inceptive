import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, recipient, tone } = body;

    if (!topic || !recipient || !tone) {
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

        const resolvedKey = userData?.api_key_encrypted
      || process.env.OPENROUTER_KEY
      || process.env.OPENROUTER_DEFAULT_KEY
      || '';
    if (!resolvedKey) {
      return NextResponse.json({ error: 'AI not configured. Contact support.' }, { status: 400 });
    }
    const apiKey = resolvedKey;
    const api_provider = userData?.api_key_encrypted ? (userData?.api_provider || 'openrouter') : 'openrouter';
    const api_model = userData?.api_key_encrypted ? (userData?.api_model || null) : 'google/gemini-2.0-flash-001';

    const systemPrompt = `You are a professional email writer. Write a concise, effective email based on the topic and tone provided. Return ONLY a JSON object with exactly two fields: "subject" (string) and "body" (string). No markdown, no extra text.`;
    const userMessage = `Topic: ${topic}\nRecipient: ${recipient}\nTone: ${tone}`;

    console.log(`[Email] provider=${api_provider} model=${api_model}`);

    let responseText = "";

    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: api_model || "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });
      responseText = response.choices[0]?.message?.content || "";

    } else if (api_provider === "anthropic" || api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: api_model || "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage + "\n\nRespond with JSON only." }],
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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage + "\n\nRespond with JSON only." },
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
      const result = await model.generateContent(`${systemPrompt}\n\n${userMessage}\n\nRespond with JSON only.`);
      responseText = result.response.text();
    }

    // Parse JSON — strip markdown fences if present
    const cleaned = responseText.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    let parsedEmail: { subject: string; body: string };
    try {
      parsedEmail = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI email JSON:", cleaned);
      return NextResponse.json({ error: "AI returned invalid format. Please try again." }, { status: 500 });
    }

    if (!parsedEmail.subject || !parsedEmail.body) {
      return NextResponse.json({ error: "AI returned incomplete email data." }, { status: 500 });
    }

    const { data: savedEmail, error: insertError } = await admin
      .from("emails")
      .insert({
        user_id: user.id,
        recipient,
        subject: parsedEmail.subject,
        body: parsedEmail.body,
        status: "draft",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Email insert error:", insertError);
      return NextResponse.json({ error: "Failed to save the email." }, { status: 500 });
    }

    return NextResponse.json({ success: true, email: savedEmail });

  } catch (err: any) {
    console.error("Email API Error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate email" }, { status: 500 });
  }
}
