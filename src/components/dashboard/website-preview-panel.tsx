"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Code2,
  Copy,
  Download,
  ExternalLink,
  MonitorPlay,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  X,
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
  onClose,
  onCodeChange,
}: {
  code: string;
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
    <div className="flex flex-col h-full bg-[var(--bg-base)] border-l border-[var(--border-subtle)]">
      {/* ── Top Bar: Tabs + Actions + Device Toggles ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
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
          <div className="flex items-center gap-1 bg-[var(--bg-elevated)] rounded-lg p-0.5">
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
          <button
            onClick={refreshPreview}
            className="p-1.5 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleOpenInBrowser}
            className="p-1.5 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Download HTML"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title={copied ? "Copied!" : "Copy code"}
          >
            <Copy size={14} />
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
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden relative">
        {view === "preview" ? (
          <div className="w-full h-full flex items-start justify-center bg-[#0d0d0d] p-4 overflow-auto">
            <div
              className="bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300"
              style={{
                width: DEVICE_WIDTHS[device],
                maxWidth: "100%",
                height: device === "desktop" ? "100%" : "auto",
                minHeight: device !== "desktop" ? "600px" : undefined,
              }}
            >
              <iframe
                ref={iframeRef}
                title="Website Preview"
                srcDoc={editableCode}
                sandbox="allow-scripts allow-modals allow-forms"
                className="w-full border-none"
                style={{ height: device === "desktop" ? "100%" : "600px" }}
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            <textarea
              value={editableCode}
              onChange={(e) => {
                setEditableCode(e.target.value);
                onCodeChange?.(e.target.value);
              }}
              spellCheck={false}
              className="w-full h-full resize-none bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 focus:outline-none leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
