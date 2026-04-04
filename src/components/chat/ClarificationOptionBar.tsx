"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SOMETHING_ELSE = "Something else";

export type ClarificationOptionBarProps = {
  headline: string;
  /** Server-provided choices only (2–4); "Something else" is always appended in UI */
  choices: string[];
  disabled?: boolean;
  onPickChoice: (label: string) => void;
  onPickSomethingElse: () => void;
  onDismiss?: () => void;
  className?: string;
};

/**
 * Claude-style row above the chat: tap a chip or "Something else" to type in the main input.
 */
export function ClarificationOptionBar({
  headline,
  choices,
  disabled,
  onPickChoice,
  onPickSomethingElse,
  onDismiss,
  className,
}: ClarificationOptionBarProps) {
  const safe = choices.filter((c) => c.trim()).slice(0, 4);
  if (safe.length < 2) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 px-3 py-2.5 shadow-sm",
        className
      )}
      role="region"
      aria-label="Quick choices"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-[var(--fg-primary)] sm:text-[13px]">{headline}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1 text-[var(--fg-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--fg-primary)]"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {safe.map((label) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onPickChoice(label)}
            className={cn(
              "rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-left text-xs font-medium text-[var(--fg-primary)]",
              "transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
              "disabled:pointer-events-none disabled:opacity-45"
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={onPickSomethingElse}
          className={cn(
            "rounded-full border border-dashed border-[var(--border-strong)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--fg-secondary)]",
            "transition-colors hover:border-[var(--accent)] hover:text-[var(--fg-primary)]",
            "disabled:pointer-events-none disabled:opacity-45"
          )}
        >
          {SOMETHING_ELSE}
        </button>
      </div>
    </div>
  );
}

export function focusDashboardChatInput() {
  const el = document.getElementById("inceptive-dashboard-prompt");
  if (el && "focus" in el) {
    (el as HTMLTextAreaElement).focus();
  }
}
