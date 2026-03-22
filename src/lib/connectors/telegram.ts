/**
 * Telegram Connector — Bot API for sending messages and photos.
 * Users provide their bot token via the Social page UI (stored in connected_accounts).
 */

import { createClient } from "@supabase/supabase-js";
import type { ConnectorContext, TelegramConnector } from "./types";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getBotToken(ctx: ConnectorContext): Promise<string> {
  const admin = getAdmin();
  const { data } = await admin
    .from("connected_accounts")
    .select("encrypted_tokens")
    .eq("user_id", ctx.userId)
    .eq("provider", "telegram")
    .single();

  if (!data?.encrypted_tokens) {
    throw new Error("Telegram not connected. Add your bot token in Social → Telegram.");
  }

  const tokens = typeof data.encrypted_tokens === "string"
    ? JSON.parse(data.encrypted_tokens)
    : data.encrypted_tokens;

  return tokens.bot_token;
}

async function telegramAPI(botToken: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Telegram API error: ${await res.text()}`);
  return res.json();
}

export const telegramConnector: TelegramConnector = {
  id: "telegram",

  async sendMessage(ctx, chatId, text) {
    const botToken = await getBotToken(ctx);
    const result = await telegramAPI(botToken, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });
    return { messageId: result.result?.message_id || 0 };
  },

  async sendPhoto(ctx, chatId, photoUrl, caption) {
    const botToken = await getBotToken(ctx);
    const result = await telegramAPI(botToken, "sendPhoto", {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption || "",
      parse_mode: "HTML",
    });
    return { messageId: result.result?.message_id || 0 };
  },

  async getUpdates(ctx) {
    const botToken = await getBotToken(ctx);
    const result = await telegramAPI(botToken, "getUpdates", { limit: 20 });
    const updates = (result.result || []).map((u: { update_id: number; message?: { text?: string; from?: { first_name?: string } } }) => ({
      id: u.update_id,
      message: u.message?.text || "",
      from: u.message?.from?.first_name || "Unknown",
    }));
    return { updates };
  },
};
