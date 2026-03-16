import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120; // Allow 2 minutes for creation

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
    const systemPrompt = "You are a professional email writer. Write a concise, effective email based on the topic and tone provided. Format the response as JSON with fields: subject (string) and body (string). Do not include any other text.";
    const userMessage = `Topic: ${topic}\nRecipient: ${recipient}\nTone: ${tone}`;

    let responseText = "";

    if (api_provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });
      responseText = response.choices[0]?.message?.content || "";
    } else if (api_provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage + "\n\nProvide response in JSON only." }],
      });
      const contentBlock = response.content[0];
      if (contentBlock.type === 'text') {
        responseText = contentBlock.text;
      }
    } else {
      // Default to gemini or explicit gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(systemPrompt + "\n\n" + userMessage + "\n\nProvide response in JSON only.");
      responseText = result.response.text();
    }

    // Parse JSON
    // Sometimes models wrap JSON in markdown blocks
    const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    let parsedEmail;
    try {
      parsedEmail = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", cleanedText);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    if (!parsedEmail.subject || !parsedEmail.body) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 500 });
    }

    // Save to emails table
    const { data: savedEmail, error: insertError } = await admin
      .from("emails")
      .insert({
        user_id: verifiedUserId,
        recipient,
        subject: parsedEmail.subject,
        body: parsedEmail.body,
        status: "draft",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert Error:", insertError);
      return NextResponse.json({ error: "Failed to save the email." }, { status: 500 });
    }

    return NextResponse.json({ success: true, email: savedEmail });
  } catch (err: any) {
    console.error("Email API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate email" },
      { status: 500 }
    );
  }
}
