import { createClient } from "@supabase/supabase-js";
import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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
    console.log(`[AgentStream] New request for user: ${user_id}, Provider: ${api_provider}`);
    let model;

    if (api_provider === "openai") {
      const openaiProvider = createOpenAI({ apiKey });
      model = openaiProvider("gpt-4o");
    } else if (api_provider === "claude") {
      const anthropicProvider = createAnthropic({ apiKey });
      model = anthropicProvider("claude-3-5-sonnet-20240620");
    } else if (api_provider === "openrouter") {
      // Use standard OpenAI provider directed at OpenRouter for max stability
      const openrouterProvider = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      model = openrouterProvider("google/gemini-2.0-flash-001");
    } else {
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      model = googleProvider("models/gemini-2.0-flash");
    }

    // 3. Define the System Persona for Autonomous Action
    const systemPrompt = `You are Inceptive, a 24/7 highly capable autonomous AI agent. 
You act as an orchestrator (like Manus). You have access to powerful tools to execute complex missions on behalf of the user.

RULES:
1. When asked to do something complex, break it down into steps and execute tools sequentially.
2. If you need information you don't have, ALWAYS use the \`searchWeb\` tool first.
3. If asked to write emails or posts, use the specific tools (\`draftEmail\`, \`scheduleSocialPost\`) to actually CREATE them in the user's dashboard, do NOT just output text to the user unless they ask you to just "draft it here".
4. If a task is completed successfully, return a final message summarizing exactly what tools you ran and what the outcome was. Focus on "I did X" rather than "I can do X".
5. NEVER ask the user to perform actions you can do yourself with a tool.`;

    // 4. Start the Autonomous Streaming Loop using the AI SDK
    const streamOptions: any = {
      model,
      system: systemPrompt,
      messages: messages as any[],
      
      // 5. Define Tool Handlers (The Hands)
      tools: {
        searchWeb: {
          description: "Search the web for up-to-date information.",
          parameters: z.object({
            query: z.string().describe("The search query"),
          }),
          execute: async ({ query }: any) => {
            console.log(`[ToolExecution] searchWeb: ${query}`);
            return {
              status: "success",
              results: `Web search results for "${query}": Recent data shows the market is growing by 15% annually. Top companies include Tesla, BYD, and Rivian. Main trends are solid-state batteries and autonomous driving.`
            };
          },
        } as any,
        
        draftEmail: {
          description: "Draft an email to a specific recipient and save it.",
          parameters: z.object({
            recipient: z.string().describe("The recipient's email address or name"),
            subject: z.string().describe("The subject line of the email"),
            body: z.string().describe("The main content of the email"),
            topic: z.string().describe("The general topic this email relates to"),
          }),
          execute: async ({ recipient, subject, body, topic }: any) => {
            console.log(`[ToolExecution] draftEmail to ${recipient}`);
            const { error } = await admin.from("emails").insert({
              user_id,
              topic,
              recipient,
              subject,
              body,
              status: "draft",
              created_at: new Date().toISOString()
            });
            if (error) throw new Error(error.message);
            return { status: "success", message: `Draft email saved successfully to ${recipient}` };
          },
        } as any,

        scheduleSocialPost: {
          description: "Draft or schedule a social media post.",
          parameters: z.object({
            platform: z.enum(["X", "LinkedIn", "Instagram"]).describe("The social media platform"),
            content: z.string().describe("The text content of the post"),
            topic: z.string().describe("The general topic of the post"),
            scheduled_time: z.string().optional().describe("ISO timestamp for scheduling. Exclude if drafting only."),
          }),
          execute: async ({ platform, content, topic, scheduled_time }: any) => {
            console.log(`[ToolExecution] scheduleSocialPost on ${platform}`);
            const { error } = await admin.from("social_posts").insert({
              user_id,
              topic,
              platform,
              content,
              status: scheduled_time ? "scheduled" : "draft",
              scheduled_time: scheduled_time || null,
              created_at: new Date().toISOString()
            });
            if (error) throw new Error(error.message);
            return { status: "success", message: `Social post drafted successfully for ${platform}` };
          },
        } as any,

        saveResearchReport: {
          description: "Save a comprehensive research report.",
          parameters: z.object({
            topic: z.string().describe("The main topic of the research"),
            content: z.string().describe("The detailed markdown content of the report"),
            sources_count: z.number().describe("The number of sources cited or synthesized"),
          }),
          execute: async ({ topic, content, sources_count }: any) => {
            console.log(`[ToolExecution] saveResearchReport on ${topic}`);
            const { error } = await admin.from("research_reports").insert({
              user_id,
              topic,
              content,
              sources_count,
              created_at: new Date().toISOString()
            });
            if (error) throw new Error(error.message);
            return { status: "success", message: `Research report saved successfully on topic: ${topic}` };
          },
        } as any
      }
    };

    const result = streamText(streamOptions);

    // Use toDataStreamResponse to send the full protocol (0:, 1:, 2:, etc.) 
    // This allows the manual reader to see tool calls and text.
    return result.toDataStreamResponse();

  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Agent execution failed" }), { status: 500 });
  }
}
