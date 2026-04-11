"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, BrainCog, Globe, Paperclip, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CustomDivider = () => (
  <div className="relative mx-1 h-6 w-px bg-[var(--border-subtle)] opacity-60" aria-hidden />
);

function useAutosizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight: number
) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [ref, value, maxHeight]);
}

export type DashboardAiPromptProps = {
  value: string;
  onChange: (v: string) => void;
  /** Called with optional image file picked inside the box (parent should upload). */
  onSend: (message: string, filesFromBox?: File[]) => void | Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onAttachClick?: () => void;
  dragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  maxTextHeight?: number;
};

export function DashboardAiPrompt({
  value,
  onChange,
  onSend,
  isLoading = false,
  placeholder = "Ask Inceptive anything…",
  className,
  disabled = false,
  onAttachClick,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  maxTextHeight = 240,
}: DashboardAiPromptProps) {
  const [showSearch, setShowSearch] = React.useState(false);
  const [showThink, setShowThink] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  useAutosizeTextarea(textareaRef, value, maxTextHeight);

  const toggleSearch = () => {
    setShowSearch((p) => !p);
    setShowThink(false);
  };
  const toggleThink = () => {
    setShowThink((p) => !p);
    setShowSearch(false);
  };

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const processFile = (file: File) => {
    if (!isImageFile(file)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setFiles([]);
    setFilePreviews({});
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          break;
        }
      }
    }
  };

  const buildMessage = () => {
    let prefix = "";
    if (showSearch) prefix = "[Search: ";
    else if (showThink) prefix = "[Think: ";
    const trimmed = value.trim();
    if (prefix) return `${prefix}${trimmed}]`;
    return trimmed;
  };

  const handleSend = () => {
    const msg = buildMessage();
    if (!msg && files.length === 0) return;
    const toSend = msg || (files.length ? "(see attachment)" : "");
    void onSend(toSend, files.length ? files : undefined);
    onChange("");
    clearFile();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isLoading) handleSend();
    }
  };

  const activeRing = showSearch || showThink ? "ring-1 ring-white/25" : "";
  const hasContent = value.trim() !== "" || files.length > 0;

  return (
    <>
      <div
        className={cn(
          "command-surface w-full rounded-[1.9rem] p-2.5 transition-all duration-300",
          dragOver && "border-[var(--border-strong)] bg-[var(--bg-elevated)]",
          isLoading && "ring-1 ring-[var(--accent)]/20",
          activeRing && "ring-1 ring-white/15",
          className
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          const dropped = Array.from(e.dataTransfer.files).filter(isImageFile);
          if (dropped[0]) {
            e.preventDefault();
            e.stopPropagation();
            processFile(dropped[0]);
            return;
          }
          onDrop?.(e);
        }}
      >
        {/* Plain UI: no glow/gradient rules */}

        {files.length > 0 && filePreviews[files[0]!.name] && (
          <div className="mb-1 flex flex-wrap gap-2 px-1">
            <div className="group relative">
              <button
                type="button"
                className="h-16 w-16 cursor-pointer overflow-hidden rounded-xl border border-[var(--border-subtle)]"
                onClick={() => setLightboxUrl(filePreviews[files[0]!.name]!)}
              >
                <img src={filePreviews[files[0]!.name]} alt={files[0]!.name} className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5"
                onClick={(ev) => {
                  ev.stopPropagation();
                  clearFile();
                }}
              >
                <X className="h-3 w-3 text-[var(--fg-primary)]" />
              </button>
            </div>
          </div>
        )}

        <textarea
          id="inceptive-dashboard-prompt"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || isLoading}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            showSearch ? "Search the web…" : showThink ? "Think deeply…" : placeholder
          }
          className={cn(
            "min-h-[44px] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-base",
            "text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)]",
            "focus-visible:ring-0 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />

        <div className="aurora-divider mt-1 flex items-center justify-between gap-2 px-1 pt-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              title="Attach"
              onClick={() => {
                if (onAttachClick) onAttachClick();
                else uploadInputRef.current?.click();
              }}
              disabled={disabled || isLoading}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] disabled:opacity-50"
            >
              <Paperclip className="h-5 w-5" />
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processFile(f);
                  e.target.value = "";
                }}
              />
            </button>

            <div className="flex min-w-0 items-center pl-1">
              <button
                type="button"
                onClick={toggleSearch}
                className={cn(
                  "flex h-8 items-center gap-1 rounded-full border px-2 py-1 transition-all",
                  showSearch
                    ? "border-[var(--border-strong)] bg-[var(--bg-overlay)] text-[var(--fg-primary)]"
                    : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                )}
              >
                <motion.div
                  animate={{ rotate: showSearch ? 360 : 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 25 }}
                >
                  <Globe className="h-4 w-4" />
                </motion.div>
                <AnimatePresence>
                  {showSearch && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap text-xs text-[var(--fg-primary)]"
                    >
                      Search
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <CustomDivider />

              <button
                type="button"
                onClick={toggleThink}
                className={cn(
                  "flex h-8 items-center gap-1 rounded-full border px-2 py-1 transition-all",
                  showThink
                    ? "border-[var(--border-strong)] bg-[var(--bg-overlay)] text-[var(--fg-primary)]"
                    : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                )}
              >
                <motion.div
                  animate={{ rotate: showThink ? 360 : 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 25 }}
                >
                  <BrainCog className="h-4 w-4" />
                </motion.div>
                <AnimatePresence>
                  {showThink && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap text-xs text-[var(--fg-primary)]"
                    >
                      Think
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title={isLoading ? "Working…" : "Send"}
              disabled={(!hasContent && files.length === 0) || disabled}
              onClick={() => {
                if (isLoading) return;
                handleSend();
              }}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 btn-premium",
                hasContent && !isLoading
                  ? "bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90"
                  : "bg-[var(--bg-elevated)] text-[var(--fg-muted)]",
                isLoading && "animate-pulse"
              )}
            >
              {isLoading ? (
                <Square className="h-4 w-4 fill-current opacity-70" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <button
          type="button"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
        </button>
      )}
    </>
  );
}
