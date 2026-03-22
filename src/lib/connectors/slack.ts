import type { SlackConnector } from "./types";

/**
 * Workspace-level stub: set SLACK_BOT_TOKEN (xoxb-…) and optional SLACK_DEFAULT_CHANNEL (C…).
 * Per-user Slack OAuth can replace this later.
 */
export const slackConnector: SlackConnector = {
  id: "slack",
  async postMessage(text: string) {
    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_DEFAULT_CHANNEL;
    if (!token || !channel) {
      return {
        ok: false,
        error: "SLACK_BOT_TOKEN and SLACK_DEFAULT_CHANNEL are not configured",
      };
    }
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!data.ok) {
      return { ok: false, error: data.error || "slack_api_error" };
    }
    return { ok: true };
  },
};
