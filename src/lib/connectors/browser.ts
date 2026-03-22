import { assertUrlSafeForServerFetch } from "@/lib/url-safety";
import type { BrowserConnector } from "./types";

async function duckDuckGoSearch(query: string): Promise<string> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "InceptiveAI/1.0 (connector)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("DuckDuckGo request failed");
  const data = (await res.json()) as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof data.AbstractText === "string" && data.AbstractText) {
    lines.push(data.AbstractText as string);
  }
  if (Array.isArray(data.RelatedTopics)) {
    for (const t of (data.RelatedTopics as { Text?: string }[]).slice(0, 6)) {
      if (t.Text) lines.push(`• ${t.Text}`);
    }
  }
  return lines.length ? lines.join("\n") : `No instant results for "${query}".`;
}

async function fetchPageSafe(url: string): Promise<string> {
  assertUrlSafeForServerFetch(url);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; InceptiveBot/1.0)",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (ct.includes("text/plain") || ct.includes("application/json")) {
    return raw.slice(0, 8000);
  }
  const text = raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
  return text.slice(0, 8000);
}

export const browserConnector: BrowserConnector = {
  id: "browser",
  search: duckDuckGoSearch,
  fetchPage: fetchPageSafe,
};
