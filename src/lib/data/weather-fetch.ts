/**
 * Shared weather fetch for widgets and /api/data/weather.
 */
export type WeatherPayload = {
  current: Record<string, unknown> | null;
  source: "openweathermap" | "open-meteo";
  raw?: unknown;
};

export async function fetchWeatherForCoords(lat: number, lon: number): Promise<WeatherPayload> {
  const owKey = (process.env.OPENWEATHERMAP_API_KEY || process.env.OPENWEATHER_API_KEY || "").trim();

  if (owKey) {
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&appid=${encodeURIComponent(owKey)}&units=metric`,
        { headers: { "User-Agent": "InceptiveAI/1.0 (weather)" }, signal: AbortSignal.timeout(8000) }
      );
      if (r.ok) {
        const j = await r.json();
        return {
          source: "openweathermap",
          current: {
            temperature_2m: j?.main?.temp,
            wind_speed_10m: j?.wind?.speed,
            description: j?.weather?.[0]?.description,
            relative_humidity_2m: j?.main?.humidity,
          },
          raw: j,
        };
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
      { headers: { "User-Agent": "InceptiveAI/1.0 (weather)" }, signal: AbortSignal.timeout(8000) }
    );
    if (r.ok) {
      const j = await r.json();
      return { source: "open-meteo", current: (j?.current as Record<string, unknown>) || null, raw: j };
    }
  } catch {
    /* empty */
  }

  return { source: "open-meteo", current: null };
}
