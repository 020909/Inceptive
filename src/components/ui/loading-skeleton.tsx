import React from "react";

interface LoadingCardProps { className?: string; }

export function LoadingCard({ className = "" }: LoadingCardProps) {
  return (
    <div className={`rounded-xl border border-[var(--border-subtle)] p-6 bg-[var(--bg-surface)] ${className}`}>
      <div className="space-y-4">
        <div className="h-4 w-1/3 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-8 w-1/2 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-white/[0.04] animate-pulse" />
      </div>
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] p-4 bg-[var(--bg-surface)]">
          <div className="h-9 w-9 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="h-6 w-16 rounded-full bg-white/[0.04] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => <LoadingCard key={i} />)}
    </div>
  );
}

export function LoadingStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-4 bg-[var(--bg-surface)]">
          <div className="h-3 w-20 rounded bg-white/[0.04] animate-pulse mb-3" />
          <div className="h-9 w-16 rounded bg-white/[0.04] animate-pulse" />
        </div>
      ))}
    </div>
  );
}
