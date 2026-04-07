"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu, Search, Trash2, Brain, Target, FileText, MessageSquare,
  Calendar, ChevronRight
} from "lucide-react";
import { MemoryItem } from "@/lib/agent-context";
import { cn } from "@/lib/utils";

// Demo memories - replace with real data
const demoMemories: MemoryItem[] = [
  {
    id: "1",
    type: "preference",
    content: "User prefers concise responses with bullet points",
    timestamp: new Date(Date.now() - 86400000 * 2),
    confidence: 0.95,
    source: "conversation_pattern",
  },
  {
    id: "2",
    type: "fact",
    content: "Company is building AI agent platform called Inceptive",
    timestamp: new Date(Date.now() - 86400000 * 5),
    confidence: 1.0,
    source: "user_statement",
  },
  {
    id: "3",
    type: "task",
    content: "Research competitors: Manus, OpenClaw, Perplexity Computer",
    timestamp: new Date(Date.now() - 86400000),
    confidence: 0.9,
    source: "task_completion",
  },
  {
    id: "4",
    type: "file",
    content: "Created market_analysis.md with TAM calculations",
    timestamp: new Date(Date.now() - 3600000),
    confidence: 1.0,
    source: "file_operation",
  },
];

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
          <div className="flex justify-end gap-1 mt-3">
            <button className="p-1.5 hover:bg-[var(--background)] rounded transition-colors">
              <Trash2 className="w-3.5 h-3.5 text-[var(--foreground-muted)]" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export function MemoryPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredMemories = demoMemories.filter((memory) => {
    const matchesSearch = memory.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !activeFilter || memory.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const memoryStats = {
    total: demoMemories.length,
    byType: demoMemories.reduce((acc, m) => {
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
        {filteredMemories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center mb-3">
              <Cpu className="w-4 h-4 text-[var(--foreground-muted)]" />
            </div>
            <p className="text-xs text-[var(--foreground-tertiary)]">
              No memories yet
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              Agent will learn from your interactions
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
            Last updated: {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
