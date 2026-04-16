"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Mail,
  FileText,
  Globe,
  Folder,
  Clock,
  Sparkles,
  Loader2,
  X,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn, formatTimeAgo } from "@/lib/utils";

type SearchResult = {
  id: string;
  type: "email" | "research" | "project" | "web";
  title: string;
  snippet: string;
  source: string;
  timestamp?: string;
  url?: string;
};

type ActiveFilter = "all" | "emails" | "research" | "projects" | "web";

type ConnectedSources = {
  gmail: boolean;
  github: boolean;
};

const RECENT_SEARCHES_KEY = "inceptive.recentSearches";

const FALLBACK_SNIPPET =
  "No indexed results yet — connect your tools in Connectors to enable deep search.";

const EMPTY_SOURCES: ConnectedSources = {
  gmail: false,
  github: false,
};

function createFallbackResults(query: string): SearchResult[] {
  const safeQuery = query.trim() || "your workspace";

  return [
    {
      id: `fallback-email-${safeQuery}`,
      type: "email",
      title: "No indexed email results yet",
      snippet: FALLBACK_SNIPPET,
      source: "Gmail",
    },
    {
      id: `fallback-project-${safeQuery}`,
      type: "project",
      title: "Projects are ready to be searched once indexed",
      snippet: FALLBACK_SNIPPET,
      source: "Projects",
    },
    {
      id: `fallback-web-${safeQuery}`,
      type: "web",
      title: "Web search is available, but no structured enterprise matches were returned",
      snippet: FALLBACK_SNIPPET,
      source: "Connectors",
    },
  ];
}

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 7) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(searches: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, 7)));
  } catch {
    // Ignore local storage failures and keep the page usable.
  }
}

function extractJsonArrayText(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

function normalizeResult(raw: unknown, index: number): SearchResult | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const type = item.type;
  const normalizedType: SearchResult["type"] =
    type === "email" || type === "research" || type === "project" || type === "web" ? type : "web";
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const snippet = typeof item.snippet === "string" ? item.snippet.trim() : "";
  const source = typeof item.source === "string" ? item.source.trim() : "";

  if (!title || !snippet || !source) return null;

  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : `${normalizedType}-${index}`,
    type: normalizedType,
    title,
    snippet,
    source,
    timestamp: typeof item.timestamp === "string" ? item.timestamp : undefined,
    url: typeof item.url === "string" ? item.url : undefined,
  };
}

function parseSearchResults(content: string): SearchResult[] | null {
  const jsonArrayText = extractJsonArrayText(content);
  if (!jsonArrayText) return null;

  try {
    const parsed = JSON.parse(jsonArrayText);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .map((item, index) => normalizeResult(item, index))
      .filter((item): item is SearchResult => item !== null);
  } catch {
    return null;
  }
}

async function readAgentStreamResponse(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      if (!line.startsWith("0:")) continue;

      try {
        const chunk = JSON.parse(line.slice(2));
        if (typeof chunk === "string") {
          fullContent += chunk;
        }
      } catch {
        // Ignore malformed stream chunks and keep reading.
      }
    }
  }

  if (buffer.startsWith("0:")) {
    try {
      const chunk = JSON.parse(buffer.slice(2));
      if (typeof chunk === "string") {
        fullContent += chunk;
      }
    } catch {
      // Ignore trailing malformed chunk.
    }
  }

  return fullContent;
}

function SourceStatusRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--fg-secondary)]">{label}</span>
      <span className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", connected ? "bg-[var(--success)]" : "bg-[var(--border-default)]")} />
        <span className={cn("text-xs", connected ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]")}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </span>
    </div>
  );
}

export default function SearchPage() {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState("");
  const [connectedSources, setConnectedSources] = useState<ConnectedSources>(EMPTY_SOURCES);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  const loadConnectedSources = useCallback(async () => {
    if (!session?.access_token) {
      setConnectedSources(EMPTY_SOURCES);
      return;
    }

    try {
      const response = await fetch("/api/connectors", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => ({ accounts: [] }));
      if (!response.ok) throw new Error(payload.error || "Could not load search sources");

      const providers = new Set<string>(
        Array.isArray(payload.accounts)
          ? payload.accounts
              .map((account: { provider?: string }) => account.provider)
              .filter((provider: string | undefined): provider is string => typeof provider === "string")
          : [],
      );

      setConnectedSources({
        gmail: providers.has("gmail"),
        github: providers.has("github"),
      });
    } catch {
      setConnectedSources(EMPTY_SOURCES);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadConnectedSources();
  }, [loadConnectedSources]);

  const updateRecentSearches = useCallback((searchText: string) => {
    setRecentSearches((current) => {
      const trimmed = searchText.trim();
      const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 7);
      writeRecentSearches(next);
      return next;
    });
  }, []);

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const nextQuery = (overrideQuery ?? query).trim();
      if (nextQuery.length <= 2) return;

      setIsSearching(true);
      setLastSubmittedQuery(nextQuery);

      try {
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Enterprise search query: "${nextQuery}". Search across: web (searchWeb tool), research reports, and return structured results. For each result return: title, snippet (2 sentences max), source name, and type (email/research/project/web). Format as JSON array.`,
              },
            ],
            attachedFiles: [],
          }),
        });

        if (!response.ok) {
          setResults(createFallbackResults(nextQuery));
          updateRecentSearches(nextQuery);
          return;
        }

        const streamedText = await readAgentStreamResponse(response);
        const parsedResults = parseSearchResults(streamedText);

        if (parsedResults) {
          setResults(parsedResults);
        } else {
          setResults(createFallbackResults(nextQuery));
        }

        updateRecentSearches(nextQuery);
      } catch {
        setResults(createFallbackResults(nextQuery));
        updateRecentSearches(nextQuery);
      } finally {
        setIsSearching(false);
      }
    },
    [query, session?.access_token, updateRecentSearches],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setLastSubmittedQuery("");
    setActiveFilter("all");
    setIsSearching(false);
  }, []);

  const handleKeyDown = useCallback(
    async (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      await runSearch();
    },
    [runSearch],
  );

  const handleRecentSearchClick = useCallback(
    async (recentQuery: string) => {
      setQuery(recentQuery);
      await runSearch(recentQuery);
    },
    [runSearch],
  );

  const visibleResults = results.filter((result) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "emails") return result.type === "email";
    if (activeFilter === "research") return result.type === "research";
    if (activeFilter === "projects") return result.type === "project";
    return result.type === "web";
  });

  const showFilterPills = results.length > 0 || query.trim().length > 0;
  const hasSearchContext = results.length > 0 || lastSubmittedQuery.length > 0 || query.trim().length > 0;

  return (
    <div className="page-frame max-w-[72rem] animate-fade-in-up">
      <div className="xl:flex xl:items-start xl:gap-8 mt-2">
        <div className="min-w-0 flex-1">
          <div className={cn("transition-all duration-300", hasSearchContext ? "mx-0 max-w-3xl" : "mx-auto max-w-3xl")}>
            <div role="search" className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-3">
                <Search size={18} className="shrink-0 text-[var(--fg-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search emails, reports, projects, documents..."
                  className="w-full bg-transparent px-1 py-4 text-lg text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-muted)]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2.5 text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-primary)]"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  className="rounded-xl bg-[var(--accent)] p-2.5 text-white transition-transform duration-200 hover:scale-[1.02]"
                  aria-label="Search"
                >
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
            </div>

            {query.length === 0 && recentSearches.length > 0 ? (
              <div className="mt-4 mb-2">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">Recent searches</p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((recentQuery) => (
                    <button
                      key={recentQuery}
                      type="button"
                      onClick={() => void handleRecentSearchClick(recentQuery)}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
                    >
                      <Clock size={13} />
                      {recentQuery}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {showFilterPills ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: "All", value: "all" },
                  { label: "Emails", value: "emails" },
                  { label: "Research", value: "research" },
                  { label: "Projects", value: "projects" },
                  { label: "Web", value: "web" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value as ActiveFilter)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all",
                      activeFilter === filter.value
                        ? "border border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--fg-primary)]"
                        : "border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-8">
            {(isSearching || results.length > 0) && (
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                <Sparkles size={12} />
                AI-ranked results
              </div>
            )}

            {isSearching ? (
              <div>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="skeleton h-20 rounded-xl mb-3" />
                ))}
              </div>
            ) : null}

            {!isSearching && visibleResults.length > 0
              ? visibleResults.map((result, index) => {
                  const iconConfig = {
                    email: {
                      icon: Mail,
                      circleClassName: "bg-[rgba(245,165,36,0.14)] text-[var(--accent)]",
                    },
                    research: {
                      icon: FileText,
                      circleClassName: "bg-[rgba(59,130,246,0.14)] text-[#7cb7ff]",
                    },
                    project: {
                      icon: Folder,
                      circleClassName: "bg-[rgba(168,85,247,0.14)] text-[#d7a9ff]",
                    },
                    web: {
                      icon: Globe,
                      circleClassName: "bg-[rgba(52,199,89,0.14)] text-[var(--success)]",
                    },
                  }[result.type];

                  const ResultIcon = iconConfig.icon;

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      onClick={() => {
                        if (result.url) {
                          window.open(result.url, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-3 cursor-pointer hover:border-[var(--border-strong)] transition-all card-hover"
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", iconConfig.circleClassName)}>
                          <ResultIcon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-[var(--fg-primary)]">{result.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)]">{result.snippet}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                            <span>{result.source}</span>
                            {result.timestamp ? (
                              <>
                                <span className="h-1 w-1 rounded-full bg-[var(--fg-muted)]" />
                                <span>{formatTimeAgo(new Date(result.timestamp))}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-[var(--fg-muted)]" />
                      </div>
                    </motion.div>
                  );
                })
              : null}

            {!isSearching && lastSubmittedQuery && results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-8 text-center">
                <p className="text-[var(--fg-primary)]">No results found for &quot;{lastSubmittedQuery}&quot;.</p>
                <p className="mt-2 text-sm text-[var(--fg-muted)]">
                  Try connecting more tools in Connectors.
                </p>
              </div>
            ) : null}

            {!isSearching && lastSubmittedQuery && results.length > 0 && visibleResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-8 text-center">
                <p className="text-[var(--fg-primary)]">No {activeFilter} results found for &quot;{lastSubmittedQuery}&quot;.</p>
                <p className="mt-2 text-sm text-[var(--fg-muted)]">
                  Try another filter or connect more tools in Connectors.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="mt-8 w-full xl:mt-0 xl:w-72 xl:shrink-0">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
            <p className="text-sm font-semibold text-[var(--fg-primary)]">Search Sources</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Enterprise search gets stronger as you connect more systems.
            </p>

            <div className="mt-5 space-y-3">
              <SourceStatusRow label="Gmail" connected={connectedSources.gmail} />
              <SourceStatusRow label="GitHub" connected={connectedSources.github} />
              <SourceStatusRow label="Research Reports" connected />
              <SourceStatusRow label="Projects" connected />
              <SourceStatusRow label="Web" connected />
            </div>

            <Link
              href="/social"
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-[var(--fg-primary)] transition-colors hover:text-[var(--accent)]"
            >
              Connect more sources
              <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
