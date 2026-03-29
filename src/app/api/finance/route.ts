import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { getStockQuote, getCryptoQuote, getFxRate } from "@/lib/tools/finance-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const can = await checkCredits(userId, "web_search");
  if (!can.unlimited && !can.allowed) {
    return NextResponse.json({ error: can.reason }, { status: 402 });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "").toLowerCase();

  try {
    if (type === "stock") {
      const symbol = url.searchParams.get("symbol") || "";
      if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
      await deductCredits(userId, "web_search", "finance.stock").catch(() => {});
      const quote = await getStockQuote(symbol);
      return NextResponse.json({ type: "stock", quote });
    }

    if (type === "crypto") {
      const id = url.searchParams.get("id") || "";
      if (!id) return NextResponse.json({ error: "id required (e.g. bitcoin)" }, { status: 400 });
      await deductCredits(userId, "web_search", "finance.crypto").catch(() => {});
      const quote = await getCryptoQuote(id);
      return NextResponse.json({ type: "crypto", quote });
    }

    if (type === "fx") {
      const base = url.searchParams.get("base") || "USD";
      const target = url.searchParams.get("target") || "EUR";
      await deductCredits(userId, "web_search", "finance.fx").catch(() => {});
      const quote = await getFxRate(base, target);
      return NextResponse.json({ type: "fx", quote });
    }

    return NextResponse.json(
      { error: "Unsupported type. Use ?type=stock&symbol=TSLA or ?type=crypto&id=bitcoin or ?type=fx&base=USD&target=INR" },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Finance request failed" }, { status: 500 });
  }
}

