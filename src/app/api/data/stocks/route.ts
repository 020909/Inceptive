import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { getStockQuote } from "@/lib/tools/finance-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/data/stocks?symbol=TSLA
 * Uses Alpha Vantage when ALPHA_VANTAGE_API_KEY is set; falls back to Stooq.
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").trim();
  if (!symbol) return NextResponse.json({ error: "symbol required (e.g. TSLA)" }, { status: 400 });

  const quote = await getStockQuote(symbol);
  return NextResponse.json({ symbol: quote.symbol, price: quote.price, currency: quote.currency || null, source: quote.source });
}

