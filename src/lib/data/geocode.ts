/**
 * Shared place → lat/lon for weather and location-aware tools.
 */
export async function geocodePlaceQuery(q: string): Promise<{ lat: number; lon: number } | null> {
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
