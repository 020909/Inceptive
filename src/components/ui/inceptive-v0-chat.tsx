"use client";

import { useCallback, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowUp, Paperclip, Plus } from "lucide-react";

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

export function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = `${minHeight}px`;
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export function InceptiveV0ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full border transition-colors text-xs font-medium",
        "bg-[var(--bg-surface)] border-[var(--border-subtle)]",
        "text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function InceptiveV0Composer({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  disabled,
  placeholder = "Ask Inceptive anything…",
  onAttachClick,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  onAttachClick?: () => void;
  dragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
        adjustHeight(true);
      }
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          "relative rounded-xl border transition-colors",
          "bg-[var(--bg-surface)] border-[var(--border-subtle)]",
          dragOver && "border-[var(--border-strong)] bg-[var(--bg-elevated)]"
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="overflow-y-auto">
          <Textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              onChange(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "w-full px-4 py-3 resize-none min-h-[60px]",
              "bg-transparent border-none shadow-none",
              "text-[var(--fg-primary)] text-sm",
              "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-[var(--fg-muted)] placeholder:text-sm",
              "disabled:opacity-50"
            )}
            style={{ overflow: "hidden" }}
          />
        </div>

        <div className="flex items-center justify-between p-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAttachClick}
              disabled={disabled}
              className="group p-2 rounded-lg transition-colors flex items-center gap-1 hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              <Paperclip className="w-4 h-4 text-[var(--fg-secondary)]" />
              <span className="text-xs text-[var(--fg-muted)] hidden sm:inline group-hover:text-[var(--fg-secondary)] transition-opacity">
                Attach
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!value.trim() || disabled}
              className={cn(
                "p-2 rounded-lg text-sm transition-colors border flex items-center justify-center",
                "border-[var(--border-subtle)]",
                value.trim() && !disabled
                  ? "bg-[var(--fg-primary)] text-[var(--bg-base)] border-transparent"
                  : "text-[var(--fg-muted)] bg-[var(--bg-elevated)]"
              )}
              aria-label="Send"
            >
              <ArrowUp className={cn("w-4 h-4", value.trim() && !disabled ? "text-[var(--bg-base)]" : "")} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InceptiveV0ActionRow({
  items,
}: {
  items: { icon: LucideIcon; label: string; onClick: () => void }[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4">
      {items.map(({ icon: Icon, label, onClick }) => (
        <InceptiveV0ActionButton
          key={label}
          icon={<Icon className="w-4 h-4 shrink-0" />}
          label={label}
          onClick={onClick}
        />
      ))}
    </div>
  );
}
