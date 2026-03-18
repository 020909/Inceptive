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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border mb-5"
        style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)" }}>
        <Icon className="h-6 w-6 text-[var(--foreground)]" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-[#8E8E93] text-center max-w-xs mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}
          className="rounded-xl px-6 h-10 text-sm font-semibold border-0 transition-opacity hover:opacity-90"
          style={{ background: "var(--foreground)", color: "var(--background)" }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
