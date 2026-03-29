export type StockQuote = { symbol: string; price: number | null; source: string; currency?: string };
export type CryptoQuote = { id: string; symbol: string; price_usd: number | null; source: string };
export type FxQuote = { base: string; target: string; rate: number | null; source: string };

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const s = symbol.trim().toUpperCase();
  // Prefer Alpha Vantage when configured; fallback to Stooq (no key).
  const avKey = (process.env.ALPHA_VANTAGE_API_KEY || "").trim();
  if (avKey) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(s)}&apikey=${encodeURIComponent(avKey)}`,
        { headers: { "User-Agent": "InceptiveAI/1.0 (finance)" }, signal: AbortSignal.timeout(7000) }
      );
      if (res.ok) {
        const j = await res.json();
        const q = j?.["Global Quote"] || {};
        const p = Number(q?.["05. price"]);
        if (Number.isFinite(p)) return { symbol: s, price: p, source: "alphavantage.co", currency: "USD" };
      }
    } catch {
      // fallback
    }
  }

  // Free source: Stooq CSV endpoint (no key)
  try {
    const res = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(s.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`, {
      headers: { "User-Agent": "InceptiveAI/1.0 (finance)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const lines = csv.trim().split("\n");
    if (lines.length < 2) throw new Error("No quote rows");
    const vals = lines[1].split(",");
    const close = Number(vals[6]); // close
    return { symbol: s, price: Number.isFinite(close) ? close : null, source: "stooq.com", currency: "USD" };
  } catch {
    return { symbol: s, price: null, source: "stooq.com" };
  }
}

export async function getCryptoQuote(idOrSymbol: string): Promise<CryptoQuote> {
  const id = idOrSymbol.trim().toLowerCase();
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
      { headers: { "User-Agent": "InceptiveAI/1.0 (finance)" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const p = Number(data?.[id]?.usd);
    return { id, symbol: id, price_usd: Number.isFinite(p) ? p : null, source: "coingecko" };
  } catch {
    return { id, symbol: id, price_usd: null, source: "coingecko" };
  }
}

export async function getFxRate(base: string, target: string): Promise<FxQuote> {
  const b = base.trim().toUpperCase();
  const t = target.trim().toUpperCase();
  // Free source: exchangerate.host
  try {
    const res = await fetch(
      `https://api.exchangerate.host/convert?from=${encodeURIComponent(b)}&to=${encodeURIComponent(t)}&amount=1`,
      { headers: { "User-Agent": "InceptiveAI/1.0 (finance)" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = Number(data?.result);
    return { base: b, target: t, rate: Number.isFinite(rate) ? rate : null, source: "exchangerate.host" };
  } catch {
    return { base: b, target: t, rate: null, source: "exchangerate.host" };
  }
}

