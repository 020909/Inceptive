import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { fetchWeatherForCoords } from "@/lib/data/weather-fetch";
import { getCryptoQuote, getFxRate } from "@/lib/tools/finance-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat") || "19.076");
  const lon = Number(url.searchParams.get("lon") || "72.8777");

  let weatherCurrent: Record<string, unknown> | null = null;
  let weatherSource: "openweathermap" | "open-meteo" = "open-meteo";
  try {
    const w = await fetchWeatherForCoords(lat, lon);
    weatherSource = w.source;
    weatherCurrent = w.current;
  } catch {}

  const [btc, eth, usdInr] = await Promise.all([
    getCryptoQuote("bitcoin"),
    getCryptoQuote("ethereum"),
    getFxRate("USD", "INR"),
  ]);

  return NextResponse.json({
    weather: weatherCurrent,
    crypto: { bitcoin: btc.price_usd, ethereum: eth.price_usd },
    fx: { usd_inr: usdInr.rate },
    source: { weather: weatherSource, crypto: "coingecko", fx: "exchangerate.host" },
  });
}

