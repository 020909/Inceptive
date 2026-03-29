import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { fetchAggregatedNews } from "@/lib/data/news-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/data/news?q=technology&max=8
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "technology";
  const max = Math.min(15, Math.max(1, Number(url.searchParams.get("max") || 8)));

  const { gnews, hackernews } = await fetchAggregatedNews(q, max);
  return NextResponse.json({
    query: q,
    gnews,
    hackernews,
    hasGNews: !!process.env.GNEWS_API_KEY?.trim(),
  });
}
