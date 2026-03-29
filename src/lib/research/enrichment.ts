/**
 * Free / low-friction research context (no API keys unless noted).
 * Each fetch is best-effort with short timeouts so research never blocks forever.
 */

const UA = "InceptiveResearch/1.0 (+https://app.inceptive-ai.com)";
const SEC_UA = `InceptiveAI ${process.env.INCEPTIVE_CONTACT_EMAIL || "contact@app.inceptive-ai.com"}`;

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export type EnrichmentMeta = { sources: string[] };

/** Weather-ish */
function wantsWeather(topic: string) {
  return /weather|forecast|temperature|rain|humidity|wind speed|open-?meteo/i.test(topic);
}

/** Location / geocode */
function wantsGeo(topic: string) {
  return /geocode|coordinates|latitude|longitude|lat\s*[,]?\s*lng|address of|where is .+ located/i.test(topic);
}

/** FX */
function wantsFx(topic: string) {
  return /exchange rate|currency|usd to|eur to|gbp to|inr to|forex|fx\b/i.test(topic);
}

/** SEC / filings */
function wantsSec(topic: string) {
  return /\b(10-?k|10-?q|8-?k|sec filing|edgar|sec\.gov|investor filing)\b/i.test(topic);
}

/** Ticker symbol 1–5 uppercase letters */
function extractTicker(topic: string): string | null {
  const m = topic.match(/\b([A-Z]{1,5})\b/);
  return m ? m[1] : null;
}

function wantsMedical(topic: string) {
  return /health|medical|clinical|disease|covid|therapy|drug|patient|pubmed|ncbi|biotech/i.test(topic);
}

/** Likely single-word or two-word dictionary lookup */
function wantsDictionary(topic: string) {
  const t = topic.trim();
  if (t.length > 40) return false;
  return /^(define|definition of|meaning of|what does .+ mean)\b/i.test(t) || /^[a-zA-Z-]{2,25}(\s[a-zA-Z-]{2,25})?$/.test(t);
}

function dictionaryWord(topic: string): string | null {
  const m = topic.match(/^(?:define|definition of|meaning of)\s+(.+)/i);
  if (m) return m[1].trim().split(/\s+/)[0];
  const parts = topic.trim().split(/\s+/);
  if (parts.length <= 2 && /^[a-zA-Z-]+$/.test(parts[0])) return parts[0];
  return null;
}

async function fetchJson(url: string, init: RequestInit = {}, ms = 5000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchHackerNews(topic: string): Promise<string | null> {
  const data = await fetchJson(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=8`
  );
  const hits = data?.hits;
  if (!Array.isArray(hits) || !hits.length) return null;
  const lines = hits.slice(0, 8).map((h: any) => {
    const title = h.title || "(no title)";
    const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
    return `• ${title} — ${url}`;
  });
  return `HACKER NEWS (Algolia)\n${lines.join("\n")}`;
}

export async function fetchReddit(topic: string): Promise<string | null> {
  const data = await fetchJson(
    `https://old.reddit.com/search.json?q=${encodeURIComponent(topic)}&limit=6&sort=relevance`,
    { headers: { "User-Agent": UA } },
    6000
  );
  const children = data?.data?.children;
  if (!Array.isArray(children) || !children.length) return null;
  const lines: string[] = [];
  for (const c of children.slice(0, 6)) {
    const p = c?.data;
    if (!p?.title) continue;
    const url = `https://reddit.com${p.permalink || ""}`;
    lines.push(`• ${p.title} — ${url}`);
  }
  if (!lines.length) return null;
  return `REDDIT (public search)\n${lines.join("\n")}`;
}

export async function fetchRestCountries(topic: string): Promise<string | null> {
  const q = topic.trim();
  if (q.length > 60) return null;
  const data = await fetchJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(q)}?fullText=false`, {}, 6000);
  if (!Array.isArray(data) || !data.length) return null;
  const c = data[0];
  const name = c?.name?.common || q;
  const cap = (c?.capital || []).join(", ") || "—";
  const pop = c?.population != null ? String(c.population) : "—";
  const cur = c?.currencies
    ? Object.entries(c.currencies)
        .map(([k, v]: [string, any]) => `${k} (${v?.name || ""})`)
        .join(", ")
    : "—";
  return `REST COUNTRIES\n${name}: capital ${cap}; population ${pop}; currencies ${cur}\nMore: https://restcountries.com`;
}

export async function fetchPubMed(topic: string): Promise<string | null> {
  const step1 = await fetchJson(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=5&term=${encodeURIComponent(topic)}`,
    {},
    6000
  );
  const ids: string[] = step1?.esearchresult?.idlist || [];
  if (!ids.length) return null;
  const step2 = await fetchJson(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`,
    {},
    6000
  );
  const result = step2?.result;
  if (!result) return null;
  const lines: string[] = [];
  for (const id of ids) {
    const r = result[id];
    if (!r?.title) continue;
    lines.push(`• ${clip(r.title, 200)} — https://pubmed.ncbi.nlm.nih.gov/${id}/`);
  }
  if (!lines.length) return null;
  return `PUBMED\n${lines.join("\n")}`;
}

export async function fetchCrossRef(topic: string): Promise<string | null> {
  const data = await fetchJson(
    `https://api.crossref.org/works?query=${encodeURIComponent(topic)}&rows=5`,
    {},
    6000
  );
  const items = data?.message?.items;
  if (!Array.isArray(items) || !items.length) return null;
  const lines = items.map((it: any) => {
    const title = (it.title && it.title[0]) || "(untitled)";
    const url = it.URL || "";
    return `• ${clip(title, 160)} — ${url}`;
  });
  return `CROSSREF\n${lines.join("\n")}`;
}

export async function fetchOpenLibrary(topic: string): Promise<string | null> {
  const data = await fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(topic)}&limit=5`, {}, 6000);
  const docs = data?.docs;
  if (!Array.isArray(docs) || !docs.length) return null;
  const lines = docs.map((d: any) => {
    const t = d.title || "Book";
    const key = d.key ? `https://openlibrary.org${d.key}` : "https://openlibrary.org";
    return `• ${t}${d.first_publish_year ? ` (${d.first_publish_year})` : ""} — ${key}`;
  });
  return `OPEN LIBRARY\n${lines.join("\n")}`;
}

export async function fetchGitHubRepos(topic: string): Promise<string | null> {
  const data = await fetchJson(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&per_page=5&sort=stars`,
    { headers: { "User-Agent": UA, Accept: "application/vnd.github+json" } },
    6000
  );
  const items = data?.items;
  if (!Array.isArray(items) || !items.length) return null;
  const lines = items.map((r: any) => `• ${r.full_name} (${r.stargazers_count}★) — ${r.html_url}`);
  return `GITHUB REPOS\n${lines.join("\n")}`;
}

export async function fetchDictionary(topic: string): Promise<string | null> {
  const w = dictionaryWord(topic);
  if (!w) return null;
  const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`, {}, 5000);
  if (!Array.isArray(data) || !data[0]?.meanings?.length) return null;
  const defs: string[] = [];
  for (const m of data[0].meanings.slice(0, 2)) {
    const part = m.partOfSpeech || "";
    for (const d of (m.definitions || []).slice(0, 2)) {
      defs.push(`• (${part}) ${clip(d.definition || "", 220)}`);
    }
  }
  if (!defs.length) return null;
  return `DICTIONARY (${w})\n${defs.join("\n")}`;
}

export async function fetchOpenMeteo(topic: string): Promise<string | null> {
  if (!wantsWeather(topic)) return null;
  // Default coords (Mumbai) if user does not specify — prompt tells model to say "example location" or use geocode separately
  const lat = 19.076;
  const lon = 72.8777;
  const lines: string[] = [];

  const owKey = (process.env.OPENWEATHERMAP_API_KEY || process.env.OPENWEATHER_API_KEY || "").trim();
  if (owKey) {
    const ow = await fetchJson(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${encodeURIComponent(owKey)}&units=metric`,
      {},
      6000
    );
    if (ow?.main) {
      lines.push(
        `OPENWEATHER (sample ${lat},${lon}): ${ow.main.temp}°C, feels like ${ow.main.feels_like}°C, ${ow.weather?.[0]?.description || ""} — https://openweathermap.org/`
      );
    }
  }

  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation`,
    {},
    6000
  );
  const cur = data?.current;
  if (cur) {
    lines.push(
      `OPEN-METEO (same sample coords): Temp ${cur.temperature_2m}°C, humidity ${cur.relative_humidity_2m}%, wind ${cur.wind_speed_10m} m/s, precip ${cur.precipitation} — https://open-meteo.com/`
    );
  }
  if (!lines.length) return null;
  return `WEATHER DATA\n${lines.join("\n")}\nIf the user asked for another city, say these numbers are for the sample location only.`;
}

export async function fetchNominatim(topic: string): Promise<string | null> {
  if (!wantsGeo(topic)) return null;
  const q = topic.replace(/^(geocode|coordinates|address of|where is)\s*/i, "").trim() || topic;
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`,
    { headers: { "User-Agent": UA } },
    6000
  );
  if (!Array.isArray(data) || !data.length) return null;
  const lines = data.map((r: any) => `• ${r.display_name} — lat ${r.lat}, lon ${r.lon}`);
  return `NOMINATIM (OpenStreetMap)\n${lines.join("\n")}`;
}

export async function fetchExchangeRates(topic: string): Promise<string | null> {
  if (!wantsFx(topic)) return null;
  const data = await fetchJson("https://open.er-api.com/v6/latest/USD", {}, 6000);
  const rates = data?.rates;
  if (!rates || typeof rates !== "object") return null;
  const eur = rates.EUR != null ? `USD→EUR ${rates.EUR}` : "";
  const gbp = rates.GBP != null ? `USD→GBP ${rates.GBP}` : "";
  const inr = rates.INR != null ? `USD→INR ${rates.INR}` : "";
  return `EXCHANGE RATES (open.er-api.com, USD base)\n${[eur, gbp, inr].filter(Boolean).join("; ")}`;
}

function normalizeSecTickerRows(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

export async function fetchSecCompanyFacts(topic: string): Promise<string | null> {
  if (!wantsSec(topic) && !/\b[A-Z]{2,5}\b/.test(topic)) return null;
  const ticker = extractTicker(topic);
  if (!ticker) return null;
  const tickersJson = await fetchJson("https://www.sec.gov/files/company_tickers.json", { headers: { "User-Agent": SEC_UA } }, 8000);
  if (!tickersJson) return null;
  const entries = normalizeSecTickerRows(tickersJson);
  const row = entries.find((e: any) => String(e?.ticker || "").toUpperCase() === ticker);
  if (!row?.cik_str) return null;
  const cik = String(row.cik_str).padStart(10, "0");
  const sub = await fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: { "User-Agent": SEC_UA } }, 8000);
  if (!sub) return null;
  const name = sub?.name || ticker;
  const recent = sub?.filings?.recent;
  const forms: string[] = recent?.form || [];
  const dates: string[] = recent?.filingDate || [];
  const acc: string[] = recent?.accessionNumber || [];
  const lines: string[] = [];
  for (let i = 0; i < Math.min(5, forms.length); i++) {
    const a = (acc[i] || "").replace(/-/g, "");
    const u = a ? `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${a}/${acc[i]}-index.htm` : "";
    lines.push(`• ${forms[i]} (${dates[i]}) — ${u}`);
  }
  return `SEC EDGAR (${name}, ticker ${ticker}, CIK ${cik})\n${lines.join("\n")}\nFilings index: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=&dateb=&owner=include&count=40`;
}

export async function fetchMyMemoryTranslate(topic: string): Promise<string | null> {
  const m = topic.match(/translate\s+(.+?)\s+to\s+([a-z]{2,20})\b/i);
  if (!m) return null;
  const q = m[1].replace(/^["']|["']$/g, "").trim();
  const target = m[2].toLowerCase();
  if (!q) return null;
  const data = await fetchJson(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|${target}`,
    {},
    6000
  );
  const translated = data?.responseData?.translatedText;
  if (!translated || String(translated).includes("MYMEMORY WARNING")) return null;
  return `MYMEMORY TRANSLATION (en→${target})\nOriginal: ${q}\nTranslated: ${translated}`;
}

export async function fetchGNews(topic: string): Promise<string | null> {
  const key = process.env.GNEWS_API_KEY?.trim();
  if (!key) return null;
  const data = await fetchJson(
    `https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&lang=en&max=8&token=${encodeURIComponent(key)}`,
    {},
    6000
  );
  const articles = data?.articles;
  if (!Array.isArray(articles) || !articles.length) return null;
  const lines = articles.map((a: any) => `• ${clip(a.title || "", 120)} — ${a.url || ""}`);
  return `GNEWS\n${lines.join("\n")}`;
}

/** NewsAPI.org — note: free "developer" tier may only allow localhost; paid/production keys work on Vercel. */
export async function fetchNewsApi(topic: string): Promise<string | null> {
  const key = process.env.NEWSAPI_KEY?.trim();
  if (!key) return null;
  const data = await fetchJson(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&language=en&pageSize=8&sortBy=relevancy&apiKey=${encodeURIComponent(key)}`,
    {},
    6000
  );
  const articles = data?.articles;
  if (!Array.isArray(articles) || !articles.length) return null;
  const lines = articles.map((a: any) => `• ${clip(a.title || "", 140)} — ${a.url || ""}`);
  return `NEWSAPI.ORG\n${lines.join("\n")}`;
}

export async function fetchIpApiHint(clientIp: string | null): Promise<string | null> {
  if (!clientIp || !/^\d{1,3}(\.\d{1,3}){3}$/.test(clientIp.trim())) return null;
  const data = await fetchJson(
    `https://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=status,country,regionName,city,timezone`,
    {},
    5000
  );
  if (data?.status !== "success") return null;
  return `IP GEO (ip-api.com, user IP)\n${data.city}, ${data.regionName}, ${data.country} — TZ ${data.timezone}`;
}

/**
 * Parallel enrichment for research prompts. Safe to call on every request.
 */
export async function gatherResearchEnrichment(topic: string, opts: { clientIp?: string | null } = {}): Promise<{ text: string; meta: EnrichmentMeta }> {
  const tasks: { name: string; run: () => Promise<string | null> }[] = [
    { name: "mymemory", run: () => fetchMyMemoryTranslate(topic) },
    { name: "gnews", run: () => fetchGNews(topic) },
    { name: "newsapi", run: () => fetchNewsApi(topic) },
    { name: "hackernews", run: () => fetchHackerNews(topic) },
    { name: "reddit", run: () => fetchReddit(topic) },
    { name: "github", run: () => fetchGitHubRepos(topic) },
    { name: "crossref", run: () => fetchCrossRef(topic) },
    {
      name: "pubmed",
      run: () => (wantsMedical(topic) ? fetchPubMed(topic) : Promise.resolve(null)),
    },
    { name: "openlibrary", run: () => fetchOpenLibrary(topic) },
    {
      name: "restcountries",
      run: () =>
        /^[A-Za-z\s\-]{2,55}$/.test(topic.trim()) && !/\d/.test(topic) ? fetchRestCountries(topic) : Promise.resolve(null),
    },
    { name: "dictionary", run: () => fetchDictionary(topic) },
    { name: "openmeteo", run: () => fetchOpenMeteo(topic) },
    { name: "nominatim", run: () => fetchNominatim(topic) },
    { name: "fx", run: () => fetchExchangeRates(topic) },
    { name: "sec", run: () => fetchSecCompanyFacts(topic) },
    { name: "ip", run: () => fetchIpApiHint(opts.clientIp ?? null) },
  ];

  const settled = await Promise.all(
    tasks.map(async (t) => {
      try {
        const s = await t.run();
        return { name: t.name, s };
      } catch {
        return { name: t.name, s: null };
      }
    })
  );

  const used: string[] = [];
  const chunks: string[] = [];
  for (const { name, s } of settled) {
    if (s) {
      used.push(name);
      chunks.push(s);
    }
  }

  const combined = chunks.join("\n\n---\n\n");
  return {
    text: combined.slice(0, 14000),
    meta: { sources: used },
  };
}
