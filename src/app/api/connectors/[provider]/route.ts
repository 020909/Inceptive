import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { encryptToken } from "@/lib/token-crypto";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Provider =
  | "twitter"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "telegram"
  | "yahoo";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function appUrlFromRequest(req: Request) {
  const url = new URL(req.url);
  return process.env.NEXT_PUBLIC_APP_URL || url.origin;
}

function redirectPath(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("redirect_to") || "/social";
  // keep it simple + safe: only allow internal paths
  if (!raw.startsWith("/")) return "/social";
  return raw;
}

function providerConfig(provider: Provider, req: Request) {
  const APP_URL = appUrlFromRequest(req);
  const callback = `${APP_URL}/api/connectors/${provider}?mode=callback`;

  if (provider === "twitter") {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { missing: "TWITTER_CLIENT_ID/TWITTER_CLIENT_SECRET" as const };
    return {
      authUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      clientId,
      clientSecret,
      callback,
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"].join(" "),
    };
  }

  if (provider === "linkedin") {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { missing: "LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET" as const };
    return {
      authUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      clientId,
      clientSecret,
      callback,
      scopes: ["openid", "profile", "w_member_social"].join(" "),
    };
  }

  if (provider === "instagram" || provider === "facebook" || provider === "whatsapp") {
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    if (!clientId || !clientSecret) return { missing: "META_APP_ID/META_APP_SECRET" as const };
    // For Instagram/WhatsApp we use Meta OAuth. Exact permissions depend on app review.
    const scopes =
      provider === "whatsapp"
        ? ["whatsapp_business_messaging", "whatsapp_business_management"].join(",")
        : ["instagram_basic", "pages_show_list", "pages_read_engagement", "instagram_content_publish"].join(",");
    return {
      authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
      clientId,
      clientSecret,
      callback,
      scopes,
    };
  }

  if (provider === "yahoo") {
    const clientId = process.env.YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { missing: "YAHOO_CLIENT_ID/YAHOO_CLIENT_SECRET" as const };
    return {
      authUrl: "https://api.login.yahoo.com/oauth2/request_auth",
      tokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
      clientId,
      clientSecret,
      callback,
      scopes: "mail-r",
    };
  }

  // telegram handled via POST (bot token)
  return { missing: "unsupported" as const };
}

async function upsertConnectedAccount(params: {
  userId: string;
  provider: Provider;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string | null;
  accountEmail?: string | null;
  accountName?: string | null;
  accountId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const a = admin();
  const encryptedTokens: Record<string, unknown> = {};
  if (params.accessToken) encryptedTokens.access_token = encryptToken(params.accessToken);
  if (params.refreshToken) encryptedTokens.refresh_token = encryptToken(params.refreshToken);

  const payload: Record<string, unknown> = {
    user_id: params.userId,
    provider: params.provider,
    account_email: params.accountEmail || null,
    account_name: params.accountName || null,
    account_id: params.accountId || null,
    token_expiry: params.tokenExpiry || null,
    metadata: params.metadata || {},
    encrypted_tokens: Object.keys(encryptedTokens).length ? encryptedTokens : null,
  };

  // Maintain legacy columns too (some code still reads access_token/refresh_token).
  if (params.accessToken) payload.access_token = encryptToken(params.accessToken);
  if (params.refreshToken) payload.refresh_token = encryptToken(params.refreshToken);

  const { error } = await a.from("connected_accounts").upsert(payload, { onConflict: "user_id,provider" });
  if (error) throw new Error(error.message);
}

function buildOAuthState(userId: string, provider: Provider, redirectTo: string) {
  const raw = JSON.stringify({ u: userId, p: provider, r: redirectTo, t: Date.now() });
  const payload = Buffer.from(raw, "utf8").toString("base64url");
  const key = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!key) throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function parseOAuthState(state: string): { u: string; p: Provider; r: string } | null {
  try {
    const [payload, sig] = state.split(".");
    if (!payload || !sig) return null;
    const key = process.env.TOKEN_ENCRYPTION_KEY || "";
    if (!key) return null;
    const expected = crypto.createHmac("sha256", key).update(payload).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const json = Buffer.from(payload, "base64url").toString("utf8");
    const obj = JSON.parse(json) as { u?: string; p?: Provider; r?: string };
    if (!obj.u || !obj.p || !obj.r) return null;
    return { u: obj.u, p: obj.p, r: obj.r };
  } catch {
    return null;
  }
}

function pkceChallengeS256(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params;
  const provider = providerRaw as Provider;
  const url = new URL(request.url);
  // Some clients accidentally pass unexpected mode values; treat anything other than
  // an explicit callback as a connect initiation to avoid showing raw JSON errors.
  const rawMode = (url.searchParams.get("mode") || "connect").trim().toLowerCase();
  const mode = rawMode === "callback" ? "callback" : "connect";
  const redirectTo = redirectPath(request);

  if (mode === "connect") {
    const userId = await getAuthenticatedUserIdFromRequest(request, true);
    if (!userId) {
      return NextResponse.redirect(`${appUrlFromRequest(request)}${redirectTo}?error=unauthorized`);
    }

    const cfg = providerConfig(provider, request) as any;
    if (cfg.missing) {
      return NextResponse.redirect(
        `${appUrlFromRequest(request)}${redirectTo}?error=config_missing&provider=${encodeURIComponent(provider)}`
      );
    }

    const state = buildOAuthState(userId, provider, redirectTo);
    const res = NextResponse.redirect("about:blank");

    const authUrl = new URL(cfg.authUrl);
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("redirect_uri", cfg.callback);
    authUrl.searchParams.set("state", state);

    if (provider === "twitter") {
      const verifier = crypto.randomBytes(32).toString("base64url");
      res.cookies.set(`inceptive_pkce_${provider}`, verifier, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
      });
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", cfg.scopes);
      authUrl.searchParams.set("code_challenge", pkceChallengeS256(verifier));
      authUrl.searchParams.set("code_challenge_method", "S256");
    } else if (provider === "linkedin") {
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", cfg.scopes);
    } else if (provider === "yahoo") {
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", cfg.scopes);
    } else {
      // Meta
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", cfg.scopes);
    }

    res.headers.set("Location", authUrl.toString());
    return res;
  }

  if (mode === "callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    const parsed = parseOAuthState(state);
    if (!code || !parsed) {
      return NextResponse.redirect(`${appUrlFromRequest(request)}${redirectTo}?error=missing_code_or_state`);
    }

    const cfg = providerConfig(provider, request) as any;
    if (cfg.missing) {
      return NextResponse.redirect(
        `${appUrlFromRequest(request)}${parsed.r}?error=config_missing&provider=${encodeURIComponent(provider)}`
      );
    }

    try {
      // Token exchange differs a bit per provider.
      let accessToken = "";
      let refreshToken = "";
      let expiresIn: number | null = null;

      if (provider === "twitter") {
        const cookieName = `inceptive_pkce_${provider}`;
        const verifier =
          request.headers
            .get("cookie")
            ?.split(";")
            .map((s) => s.trim())
            .find((c) => c.startsWith(cookieName + "="))
            ?.split("=")[1] || "";
        if (!verifier) throw new Error("Missing PKCE verifier cookie. Please retry connect.");
        const body = new URLSearchParams();
        body.set("grant_type", "authorization_code");
        body.set("code", code);
        body.set("redirect_uri", cfg.callback);
        body.set("client_id", cfg.clientId);
        body.set("code_verifier", verifier);
        const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
        const res = await fetch(cfg.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || JSON.stringify(data));
        accessToken = data.access_token;
        refreshToken = data.refresh_token || "";
        expiresIn = data.expires_in || null;
      } else if (provider === "linkedin") {
        const body = new URLSearchParams();
        body.set("grant_type", "authorization_code");
        body.set("code", code);
        body.set("redirect_uri", cfg.callback);
        body.set("client_id", cfg.clientId);
        body.set("client_secret", cfg.clientSecret);
        const res = await fetch(cfg.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || JSON.stringify(data));
        accessToken = data.access_token;
        refreshToken = data.refresh_token || "";
        expiresIn = data.expires_in || null;
      } else if (provider === "yahoo") {
        const body = new URLSearchParams();
        body.set("grant_type", "authorization_code");
        body.set("code", code);
        body.set("redirect_uri", cfg.callback);
        const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
        const res = await fetch(cfg.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));
        accessToken = data.access_token;
        refreshToken = data.refresh_token || "";
        expiresIn = data.expires_in || null;
      } else {
        // Meta
        const tokenUrl = new URL(cfg.tokenUrl);
        tokenUrl.searchParams.set("client_id", cfg.clientId);
        tokenUrl.searchParams.set("client_secret", cfg.clientSecret);
        tokenUrl.searchParams.set("redirect_uri", cfg.callback);
        tokenUrl.searchParams.set("code", code);
        const res = await fetch(tokenUrl.toString());
        const data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));
        accessToken = data.access_token;
        refreshToken = data.refresh_token || "";
        expiresIn = data.expires_in || null;
      }

      const tokenExpiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

      // Fetch identity where possible (free endpoints).
      let accountName: string | null = null;
      let accountId: string | null = null;
      if (provider === "twitter") {
        const me = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        accountName = me?.data?.username ? `@${me.data.username}` : me?.data?.name || null;
        accountId = me?.data?.id || null;
      } else if (provider === "linkedin") {
        const me = await fetch("https://api.linkedin.com/v2/me", { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json());
        accountName = `${me?.localizedFirstName || ""} ${me?.localizedLastName || ""}`.trim() || null;
        // store raw person id; publishers can add the urn prefix
        accountId = me?.id ? String(me.id) : null;
      } else if (provider === "instagram" || provider === "facebook" || provider === "whatsapp") {
        const me = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`).then((r) => r.json());
        accountName = me?.name ? String(me.name) : "Connected (Meta)";
        accountId = me?.id ? String(me.id) : null;
      } else if (provider === "yahoo") {
        accountName = "Connected (Yahoo)";
      }

      await upsertConnectedAccount({
        userId: parsed.u,
        provider,
        accessToken,
        refreshToken: refreshToken || undefined,
        tokenExpiry,
        accountEmail: null,
        accountName,
        accountId,
        metadata: { connected_via: "oauth2" },
      });

      const resp = NextResponse.redirect(`${appUrlFromRequest(request)}${parsed.r}?connected=${encodeURIComponent(provider)}`);
      if (provider === "twitter") {
        resp.cookies.set(`inceptive_pkce_${provider}`, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
      }
      return resp;
    } catch (e: any) {
      return NextResponse.redirect(`${appUrlFromRequest(request)}${parsed.r}?error=${encodeURIComponent(e.message || "connect_failed")}`);
    }
  }

  // Unreachable due to mode normalization above, but keep a safe redirect just in case.
  return NextResponse.redirect(`${appUrlFromRequest(request)}${redirectTo}?error=unsupported_mode`);
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params;
  const provider = providerRaw as Provider;
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (provider !== "telegram") {
    return NextResponse.json({ error: "Unsupported provider for POST" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { bot_token?: string; chat_id?: string };
  if (!body.bot_token?.trim()) {
    return NextResponse.json({ error: "bot_token required" }, { status: 400 });
  }
  if (!body.chat_id?.trim()) {
    return NextResponse.json(
      { error: "chat_id required — use your channel/group numeric ID or @username the bot can message" },
      { status: 400 }
    );
  }

  // Validate token by calling getMe
  const me = await fetch(`https://api.telegram.org/bot${body.bot_token}/getMe`).then((r) => r.json());
  if (!me?.ok) return NextResponse.json({ error: "Invalid Telegram bot token" }, { status: 400 });

  await upsertConnectedAccount({
    userId,
    provider: "telegram",
    accessToken: body.bot_token,
    refreshToken: undefined,
    tokenExpiry: null,
    accountEmail: null,
    accountName: `@${me.result?.username || "telegram-bot"}`,
    accountId: String(me.result?.id || ""),
    metadata: { chat_id: body.chat_id.trim() },
  });

  return NextResponse.json({ ok: true, bot: me.result });
}

