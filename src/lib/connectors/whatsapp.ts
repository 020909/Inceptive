/**
 * WhatsApp Business Connector — Cloud API for sending messages and templates.
 * Requires phone_number_id stored in connected_accounts + WHATSAPP_TOKEN env var or per-user token.
 */

import { createClient } from "@supabase/supabase-js";
import type { ConnectorContext, WhatsAppConnector } from "./types";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getWhatsAppConfig(ctx: ConnectorContext): Promise<{ accessToken: string; phoneNumberId: string }> {
  const admin = getAdmin();
  const { data } = await admin
    .from("connected_accounts")
    .select("encrypted_tokens, account_id")
    .eq("user_id", ctx.userId)
    .eq("provider", "whatsapp")
    .single();

  if (!data?.encrypted_tokens) {
    throw new Error("WhatsApp not connected. Connect via Social → Connect WhatsApp.");
  }

  const tokens = typeof data.encrypted_tokens === "string"
    ? JSON.parse(data.encrypted_tokens)
    : data.encrypted_tokens;

  return {
    accessToken: tokens.access_token,
    phoneNumberId: data.account_id || tokens.phone_number_id || "",
  };
}

export const whatsappConnector: WhatsAppConnector = {
  id: "whatsapp",

  async sendMessage(ctx, to, text) {
    const { accessToken, phoneNumberId } = await getWhatsAppConfig(ctx);

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!res.ok) throw new Error(`WhatsApp API error: ${await res.text()}`);
    const result = await res.json();
    return { messageId: result.messages?.[0]?.id || "" };
  },

  async sendTemplate(ctx, to, templateName, params) {
    const { accessToken, phoneNumberId } = await getWhatsAppConfig(ctx);

    const components = Object.entries(params).length > 0
      ? [{
          type: "body",
          parameters: Object.values(params).map((v) => ({ type: "text", text: v })),
        }]
      : [];

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_US" },
            components,
          },
        }),
      }
    );

    if (!res.ok) throw new Error(`WhatsApp API error: ${await res.text()}`);
    const result = await res.json();
    return { messageId: result.messages?.[0]?.id || "" };
  },
};
