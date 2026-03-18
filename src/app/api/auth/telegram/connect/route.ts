import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/token-crypto";

/**
 * POST /api/auth/telegram/connect
 * Body: { bot_token: string, chat_id?: string }
 * Validates the bot token, fetches bot info, saves to connected_accounts.
 */
export async function POST(request: Request) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { bot_token, chat_id } = body;
    if (!bot_token) return NextResponse.json({ error: "Missing bot_token" }, { status: 400 });

    // Validate the bot token via Telegram API
    const meRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) throw new Error("Invalid Telegram bot token");

    const bot = meData.result;

    await admin.from("connected_accounts").upsert({
      user_id: user.id,
      provider: "telegram",
      access_token: encryptToken(bot_token),
      account_name: `@${bot.username}`,
      account_id: bot.id.toString(),
      metadata: { chat_id: chat_id || null, bot_name: bot.first_name, username: bot.username },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    return NextResponse.json({
      success: true,
      bot: { name: bot.first_name, username: bot.username, id: bot.id },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

/** DELETE /api/auth/telegram/connect */
export async function DELETE(request: Request) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await admin.from("connected_accounts").delete().eq("user_id", user.id).eq("provider", "telegram");
  return NextResponse.json({ success: true });
}
