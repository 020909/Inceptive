import { z } from "zod";

export const agentTools = {
  searchWeb: {
    description: "Search the web for real-time information. Use this whenever you need factual, up-to-date data about companies, news, market sizes, people, or events.",
    parameters: z.object({
      query: z.string().describe("The specific search query to look up on the internet."),
    }),
  },
  draftEmail: {
    description: "Save an email draft to the user's Email Autopilot dashboard.",
    parameters: z.object({
      recipient: z.string().describe("The name or role of the intended recipient (e.g., 'Investors' or 'John Doe')."),
      subject: z.string().describe("The subject line of the email."),
      body: z.string().describe("The main content/body of the email."),
      topic: z.string().describe("A brief 3-5 word summary of the overall topic of this email."),
    }),
  },
  scheduleSocialPost: {
    description: "Save a social media post to the user's Social Media Manager dashboard.",
    parameters: z.object({
      platform: z.enum(["X", "LinkedIn", "Instagram"]).describe("The social media platform."),
      content: z.string().describe("The exact text content of the post including hashtags."),
      topic: z.string().describe("A brief 3-5 word summary of the topic of this post."),
      scheduled_time: z.string().optional().describe("ISO 8601 timestamp string for when to schedule the post. If omitted, it saves as a draft immediately."),
    }),
  },
  saveResearchReport: {
    description: "Save a fully formatted Markdown research report to the user's Research dashboard. ONLY use this when a comprehensive report is explicitly requested or is the final output of a complex task.",
    parameters: z.object({
      topic: z.string().describe("The title or main topic of the research report."),
      content: z.string().describe("The full Markdown content of the report. MUST include sections like Executive Summary, Key Findings, etc."),
      sources_count: z.number().describe("The number of URLs or sources cited in the report."),
    }),
  },
  updateGoalProgress: {
    description: "Update the progress percentage of one of the user's active goals in the dashboard.",
    parameters: z.object({
      goal_id: z.string().describe("The UUID of the specific goal to update."),
      progress_percent: z.number().min(0).max(100).describe("The new completion percentage from 0 to 100."),
      status: z.enum(["active", "completed", "archived"]).optional().describe("Optional new status for the goal. Set to 'completed' if progress is 100."),
    }),
  },
};
