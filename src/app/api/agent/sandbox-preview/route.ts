import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { bundleSandboxIndexForPreview } from "@/lib/sandbox/bundle-html";

export const runtime = "nodejs";

/**
 * Returns bundled HTML (CSS/JS inlined) for the authenticated user's sandbox site — used by dashboard preview.
 */
export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const html = await bundleSandboxIndexForPreview(userId);
  if (!html?.trim()) {
    return NextResponse.json({ error: "No sandbox site found" }, { status: 404 });
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
