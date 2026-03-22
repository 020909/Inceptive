/**
 * Twitter / X Connector — OAuth 2.0 + tweet, reply, DM, timeline.
 * Requires TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in env.
 */

import { createClient } from "@supabase/supabase-js";
import type { ConnectorContext, TwitterConnector } from "./types";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getTwitterToken(ctx: ConnectorContext): Promise<string> {
  if (ctx.accessToken) return ctx.accessToken;

  const admin = getAdmin();
  const { data } = await admin
    .from("connected_accounts")
    .select("encrypted_tokens")
    .eq("user_id", ctx.userId)
    .eq("provider", "twitter")
    .single();

  if (!data?.encrypted_tokens) {
    throw new Error("Twitter not connected. Connect via Social → Connect X/Twitter.");
  }

  const tokens = typeof data.encrypted_tokens === "string"
    ? JSON.parse(data.encrypted_tokens)
    : data.encrypted_tokens;

  return tokens.access_token;
}

async function twitterAPI(accessToken: string, endpoint: string, options?: RequestInit) {
  const res = await fetch(`https://api.twitter.com/2/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Twitter API error (${res.status}): ${error}`);
  }

  return res.json();
}

export const twitterConnector: TwitterConnector = {
  id: "twitter",

  async postTweet(ctx, text) {
    const token = await getTwitterToken(ctx);
    const result = await twitterAPI(token, "tweets", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return { tweetId: result.data?.id || "" };
  },

  async replyToTweet(ctx, tweetId, text) {
    const token = await getTwitterToken(ctx);
    const result = await twitterAPI(token, "tweets", {
      method: "POST",
      body: JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweetId } }),
    });
    return { tweetId: result.data?.id || "" };
  },

  async sendDM(ctx, recipientId, text) {
    const token = await getTwitterToken(ctx);
    await twitterAPI(token, `dm_conversations/with/${recipientId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return { success: true };
  },

  async getTimeline(ctx, maxResults = 10) {
    const token = await getTwitterToken(ctx);
    const result = await twitterAPI(token, `users/me/timelines/reverse_chronological?max_results=${maxResults}`);
    const tweets = (result.data || []).map((t: { id: string; text: string; author_id: string }) => ({
      id: t.id,
      text: t.text,
      author: t.author_id,
    }));
    return { tweets };
  },
};
