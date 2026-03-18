/**
 * POST /api/actions/publish-post
 * Publishes a social post to the connected platform.
 * Supports: Twitter/X, LinkedIn, Facebook, Instagram, Telegram.
 * Falls back to marking as "published" in DB if platform not connected.
 */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/token-crypto";

export const maxDuration = 60;

const getAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ─── Platform publishers ───────────────────────────────────────────────

async function publishToTwitter(accessToken: string, content: string): Promise<string> {
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: content.slice(0, 280) }),
  });
  const data = await res.json();
  if (data.errors || !res.ok) throw new Error(`Twitter error: ${JSON.stringify(data.errors || data)}`);
  return data.data?.id;
}

async function publishToLinkedIn(accessToken: string, content: string, personId: string): Promise<string> {
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn error: ${JSON.stringify(data)}`);
  return data.id;
}

async function publishToFacebook(accessToken: string, content: string, pageId?: string): Promise<string> {
  const endpoint = pageId
    ? `https://graph.facebook.com/v19.0/${pageId}/feed`
    : "https://graph.facebook.com/v19.0/me/feed";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: content, access_token: accessToken }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook error: ${data.error.message}`);
  return data.id;
}

async function publishToInstagram(accessToken: string, content: string, igAccountId: string): Promise<string> {
  // Instagram requires an image/video. For text-only we use a simple placeholder image.
  // In production, users should provide media. Here we attempt a text-only carousel workaround.
  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: content,
        media_type: "REELS",
        access_token: accessToken,
      }),
    }
  );
  const container = await containerRes.json();
  if (container.error) throw new Error(`Instagram container error: ${container.error.message}`);

  // Step 2: Publish container
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    }
  );
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`Instagram publish error: ${publishData.error.message}`);
  return publishData.id;
}

async function publishToTelegram(botToken: string, chatId: string, content: string): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: content, parse_mode: "HTML" }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result?.message_id?.toString();
}

// ─── Main handler ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  const admin = getAdmin();
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { post_id } = await request.json();
    if (!post_id) return NextResponse.json({ error: "Missing post_id" }, { status: 400 });

    const { data: post, error: postError } = await admin
      .from("social_posts")
      .select("*")
      .eq("id", post_id)
      .eq("user_id", user.id)
      .single();
    if (postError || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const platform = post.platform.toLowerCase();

    // Map platform name to provider key
    const PLATFORM_TO_PROVIDER: Record<string, string> = {
      x: "twitter",
      twitter: "twitter",
      linkedin: "linkedin",
      facebook: "facebook",
      instagram: "instagram",
      telegram: "telegram",
      tiktok: "tiktok",
      youtube: "youtube",
    };
    const provider = PLATFORM_TO_PROVIDER[platform];

    let published = false;
    let method = "manual";
    let externalId: string | undefined;

    if (provider) {
      const { data: account } = await admin
        .from("connected_accounts")
        .select("provider, access_token, account_id, metadata")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .single();

      if (account) {
        const accessToken = decryptToken(account.access_token);

        switch (provider) {
          case "twitter":
            externalId = await publishToTwitter(accessToken, post.content);
            break;
          case "linkedin":
            externalId = await publishToLinkedIn(accessToken, post.content, account.account_id);
            break;
          case "facebook":
            externalId = await publishToFacebook(accessToken, post.content, account.metadata?.page_id);
            break;
          case "instagram":
            externalId = await publishToInstagram(
              account.metadata?.page_access_token || accessToken,
              post.content,
              account.account_id
            );
            break;
          case "telegram":
            const chatId = account.metadata?.chat_id;
            if (!chatId) throw new Error("No Telegram chat_id configured. Edit your Telegram connection and add a chat ID.");
            externalId = await publishToTelegram(accessToken, chatId, post.content);
            break;
        }

        published = true;
        method = provider;
      }
    }

    await admin.from("social_posts").update({
      status: "published",
      metadata: {
        published_via: method,
        published_at: new Date().toISOString(),
        external_id: externalId,
      },
    }).eq("id", post_id);

    return NextResponse.json({
      success: true,
      published,
      method,
      message: published
        ? `Published to ${post.platform}`
        : `Post marked as published (${post.platform} not connected)`,
    });
  } catch (err: any) {
    console.error("[publish-post action]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
