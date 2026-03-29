/**
 * Aggregated news for dashboards / agent tools (GNews when keyed + Hacker News Algolia).
 */
export type NewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  description?: string;
};

export async function fetchAggregatedNews(query: string, maxPerSource = 8): Promise<{
  gnews: NewsArticle[];
  hackernews: NewsArticle[];
}> {
  const q = query.trim() || "technology";
  const gnews: NewsArticle[] = [];
  const key = process.env.GNEWS_API_KEY?.trim();
  if (key) {
    try {
      const r = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=${maxPerSource}&token=${encodeURIComponent(key)}`,
        { headers: { "User-Agent": "InceptiveAI/1.0 (gnews)" }, signal: AbortSignal.timeout(10_000) }
      );
      if (r.ok) {
        const j = await r.json();
        for (const a of j?.articles || []) {
          gnews.push({
            title: a.title || "",
            url: a.url || "",
            source: a.source?.name || "GNews",
            publishedAt: a.publishedAt,
            description: a.description,
          });
        }
      }
    } catch {
      /* optional */
    }
  }

  const hackernews: NewsArticle[] = [];
  try {
    const r = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${Math.min(maxPerSource, 10)}`,
      { headers: { "User-Agent": "InceptiveAI/1.0 (hn)" }, signal: AbortSignal.timeout(8000) }
    );
    if (r.ok) {
      const j = await r.json();
      for (const hit of j?.hits || []) {
        hackernews.push({
          title: hit.title || "",
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: "Hacker News",
          publishedAt: hit.created_at,
        });
      }
    }
  } catch {
    /* optional */
  }

  return { gnews, hackernews };
}
