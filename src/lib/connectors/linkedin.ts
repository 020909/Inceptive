/**
 * LinkedIn Connector — OAuth + create post, share update, get profile.
 * Requires LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in env.
 */

import { createClient } from "@supabase/supabase-js";
import type { ConnectorContext, LinkedInConnector } from "./types";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getLinkedInToken(ctx: ConnectorContext): Promise<{ accessToken: string; personUrn: string }> {
  if (ctx.accessToken) return { accessToken: ctx.accessToken, personUrn: "" };

  const admin = getAdmin();
  const { data } = await admin
    .from("connected_accounts")
    .select("encrypted_tokens, account_id")
    .eq("user_id", ctx.userId)
    .eq("provider", "linkedin")
    .single();

  if (!data?.encrypted_tokens) {
    throw new Error("LinkedIn not connected. Connect via Social → Connect LinkedIn.");
  }

  const tokens = typeof data.encrypted_tokens === "string"
    ? JSON.parse(data.encrypted_tokens)
    : data.encrypted_tokens;

  return { accessToken: tokens.access_token, personUrn: data.account_id || "" };
}

export const linkedinConnector: LinkedInConnector = {
  id: "linkedin",

  async createPost(ctx, text, mediaUrl) {
    const { accessToken, personUrn } = await getLinkedInToken(ctx);

    const body: Record<string, unknown> = {
      author: personUrn || `urn:li:person:${ctx.userId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: mediaUrl ? "IMAGE" : "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`LinkedIn API error: ${await res.text()}`);
    const result = await res.json();
    return { postId: result.id || "" };
  },

  async shareUpdate(ctx, text, articleUrl) {
    // shareUpdate uses the same UGC Posts API with an article attachment
    const { accessToken, personUrn } = await getLinkedInToken(ctx);

    const shareContent: Record<string, unknown> = {
      shareCommentary: { text },
      shareMediaCategory: articleUrl ? "ARTICLE" : "NONE",
    };

    if (articleUrl) {
      shareContent.media = [
        {
          status: "READY",
          originalUrl: articleUrl,
        },
      ];
    }

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: personUrn || `urn:li:person:${ctx.userId}`,
        lifecycleState: "PUBLISHED",
        specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });

    if (!res.ok) throw new Error(`LinkedIn API error: ${await res.text()}`);
    const result = await res.json();
    return { shareId: result.id || "" };
  },

  async getProfile(ctx) {
    const { accessToken } = await getLinkedInToken(ctx);

    const res = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`LinkedIn API error: ${await res.text()}`);
    const profile = await res.json();

    return {
      name: `${profile.localizedFirstName || ""} ${profile.localizedLastName || ""}`.trim(),
      headline: profile.headline?.localized?.en_US || "",
      profileUrl: `https://linkedin.com/in/${profile.vanityName || ""}`,
    };
  },
};
