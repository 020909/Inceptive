import { assertUrlSafeForServerFetch } from "@/lib/url-safety";

export type SearchResultItem = {
  title: string;
  url: string;
  snippet?: string;
  source: "tavily" | "brave" | "searxng" | "duckduckgo";
  raw_content?: string;
};

function normalizeSearxBaseUrl(): string | null {
  const raw = (process.env.SEARXNG_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function browseViaJinaReader(originalUrl: string, maxChars: number): Promise<string | null> {
  try {
    // Safety: validate the original URL; Jina fetches it server-side.
    assertUrlSafeForServerFetch(originalUrl);
    const jinaUrl = `https://r.jina.ai/${originalUrl}`;
    const res = await fetch(jinaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InceptiveBot/1.0; +https://inceptive.ai)",
        Accept: "text/plain,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text) return null;
    // Jina often includes header-ish lines; keep it simple and just truncate.
    return text.slice(0, maxChars);
  } catch {
    return null;
  }
}

export async function browseUrlText(url: string, maxChars = 8000): Promise<string> {
  try {
    assertUrlSafeForServerFetch(url);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InceptiveBot/1.0; +https://inceptive.ai)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) {
      const fallback = await browseViaJinaReader(url, maxChars);
      if (fallback) return fallback;
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/plain") || contentType.includes("application/json")) {
      return (await res.text()).slice(0, maxChars);
    }

    const html = await res.text();
    const extracted = extractTextFromHtml(html);
    // If extraction is too shallow (common with heavy JS sites), fallback to Jina reader.
    if (extracted.replace(/\s+/g, " ").trim().length < 600) {
      const fallback = await browseViaJinaReader(url, maxChars);
      if (fallback) return fallback;
    }
    return extracted.slice(0, maxChars);
  } catch (err: any) {
    return `Could not fetch ${url}: ${err?.message || "Unknown error"}`;
  }
}

async function searchTavily(query: string, limit = 8, depth: "basic" | "advanced" = "basic"): Promise<SearchResultItem[] | null> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: Math.min(Math.max(limit, 1), 15),
        search_depth: depth,
        include_raw_content: depth === "advanced",
        topic: "general",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results;
    if (!Array.isArray(results) || !results.length) return null;
    return results
      .slice(0, limit)
      .map((r: any) => ({
        title: String(r?.title || "Result"),
        url: String(r?.url || ""),
        snippet: r?.content ? String(r.content).slice(0, 800) : undefined,
        raw_content: r?.raw_content ? String(r.raw_content).slice(0, 2000) : undefined,
        source: "tavily" as const,
      }))
      .filter((r: SearchResultItem) => Boolean(r.url));
  } catch {
    return null;
  }
}

async function searchBrave(query: string, limit = 8): Promise<SearchResultItem[] | null> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return null;
  const count = Math.min(Math.max(limit, 1), 20);
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  try {
    const res = await fetch(url, {
      headers: {
        "X-Subscription-Token": key,
        Accept: "application/json",
        "User-Agent": "InceptiveAI/1.0 (search-provider)",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.web?.results;
    if (!Array.isArray(results) || !results.length) return null;
    return results
      .slice(0, limit)
      .map((r: any) => ({
        title: String(r?.title || "Result"),
        url: String(r?.url || ""),
        snippet: r?.description ? String(r.description) : undefined,
        source: "brave" as const,
      }))
      .filter((r: SearchResultItem) => Boolean(r.url));
  } catch {
    return null;
  }
}

async function searchSearx(query: string, limit = 8): Promise<SearchResultItem[]> {
  const base = normalizeSearxBaseUrl();
  if (!base) return [];

  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&language=en&safesearch=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "InceptiveAI/1.0 (search-provider)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`SearXNG request failed (${res.status})`);
  const data = await res.json();
  const rows = Array.isArray(data?.results) ? data.results : [];

  return rows.slice(0, limit).map((r: any) => ({
    title: String(r?.title || "Untitled"),
    url: String(r?.url || ""),
    snippet: r?.content ? String(r.content) : undefined,
    source: "searxng" as const,
  }));
}

async function searchDuckDuckGo(query: string, limit = 8): Promise<SearchResultItem[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "InceptiveAI/1.0 (search-provider)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("DuckDuckGo request failed");
  const data = await res.json();
  const out: SearchResultItem[] = [];

  if (data?.AbstractText) {
    out.push({
      title: data?.Heading || query,
      url: data?.AbstractURL || "",
      snippet: data.AbstractText,
      source: "duckduckgo",
    });
  }

  if (Array.isArray(data?.Results)) {
    for (const r of data.Results.slice(0, 4)) {
      out.push({
        title: String(r?.Text || "Result"),
        url: String(r?.FirstURL || ""),
        snippet: String(r?.Text || ""),
        source: "duckduckgo",
      });
    }
  }

  if (Array.isArray(data?.RelatedTopics)) {
    for (const t of data.RelatedTopics.filter((x: any) => x?.Text && !x?.Topics).slice(0, 6)) {
      out.push({
        title: String(t.Text).slice(0, 120),
        url: String(t.FirstURL || ""),
        snippet: String(t.Text || ""),
        source: "duckduckgo",
      });
    }
  }

  return out.filter((r) => r.url).slice(0, limit);
}

export async function searchWeb(
  query: string,
  limit = 8,
  depth: "basic" | "advanced" = "basic"
): Promise<{ provider: "tavily" | "brave" | "searxng" | "duckduckgo"; items: SearchResultItem[] }> {
  const tavilyItems = await searchTavily(query, limit, depth);
  if (tavilyItems && tavilyItems.length > 0) return { provider: "tavily", items: tavilyItems };

  const braveItems = await searchBrave(query, limit);
  if (braveItems && braveItems.length > 0) return { provider: "brave", items: braveItems };

  const hasSearx = Boolean(normalizeSearxBaseUrl());
  if (hasSearx) {
    try {
      const items = await searchSearx(query, limit);
      if (items.length > 0) return { provider: "searxng", items };
    } catch {
      // Fallback to DDG if SearX is unavailable.
    }
  }

  const ddgItems = await searchDuckDuckGo(query, limit);
  return { provider: "duckduckgo", items: ddgItems };
}

export function formatSearchResultsForPrompt(query: string, data: { provider: string; items: SearchResultItem[] }): string {
  if (!data.items.length) {
    return `No search results for "${query}".`;
  }
  const header = `Search provider: ${data.provider}`;
  const lines = data.items.map((item, index) => {
    const snippet = item.snippet ? ` — ${item.snippet}` : "";
    return `${index + 1}. ${item.title}${snippet}\nURL: ${item.url}`;
  });
  return `${header}\n${lines.join("\n")}`.slice(0, 8000);
}

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s/$.?#].[^\s)"]*/gi;
  return Array.from(new Set((text.match(urlRegex) || []).map((u) => u.replace(/[.,]+$/g, ""))));
}
