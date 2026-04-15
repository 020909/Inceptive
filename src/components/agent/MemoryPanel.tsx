"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu, Search, Brain, Target, FileText, MessageSquare,
  Calendar, ChevronRight
} from "lucide-react";
import { MemoryItem } from "@/lib/agent-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, React.ReactNode> = {
  preference: <Brain className="w-3.5 h-3.5" />,
  fact: <Target className="w-3.5 h-3.5" />,
  task: <ChevronRight className="w-3.5 h-3.5" />,
  file: <FileText className="w-3.5 h-3.5" />,
  conversation: <MessageSquare className="w-3.5 h-3.5" />,
};

const typeColors: Record<string, string> = {
  preference: "text-[var(--accent)] bg-[var(--accent-soft)]",
  fact: "text-blue-400 bg-blue-400/10",
  task: "text-green-400 bg-green-400/10",
  file: "text-yellow-400 bg-yellow-400/10",
  conversation: "text-pink-400 bg-pink-400/10",
};

type ApiMemoryRecord = {
  id: string;
  content: string;
  created_at: string;
  similarity?: number;
  metadata?: {
    type?: MemoryItem["type"];
    source?: string;
    confidence?: number;
  } | null;
};

function normalizeMemory(record: ApiMemoryRecord): MemoryItem {
  const rawConfidence = Number(record.metadata?.confidence ?? record.similarity ?? 0.82);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.max(0.1, Math.min(1, rawConfidence))
    : 0.82;

  return {
    id: record.id,
    type: record.metadata?.type ?? "conversation",
    content: record.content,
    timestamp: new Date(record.created_at),
    confidence,
    source: record.metadata?.source ?? "memory_store",
  };
}

function MemoryCard({ memory }: { memory: MemoryItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all hover:bg-[var(--background-overlay)]",
        expanded ? "bg-[var(--background-overlay)]" : "bg-transparent",
        "border-[var(--border)]"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center shrink-0",
          typeColors[memory.type]?.split(" ")[1]
        )}>
          <span className={typeColors[memory.type]?.split(" ")[0]}>
            {typeIcons[memory.type]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--foreground-secondary)] line-clamp-2">
            {memory.content}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-[var(--foreground-muted)] capitalize">
              {memory.type}
            </span>
            <span className="text-[10px] text-[var(--foreground-muted)]">
              • {Math.round(memory.confidence * 100)}% confidence
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-[var(--border)]"
        >
          <div className="space-y-2 text-[11px] text-[var(--foreground-tertiary)]">
            <div className="flex justify-between">
              <span>Source</span>
              <span className="text-[var(--foreground-secondary)]">{memory.source}</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span className="text-[var(--foreground-secondary)]">
                {memory.timestamp.toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Confidence Score</span>
              <span className="text-[var(--foreground-secondary)]">{memory.confidence.toFixed(2)}</span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export function MemoryPanel() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) {
      setMemories([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const query = searchQuery.trim();
    const url = query
      ? `/api/memory?q=${encodeURIComponent(query)}&limit=24`
      : "/api/memory?limit=24";

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Could not load memory");
        }
        const items = Array.isArray(data.memories) ? (data.memories as ApiMemoryRecord[]) : [];
        setMemories(items.map(normalizeMemory));
        setError(null);
      } catch (nextError) {
        if ((nextError as Error).name === "AbortError") return;
        setMemories([]);
        setError(nextError instanceof Error ? nextError.message : "Could not load memory");
      } finally {
        setLoading(false);
      }
    }, query ? 220 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery, session?.access_token]);

  const filteredMemories = memories.filter((memory) => (
    !activeFilter || memory.type === activeFilter
  ));

  const memoryStats = {
    total: memories.length,
    byType: memories.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-muted)]" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-2 border-b border-[var(--border)] overflow-x-auto">
        <button
          onClick={() => setActiveFilter(null)}
          className={cn(
            "px-2.5 py-1 text-[10px] rounded-md whitespace-nowrap transition-colors",
            activeFilter === null
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
          )}
        >
          All ({memoryStats.total})
        </button>
        {Object.entries(memoryStats.byType).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            className={cn(
              "px-2.5 py-1 text-[10px] rounded-md whitespace-nowrap transition-colors",
              activeFilter === type
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
            )}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
          </button>
        ))}
      </div>

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[74px] rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center mb-3">
              <Cpu className="w-4 h-4 text-[var(--foreground-muted)]" />
            </div>
            <p className="text-xs text-[var(--foreground-tertiary)]">
              Memory could not be loaded
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              {error}
            </p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center mb-3">
              <Cpu className="w-4 h-4 text-[var(--foreground-muted)]" />
            </div>
            <p className="text-xs text-[var(--foreground-tertiary)]">
              {searchQuery.trim() ? "No memories matched your search" : "No stored memories yet"}
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              {searchQuery.trim()
                ? "Try a broader phrase or clear the search field."
                : "Stored memory appears here after Inceptive captures useful long-term context."}
            </p>
          </div>
        ) : (
          filteredMemories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))
        )}
      </div>

      {/* Memory Stats Footer */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--background-elevated)]">
        <div className="flex items-center justify-between text-[10px] text-[var(--foreground-muted)]">
          <span>{filteredMemories.length} memories</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {memories.length > 0 ? `Last updated: ${memories[0]!.timestamp.toLocaleDateString()}` : "Ready"}
          </span>
        </div>
      </div>
    </div>
  );
}
