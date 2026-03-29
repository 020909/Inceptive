import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import {
  computerGoto,
  computerScreenshot,
  computerClick,
  computerType,
  computerScroll,
  computerMoveMouse,
} from "@/lib/computer-use/session";
import { describeScreenshotBase64 } from "@/lib/vision/describe-screenshot";
import { checkCredits, deductCredits } from "@/lib/credits";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type Action = "goto" | "click" | "type" | "scroll" | "moveMouse" | "screenshot";

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.session_id || "default");
  const action = String(body.action || "") as Action;
  const params = (body.params || {}) as Record<string, any>;
  const requireApproval = !!body.require_approval;

  if (!["goto", "click", "type", "scroll", "moveMouse", "screenshot"].includes(action)) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  // Basic safety gate: if approval required, block dangerous actions until explicit confirm
  if (requireApproval && action !== "screenshot" && !params.approved) {
    return NextResponse.json({ error: "Approval required", code: "APPROVAL_REQUIRED" }, { status: 409 });
  }

  const can = await checkCredits(userId, "computer_use_action");
  if (!can.unlimited && !can.allowed) {
    return NextResponse.json({ error: can.reason }, { status: 402 });
  }
  await deductCredits(userId, "computer_use_action", `computer.execute.${action}`).catch(() => {});

  const sid = `${userId}:${sessionId}`;

  try {
    if (action === "goto") {
      const url = String(params.url || "");
      if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "goto requires http/https URL" }, { status: 400 });
      await computerGoto(userId, sessionId, url);
    } else if (action === "click") {
      await computerClick(userId, sessionId, Number(params.x || 0), Number(params.y || 0));
    } else if (action === "type") {
      await computerType(userId, sessionId, String(params.text || ""));
    } else if (action === "scroll") {
      await computerScroll(userId, sessionId, Number(params.deltaY || 400));
    } else if (action === "moveMouse") {
      await computerMoveMouse(userId, sessionId, Number(params.x || 0), Number(params.y || 0));
    }

    const screenshot = await computerScreenshot(userId, sessionId);

    // Optional vision summary (best effort)
    let vision = "";
    const { data: u } = await admin()
      .from("users")
      .select("api_key_encrypted, api_provider")
      .eq("id", userId)
      .single();
    if (u?.api_key_encrypted && u.api_provider) {
      vision = await describeScreenshotBase64(u.api_key_encrypted, u.api_provider, screenshot).catch(() => "");
    }

    return NextResponse.json({ success: true, screenshot, vision: vision || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Computer action failed" }, { status: 500 });
  }
}

