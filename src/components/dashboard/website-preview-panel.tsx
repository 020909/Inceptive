"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  Copy,
  Download,
  ExternalLink,
  MonitorPlay,
  Smartphone,
  Tablet,
  Monitor,
  X,
  Check,
  Play,
} from "lucide-react";

type ViewMode = "preview" | "code";
type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export function WebsitePreviewPanel({
  code,
  buildStatusLine,
  onClose,
  onCodeChange,
}: {
  code: string;
  /** Live Council / build status — shown above the iframe */
  buildStatusLine?: string | null;
  onClose: () => void;
  onCodeChange?: (newCode: string) => void;
}) {
  const [view, setView] = useState<ViewMode>("preview");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [editableCode, setEditableCode] = useState(code);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setEditableCode(code);
  }, [code]);

  const refreshPreview = useCallback(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(editableCode);
        doc.close();
      }
    }
  }, [editableCode]);

  useEffect(() => {
    const timer = setTimeout(refreshPreview, 300);
    return () => clearTimeout(timer);
  }, [editableCode, refreshPreview]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editableCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([editableCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInBrowser = () => {
    const blob = new Blob([editableCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="editor-frame flex h-full flex-col overflow-hidden rounded-l-[28px]">
      {/* ── Top Bar: Tabs + Actions + Device Toggles ── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-3 py-2.5 shrink-0"
      >
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === "preview"
                ? "bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
            }`}
          >
            <MonitorPlay size={14} /> Preview
          </button>
          <button
            onClick={() => setView("code")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === "code"
                ? "bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
            }`}
          >
            <Code2 size={14} /> Code
          </button>
        </div>

        {/* Center: Device Toggles (preview mode only) */}
        {view === "preview" && (
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-black/15 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {([
              { mode: "desktop" as DeviceMode, Icon: Monitor },
              { mode: "tablet" as DeviceMode, Icon: Tablet },
              { mode: "mobile" as DeviceMode, Icon: Smartphone },
            ]).map(({ mode, Icon }) => (
              <button
                key={mode}
                onClick={() => setDevice(mode)}
                className={`p-1.5 rounded-md transition-colors ${
                  device === mode
                    ? "bg-[var(--bg-overlay)] text-[var(--fg-primary)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
                }`}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        )}

        {/* Right: Action Buttons + Close */}
        <div className="flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={refreshPreview}
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] text-[var(--fg-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-overlay)] transition-colors shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,245,247,0.22)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-surface)]"
            title="Run Preview"
          >
            <Play size={11} fill="currentColor" />
            Run
          </motion.button>
          <button
            onClick={handleOpenInBrowser}
            className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Download HTML"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title={copied ? "Copied!" : "Copy code"}
          >
            {copied ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
          </button>
          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Close preview"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>

        {buildStatusLine ? (
        <div
          className="shrink-0 border-b border-[var(--border-subtle)] bg-[linear-gradient(90deg,rgba(15,118,110,0.08),rgba(255,255,255,0.03),rgba(0,0,0,0))] px-3 py-2 text-[11px] leading-snug text-[var(--fg-secondary)]"
          role="status"
          aria-live="polite"
        >
          <span className="text-[var(--fg-muted)] font-medium">Status: </span>
          {buildStatusLine}
        </div>
      ) : null}

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === "preview" ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex h-full w-full items-start justify-center overflow-auto bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.16),transparent_24%),linear-gradient(180deg,#0c0c0b,#131312)] p-4"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:26px_26px] opacity-[0.16]" />
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_40px_100px_rgba(0,0,0,0.5)]"
                style={{
                  width: DEVICE_WIDTHS[device],
                  maxWidth: "100%",
                  height: device === "desktop" ? "100%" : "auto",
                  minHeight: device !== "desktop" ? "600px" : undefined,
                }}
              >
                <div className="flex h-9 items-center gap-1.5 border-b border-black/8 bg-[#f2efe8] px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <div className="ml-3 rounded-full bg-black/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-black/45">
                    Live Preview
                  </div>
                </div>
                <iframe
                  ref={iframeRef}
                  title="Website Preview"
                  srcDoc={editableCode}
                  sandbox="allow-scripts allow-modals allow-forms"
                  className="w-full border-none"
                  style={{ height: device === "desktop" ? "100%" : "600px" }}
                />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full"
            >
              <textarea
                value={editableCode}
                onChange={(e) => {
                  setEditableCode(e.target.value);
                  onCodeChange?.(e.target.value);
                }}
                spellCheck={false}
                className="h-full w-full resize-none bg-[#161616] p-4 font-mono text-sm leading-relaxed text-[#d4d4d4] focus:outline-none"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
