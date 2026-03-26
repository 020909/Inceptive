import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] mb-4">
        <Icon className="h-5 w-5 text-[var(--fg-tertiary)]" />
      </div>
      <h3 className="text-sm font-medium text-[var(--fg-primary)] mb-1">{title}</h3>
      <p className="text-[13px] text-[var(--fg-muted)] text-center max-w-xs mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}
          className="rounded-lg px-5 h-9 text-sm font-medium bg-[var(--fg-primary)] text-[var(--bg-base)] hover:bg-white/90 border-0">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
