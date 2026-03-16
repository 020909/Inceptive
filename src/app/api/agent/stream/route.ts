import { createClient } from "@supabase/supabase-js";
import { streamText, tool, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { agentTools } from "@/lib/agent-tools";

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
    let model;

    if (api_provider === "openai") {
      model = openai("gpt-4o", { apiKey });
    } else if (api_provider === "claude") {
      model = anthropic("claude-3-5-sonnet-20240620", { apiKey });
    } else if (api_provider === "openrouter") {
      const openrouter = createOpenRouter({ apiKey });
      model = openrouter("google/gemini-2.0-flash-exp:free");
    } else {
      model = google("models/gemini-2.0-flash", { apiKey });
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
    const result = streamText({
      model,
      system: systemPrompt,
      messages: messages as CoreMessage[],
      maxSteps: 10, // Prevents infinite loops
      
      // 5. Define Tool Handlers (The Hands)
      tools: {
        searchWeb: tool({
          description: agentTools.searchWeb.description,
          parameters: agentTools.searchWeb.parameters,
          execute: async ({ query }) => {
            // Placeholder for now, in production we would call Tavily or a real SERP API.
            // For MVP, if they ask for EV, we mock a structured response so it can read it.
            console.log(`[ToolExecution] searchWeb: ${query}`);
            return {
              status: "success",
              results: `Web search results for "${query}": Recent data shows the market is growing by 15% annually. Top companies include Tesla, BYD, and Rivian. Main trends are solid-state batteries and autonomous driving.`
            };
          },
        }),
        
        draftEmail: tool({
          description: agentTools.draftEmail.description,
          parameters: agentTools.draftEmail.parameters,
          execute: async ({ recipient, subject, body, topic }) => {
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
        }),

        scheduleSocialPost: tool({
          description: agentTools.scheduleSocialPost.description,
          parameters: agentTools.scheduleSocialPost.parameters,
          execute: async ({ platform, content, topic, scheduled_time }) => {
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
        }),

        saveResearchReport: tool({
          description: agentTools.saveResearchReport.description,
          parameters: agentTools.saveResearchReport.parameters,
          execute: async ({ topic, content, sources_count }) => {
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
        })
      },
    });

    // Automatically send stream back to frontend
    return result.toDataStreamResponse();

  } catch (err: any) {
    console.error("Agent Stream Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Agent execution failed" }), { status: 500 });
  }
}
