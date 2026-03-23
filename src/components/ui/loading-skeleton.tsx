import React from "react";

interface LoadingCardProps { className?: string; }

export function LoadingCard({ className = "" }: LoadingCardProps) {
  return (
    <div className={`rounded-2xl border p-6 ${className}`} style={{ background: "#111111", borderColor: "#222222" }}>
      <div className="space-y-4">
        <div className="h-4 w-1/3 shimmer rounded-lg" />
        <div className="h-8 w-1/2 shimmer rounded-lg" />
        <div className="h-3 w-2/3 shimmer rounded" />
      </div>
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border p-4"
          style={{ background: "#111111", borderColor: "#222222" }}>
          <div className="h-9 w-9 shimmer rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 shimmer rounded" />
            <div className="h-3 w-1/2 shimmer rounded" />
          </div>
          <div className="h-6 w-16 shimmer rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => <LoadingCard key={i} />)}
    </div>
  );
}

export function LoadingStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-5" style={{ background: "#111111", borderColor: "#222222" }}>
          <div className="h-3 w-20 shimmer rounded mb-3" />
          <div className="h-9 w-16 shimmer rounded" />
        </div>
      ))}
    </div>
  );
}
