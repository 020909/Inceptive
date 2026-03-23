import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { getGmailClientForUser } from "@/lib/email/gmail-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const client = await getGmailClientForUser(userId);
    if (!client) return NextResponse.json({ error: "Gmail not connected", code: "NOT_CONNECTED" }, { status: 400 });

    const full = await client.gmail.users.messages.get({ userId: "me", id, format: "full" });
    const payload = full.data.payload;

    const extractBody = (part: any): string => {
      if (!part) return "";
      if (part.mimeType === "text/plain" && part.body && part.body.data)
        return Buffer.from(part.body.data, "base64").toString("utf8");
      if (part.mimeType === "text/html" && part.body && part.body.data) {
        const html = Buffer.from(part.body.data, "base64").toString("utf8");
        return html.replace(/<[^>]+>/g, " ").replace(/[ 	]{2,}/g, " ").trim();
      }
      if (part.parts) {
        for (const p of part.parts) {
          const t = extractBody(p);
          if (t) return t;
        }
      }
      return "";
    };

    const body = (payload ? extractBody(payload) : "") || full.data.snippet || "";
    return NextResponse.json({ body, snippet: full.data.snippet });
  } catch (err: any) {
    console.error("[emails/full]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
