import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { geocodePlaceQuery } from "@/lib/data/geocode";
import { fetchWeatherForCoords } from "@/lib/data/weather-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/data/weather?lat=..&lon=..  OR  ?q=Boston
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  let lat = Number(url.searchParams.get("lat"));
  let lon = Number(url.searchParams.get("lon"));
  const q = (url.searchParams.get("q") || "").trim();

  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && q) {
    const g = await geocodePlaceQuery(q);
    if (g) {
      lat = g.lat;
      lon = g.lon;
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = 19.076;
    lon = 72.8777;
  }

  const w = await fetchWeatherForCoords(lat, lon);
  return NextResponse.json({
    lat,
    lon,
    query: q || null,
    current: w.current,
    source: w.source,
  });
}
