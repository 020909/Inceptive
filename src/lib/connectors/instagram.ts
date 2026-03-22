/**
 * Instagram Connector — Meta Graph API for publishing posts and stories.
 * Requires META_APP_ID and META_APP_SECRET in env.
 */

import { createClient } from "@supabase/supabase-js";
import type { ConnectorContext, InstagramConnector } from "./types";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getInstagramToken(ctx: ConnectorContext): Promise<{ accessToken: string; igUserId: string }> {
  if (ctx.accessToken) return { accessToken: ctx.accessToken, igUserId: "" };

  const admin = getAdmin();
  const { data } = await admin
    .from("connected_accounts")
    .select("encrypted_tokens, account_id")
    .eq("user_id", ctx.userId)
    .eq("provider", "instagram")
    .single();

  if (!data?.encrypted_tokens) {
    throw new Error("Instagram not connected. Connect via Social → Connect Instagram.");
  }

  const tokens = typeof data.encrypted_tokens === "string"
    ? JSON.parse(data.encrypted_tokens)
    : data.encrypted_tokens;

  return { accessToken: tokens.access_token, igUserId: data.account_id || "" };
}

export const instagramConnector: InstagramConnector = {
  id: "instagram",

  async publishPost(ctx, imageUrl, caption) {
    const { accessToken, igUserId } = await getInstagramToken(ctx);

    // Step 1: Create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`,
      { method: "POST" }
    );
    if (!createRes.ok) throw new Error(`Instagram create error: ${await createRes.text()}`);
    const { id: containerId } = await createRes.json();

    // Step 2: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish?creation_id=${containerId}&access_token=${accessToken}`,
      { method: "POST" }
    );
    if (!publishRes.ok) throw new Error(`Instagram publish error: ${await publishRes.text()}`);
    const result = await publishRes.json();
    return { postId: result.id };
  },

  async createStory(ctx, imageUrl) {
    const { accessToken, igUserId } = await getInstagramToken(ctx);

    const createRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media?image_url=${encodeURIComponent(imageUrl)}&media_type=STORIES&access_token=${accessToken}`,
      { method: "POST" }
    );
    if (!createRes.ok) throw new Error(`Instagram story error: ${await createRes.text()}`);
    const { id: containerId } = await createRes.json();

    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish?creation_id=${containerId}&access_token=${accessToken}`,
      { method: "POST" }
    );
    if (!publishRes.ok) throw new Error(`Instagram publish error: ${await publishRes.text()}`);
    const result = await publishRes.json();
    return { storyId: result.id };
  },

  async getInsights(ctx) {
    const { accessToken, igUserId } = await getInstagramToken(ctx);

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}?fields=followers_count,media_count&access_token=${accessToken}`
    );
    if (!res.ok) throw new Error(`Instagram insights error: ${await res.text()}`);
    const data = await res.json();

    return {
      followers: data.followers_count || 0,
      engagement: data.media_count || 0,
    };
  },
};
