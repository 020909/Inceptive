import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { fetchWeatherForCoords } from "@/lib/data/weather-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function geocodeQuery(q: string): Promise<{ lat: number; lon: number } | null> {
  const contact = process.env.INCEPTIVE_CONTACT_EMAIL || "support@inceptive-ai.com";
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&limit=1`,
      {
        headers: { "User-Agent": `InceptiveAI/1.0 (${contact})` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const first = Array.isArray(j) ? j[0] : null;
    if (!first?.lat || !first?.lon) return null;
    return { lat: parseFloat(first.lat), lon: parseFloat(first.lon) };
  } catch {
    return null;
  }
}

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
    const g = await geocodeQuery(q);
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
