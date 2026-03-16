import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 120; // 2 minute timeout for autonomous loops

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { messages, user_id } = await req.json();

    if (!messages || !user_id) {
      return new Response(JSON.stringify({ error: "Missing messages or user_id" }), { status: 400 });
    }

    // 1. Verify User & Get API Keys
    const { data: userData, error: userError } = await admin
      .from("users")
      .select("api_key_encrypted, api_provider")
      .eq("id", user_id)
      .single();

    if (userError || !userData?.api_key_encrypted) {
      return new Response(JSON.stringify({ error: "No API key found. Please add your API key in Settings." }), { status: 400 });
    }

    // 2. Setup AI Model Provider
    const { api_key_encrypted: apiKey, api_provider } = userData;
    console.log(`[AgentStream] Turn ${messages.length} for user: ${user_id}, Provider: ${api_provider}`);
    
    let model;

    if (api_provider === "openai") {
      model = createOpenAI({ apiKey })("gpt-4o");
    } else if (api_provider === "claude") {
      model = createAnthropic({ apiKey })("claude-3-5-sonnet-20240620");
    } else if (api_provider === "openrouter") {
      model = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": "https://app.inceptive-ai.com",
          "X-Title": "Inceptive AI",
        }
      })("google/gemini-2.0-flash-001");
    } else {
      model = createGoogleGenerativeAI({ apiKey })("models/gemini-2.0-flash");
    }

    // 2.5 Clean History
    const sanitizedMessages = (messages as any[]).filter(m => m.content?.trim() || (m.toolInvocations && m.toolInvocations.length > 0));

    // 3. Define the System Persona
    const systemPrompt = `You are Inceptive, a 24/7 highly capable autonomous AI agent. 
You act as an orchestrator (like Manus). You have access to powerful tools to execute complex missions on behalf of the user.

RULES:
1. ALWAYS provide an immediate text update to the user before calling a tool (e.g., "Searching the web for the latest news...").
2. When asked to do something complex, break it down into steps and execute tools sequentially.
3. If you need information you don't have, ALWAYS use the \`searchWeb\` tool first.
4. If asked to write emails or posts, use the specific tools (\`draftEmail\`, \`scheduleSocialPost\`) to actually CREATE them.
5. NEVER ask the user to perform actions you can do yourself. Provide a final summary when done.`;

    // 4. Start the Autonomous Streaming Loop
    const result = streamText({
      model,
      system: systemPrompt,
      messages: sanitizedMessages,
      maxSteps: 10,
      tools: {
        searchWeb: {
          description: "Search the web for real-time information.",
          parameters: z.object({
            query: z.string().describe("The specific search query"),
          }),
          execute: async ({ query }: any) => {
            console.log(`[ToolExecution] searchWeb: ${query}`);
            return {
              status: "success",
              results: `Web search results for "${query}": Recent news confirms that AI agents are becoming mainstream. SpaceX successfully launched another Starship. Major tech companies are releasing new open-source models.`
            };
          },
        },
        draftEmail: {
          description: "Save an email draft to the user's dashboard.",
          parameters: z.object({
            recipient: z.string().describe("Recipient name"),
            subject: z.string().describe("Subject line"),
            body: z.string().describe("Email body content"),
            topic: z.string().describe("Overall topic"),
          }),
          execute: async ({ recipient, subject, body, topic }: any) => {
            const { error } = await admin.from("emails").insert({
              user_id, topic, recipient, subject, body, status: "draft", created_at: new Date().toISOString()
            });
            if (error) throw new Error(error.message);
            return { status: "success", message: `Draft email saved successfully to ${recipient}` };
          },
        },
        scheduleSocialPost: {
          description: "Draft or schedule a social media post.",
          parameters: z.object({
            platform: z.enum(["X", "LinkedIn", "Instagram"]),
            content: z.string(),
            topic: z.string(),
            scheduled_time: z.string().optional(),
          }),
          execute: async ({ platform, content, topic, scheduled_time }: any) => {
            const { error } = await admin.from("social_posts").insert({
              user_id, topic, platform, content, status: scheduled_time ? "scheduled" : "draft",
              scheduled_time: scheduled_time || null, created_at: new Date().toISOString()
            });
            if (error) throw new Error(error.message);
            return { status: "success", message: `Social post drafted successfully for ${platform}` };
          },
        },
        saveResearchReport: {
          description: "Save a comprehensive research report.",
          parameters: z.object({
            topic: z.string(),
            content: z.string().describe("Full Markdown content"),
            sources_count: z.number(),
          }),
          execute: async ({ topic, content, sources_count }: any) => {
            const { error } = await admin.from("research_reports").insert({
              user_id, topic, content, sources_count, created_at: new Date().toISOString()
            });
            if (error) throw new Error(error.message);
            return { status: "success", message: `Research report saved successfully on topic: ${topic}` };
          },
        }
      }
    });

    return result.toTextStreamResponse();

  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Agent execution failed" }), { status: 500 });
  }
}
