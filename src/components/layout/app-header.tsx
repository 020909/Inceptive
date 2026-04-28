"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebarTrigger } from "@/components/layout/app-sidebar";
import { CommandPalette, useCommandPalette } from "@/components/layout/command-palette";

export function AppHeader() {
  const { open, setOpen } = useCommandPalette();

  return (
    <>
      <header
        className={cn(
          "h-14 shrink-0",
          "border-b border-[var(--border-subtle)]",
          "bg-[var(--bg-elevated)]"
        )}
      >
        <div className="flex h-full items-center gap-3 px-3">
          <AppSidebarTrigger />

          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex h-9 flex-1 items-center gap-2 rounded-lg",
              "border border-[var(--border-subtle)] bg-[var(--surface-container)]",
              "px-3 text-left text-[13px] font-semibold text-[var(--fg-muted)]",
              "hover:border-[var(--border-strong)] transition-colors duration-150"
            )}
          >
            <Search className="size-4 text-[var(--fg-muted)]" />
            <span className="flex-1 truncate">Search or navigate…</span>
            <span className="text-[11px] font-semibold text-[var(--fg-muted)] tabular-nums">⌘K</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold text-[var(--fg-muted)]">
            <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-container)] px-2 py-1">
              Foundry Black
            </span>
          </div>
        </div>
      </header>

      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

