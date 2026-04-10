"use client";

import React, { useState } from "react";
import { Code2, Maximize2, MonitorPlay } from "lucide-react";

export function HtmlPreview({
  code,
  onOpenSplitScreen,
}: {
  code: string;
  onOpenSplitScreen?: (code: string) => void;
}) {
  const [view, setView] = useState<"code" | "preview">("preview");

  return (
    <div className="my-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col max-w-full">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 shrink-0">
        <button
          onClick={() => setView("preview")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === "preview" 
              ? "bg-[var(--bg-overlay)] text-[var(--fg-primary)]" 
              : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
          }`}
        >
          <MonitorPlay size={16} /> Preview
        </button>
        <button
          onClick={() => setView("code")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === "code" 
              ? "bg-[var(--bg-overlay)] text-[var(--fg-primary)]" 
              : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
          }`}
        >
          <Code2 size={16} /> Code
        </button>
        {onOpenSplitScreen && (
          <button
            onClick={() => onOpenSplitScreen(code)}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
            title="Open in split-screen"
          >
            <Maximize2 size={14} /> Expand
          </button>
        )}
      </div>
      <div className="relative w-full">
        {view === "preview" ? (
          <div className="bg-[var(--bg-elevated)] rounded-b-xl overflow-hidden">
            <iframe
              title="HTML Preview"
              srcDoc={code}
              sandbox="allow-scripts allow-modals"
              className="w-full h-[400px] border-none"
            />
          </div>
        ) : (
          <div className="bg-[#1e1e1e] p-4 text-sm text-[var(--fg-primary)] overflow-auto h-[400px] font-mono whitespace-pre text-left rounded-b-xl">
            <code>{code}</code>
          </div>
        )}
      </div>
    </div>
  );
}
