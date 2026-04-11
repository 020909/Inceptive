"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  Bot,
  Frown,
  GitBranch,
  Globe,
  LayoutGrid,
  ListChecks,
  Search,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  category: "Workflows" | "Activity" | "Pages";
  icon: string;
};

const iconMap = {
  LayoutGrid,
  ListChecks,
  BarChart2,
  Users,
  Globe,
  Bot,
  GitBranch,
} as const;

const categoryOrder: Array<SearchItem["category"]> = ["Workflows", "Activity", "Pages"];

function iconForName(name: string) {
  return iconMap[name as keyof typeof iconMap] ?? Search;
}

type GlobalSearchProps = {
  /** Matches dashboard header controls (e.g. New chat at h-8). */
  variant?: "default" | "compact";
};

export function GlobalSearch({ variant = "default" }: GlobalSearchProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !currentOrg?.id || !currentOrg.slug || !user?.id) return;

    const controller = new AbortController();

    const load = async () => {
      const response = await fetch(
        `/api/global-search?orgId=${encodeURIComponent(currentOrg.id)}&orgSlug=${encodeURIComponent(currentOrg.slug)}`,
        { signal: controller.signal, cache: "no-store" }
      );
      const json = await response.json().catch(() => ({ workflows: [], activity: [], pages: [] }));
      setItems([...(json.workflows ?? []), ...(json.activity ?? []), ...(json.pages ?? [])]);
    };

    void load();

    return () => controller.abort();
  }, [open, currentOrg?.id, currentOrg?.slug, user?.id]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: ["title", "subtitle", "category"],
        threshold: 0.3,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [items]
  );

  const results = useMemo(() => {
    if (!query.trim()) return items;
    return fuse.search(query).map((result) => result.item);
  }, [fuse, items, query]);

  const groupedResults = useMemo(() => {
    return categoryOrder
      .map((category) => ({
        category,
        items: results.filter((item) => item.category === category),
      }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open || results.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((value) => (value + 1) % results.length);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((value) => (value - 1 + results.length) % results.length);
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const item = results[activeIndex];
        if (!item) return;
        router.push(item.href);
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, open, results, router]);

  const compact = variant === "compact";

  return (
    <>
      <Button
        variant="outline"
        size={compact ? "sm" : "lg"}
        className={cn(
          compact
            ? "h-8 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-medium [&_svg]:size-3.5"
            : "h-10 rounded-xl px-3"
        )}
        onClick={() => setOpen(true)}
      >
        <Search className={compact ? "size-3.5" : undefined} />
        Search
        <span
          className={cn(
            "ml-0.5 rounded-md border border-[var(--border-default)] px-1 py-0.5 text-[var(--fg-muted)]",
            compact ? "text-[10px] leading-none" : "px-1.5 py-0.5 text-[11px]"
          )}
        >
          ⌘K
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[560px] rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-0" showCloseButton={false}>
          <div className="border-b border-[var(--border-subtle)] p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
              <Search size={18} className="text-[var(--fg-muted)]" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search workflows, activity, and pages..."
                className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3">
            {groupedResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                  <Frown size={20} className="text-[var(--fg-muted)]" />
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--fg-primary)]">No results for &quot;{query}&quot;</p>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">Try another keyword or open a different workspace area.</p>
                </div>
              </div>
            ) : (
              groupedResults.map((group) => (
                <div key={group.category} className="mb-4 last:mb-0">
                  <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                    {group.category}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const globalIndex = results.findIndex((result) => result.id === item.id && result.category === item.category);
                      const Icon = iconForName(item.icon);

                      return (
                        <button
                          key={`${item.category}-${item.id}`}
                          type="button"
                          onClick={() => {
                            router.push(item.href);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                            globalIndex === activeIndex
                              ? "bg-[var(--bg-elevated)]"
                              : "hover:bg-[var(--bg-elevated)]"
                          )}
                        >
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
                            <Icon size={17} className="text-[var(--fg-primary)]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--fg-primary)]">{item.title}</p>
                            <p className="mt-1 truncate text-xs text-[var(--fg-muted)]">{item.subtitle}</p>
                          </div>
                          <Badge variant="outline" className="mt-0.5">
                            {item.category}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
