"use client";

import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { redirectToSignIn } from "@/lib/auth-gate";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Plus, X, FileSpreadsheet, Presentation, FileText, Download, Mic, MicOff, Globe, Sparkles, Zap, Search, Eye, Play, Settings, ChevronRight, ChevronDown, PanelLeftClose, PanelLeft, Code2 } from "lucide-react";
import { useChat, type Message, type ToolResult, type TaskLog } from "@/lib/chat-context";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/components/layout/sidebar";
import { DashboardAiPrompt } from "@/components/ui/ai-prompt-box";
import { HtmlPreview } from "@/components/ui/html-preview";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { CouncilActivityTimeline, isCouncilTaskLog } from "@/components/dashboard/CouncilActivityTimeline";
import {
  ClarificationOptionBar,
} from "@/components/chat/ClarificationOptionBar";
import { TTSButton } from "@/components/ui/tts-button";
import { ChartPreview } from "@/components/ui/chart-preview";
import { CouncilProgress } from "@/components/council/CouncilProgress";
import { useCouncil } from "@/hooks/useCouncil";
import { isWebsiteBuildTask } from "@/lib/agent/council-deliverable-refine";
import { bundleSessionCouncilOutputForPreview } from "@/lib/council/bundle-session-preview-html";
import type { Project, ProjectArtifact } from "@/types/database";

/** Lazy-loaded Monaco editor — SSR disabled to avoid window-not-defined errors */
const MonacoEditorPanel = dynamic(
  () => import("@/components/ui/monaco-editor-panel").then((m) => ({ default: m.MonacoEditorPanel })),
  { ssr: false }
);

type AttachedFile = { name: string; content: string };
type WorkspaceProject = Project;
type WorkspaceArtifact = ProjectArtifact;
type ProjectContextPayload = {
  id: string;
  name: string;
  description: string;
  template: string;
  latestArtifactType?: string | null;
  recentArtifacts: Array<{
    title: string;
    type: string;
    summary: string;
  }>;
};

type CouncilResumeClient = {
  task: string;
  accumulatedContext: string;
  contributions: Array<{
    role: string;
    name: string;
    status: string;
    output: string;
    durationMs?: number;
  }>;
};

/** Shown in the website preview panel while the Council build is running */
/** After planner checkpoint, client auto-sends this so the Council continues without a manual “theme” click (second API call). */
const COUNCIL_RESUME_BRIDGE_MESSAGE =
  "Continue the build: editorial direction, warm neutrals or charcoal, distinctive typography, accessible focus states, multi-file HTML/CSS/JS.";

const PREVIEW_LOADING_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Building…</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0A0A;color:#FFFFFF;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Inter,sans-serif;}
.p{animation:o 1.35s ease-in-out infinite}@keyframes o{0%,100%{opacity:.35}50%{opacity:1}}
</style></head><body><div style="text-align:center;max-width:340px;padding:28px"><div class="p" style="font-size:2rem;line-height:1;margin-bottom:14px">◇</div><p style="font-size:14px;line-height:1.55;opacity:.95">Live status appears in the bar above. This view updates when generated HTML arrives.</p></div></body></html>`;

/** Extract the latest non-HTML code block from assistant messages for Monaco display. */
function extractLatestCode(messages: Message[]): { code: string; language: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const match = msg.content.match(
      /```(python|javascript|typescript|go|rust|java|c\+\+|ruby|php|swift|kotlin|bash|r|lua|perl|scala|dart)?\n([\s\S]*?)```/i
    );
    if (match && match[2] && match[2].trim().length > 10) {
      return { code: match[2].trim(), language: (match[1] || "javascript").toLowerCase() };
    }
  }
  return null;
}

/** Open the preview as soon as the user sends a build-style message (do not wait for the model to emit a tool-call). */
function shouldOpenBuildPreviewLoading(text: string): boolean {
  const t = text.toLowerCase().trim();

  // Must be an explicit build intent — starts with or contains a clear action verb + artifact noun
  const BUILD_VERBS = ["build", "create", "make", "generate", "design", "code", "write", "develop", "scaffold"];
  const BUILD_ARTIFACTS = ["website", "web app", "webapp", "landing page", "homepage", "web page", "webpage", "frontend", "full-stack app", "fullstack app", "nextjs app", "react app", "html page", "html file", "ui component", "dashboard app", "saas app"];

  // Must have BOTH a build verb AND a build artifact in the same message
  const hasVerb = BUILD_VERBS.some(v => t.includes(v));
  const hasArtifact = BUILD_ARTIFACTS.some(a => t.includes(a));

  if (hasVerb && hasArtifact) return true;

  // Also trigger on very explicit patterns regardless of verb
  const EXPLICIT_PATTERNS = [
    /\bbuild me (a |an )?(website|web app|landing page|homepage)\b/i,
    /\bcreate (a |an )?(website|web app|landing page|homepage)\b/i,
    /\bmake (a |an )?(website|web app|landing page|homepage)\b/i,
    /\bcode (a |an )?(website|web app|landing page|homepage)\b/i,
  ];

  return EXPLICIT_PATTERNS.some(p => p.test(t));
}

function CollapsedCodeFence({ lang, body }: { lang: string; body: string }) {
  const [open, setOpen] = useState(false);
  const label = lang || "code";
  return (
    <div className="my-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/90 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 text-left text-xs font-medium text-[var(--fg-secondary)] hover:bg-[var(--border-subtle)] transition-colors flex items-center gap-2"
      >
        <span className="text-[var(--fg-muted)]">{open ? "▼" : "▶"}</span>
        <span>Generated {label} — tap to {open ? "hide" : "show"} (chat hides source by default)</span>
      </button>
      {open && (
        <pre className="max-h-[min(70vh,520px)] overflow-auto px-3 pb-3 pt-0 text-[11px] text-[var(--fg-secondary)] border-t border-[var(--border-subtle)] whitespace-pre-wrap break-words">
          {body}
        </pre>
      )}
    </div>
  );
}

function renderAssistantBlocks(content: string, onOpenPreview?: (code: string) => void): React.ReactNode {
  const out: React.ReactNode[] = [];
  const re =
    /```(html|chart|typescript|tsx|ts|javascript|js|jsx|css|json|python|bash|shell|md|vue|svelte|txt|xml|svg)?\r?\n([\s\S]*?)```/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      const text = content.slice(last, m.index);
      if (text.trim()) out.push(<span key={`t-${k++}`} className="whitespace-pre-wrap">{text}</span>);
    }
    const lang = (m[1] || "").toLowerCase();
    const body = m[2];
    if (lang === "html") {
      out.push(<HtmlPreview key={`h-${k++}`} code={body} onOpenSplitScreen={onOpenPreview} />);
    } else if (lang === "chart") {
      out.push(<ChartPreview key={`c-${k++}`} config={body} />);
    } else {
      out.push(<CollapsedCodeFence key={`f-${k++}`} lang={lang || "code"} body={body} />);
    }
    last = re.lastIndex;
  }
  if (last < content.length) {
    const tail = content.slice(last);
    if (tail.trim()) out.push(<span key={`t-${k++}`} className="whitespace-pre-wrap">{tail}</span>);
  }
  return out.length > 0 ? <>{out}</> : content;
}

/**
 * Drag-to-resize handle for the split-screen layout.
 */
function ResizeHandle({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastX.current = e.clientX;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientX - lastX.current;
        lastX.current = ev.clientX;
        onDrag(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onDrag]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group relative flex items-center justify-center w-[6px] cursor-col-resize z-10 hover:bg-[var(--accent-soft)] transition-colors shrink-0"
      title="Drag to resize"
    >
      <div className="w-[2px] h-8 rounded-full bg-[var(--border-default)] group-hover:bg-[var(--accent)] transition-colors" />
    </div>
  );
}

function AsyncImage({ src, alt, onDownload }: { src: string; alt: string; onDownload: (e: React.MouseEvent) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (loaded) return;
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, [loaded]);

  const messages = ["Generating...", "This may take a while...", "Working on it..."];

  return (
    <div className={`mt-3 relative group rounded-xl overflow-hidden border border-[var(--border-subtle)] inline-flex flex-col bg-[var(--bg-elevated)] items-center justify-center ${loaded ? 'w-max' : 'min-w-[280px] min-h-[160px]'}`}>
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-elevated)] z-10 gap-3 p-6 text-center">
          <div className="w-5 h-5 border-2 border-[var(--fg-muted)] border-t-[var(--fg-primary)] rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--fg-secondary)] animate-pulse">{messages[phase]}</p>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`block max-w-[480px] w-auto h-auto max-h-[500px] object-contain transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {loaded && (
        <button 
          onClick={onDownload}
          className="absolute top-2 right-2 p-2 bg-[var(--bg-overlay)]/80 hover:bg-[var(--bg-overlay)] backdrop-blur-md rounded-lg text-[var(--fg-primary)] opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm z-20 border border-[var(--border-subtle)]"
          title="Download Image"
        >
          <Download size={16} />
        </button>
      )}
    </div>
  );
}

function GeneratedFileCard({ result, toolName }: { result: any; toolName: string }) {
  if (!result || result.status !== "success") return null;

  if (toolName === "multiAgentDebate" || toolName === "writeSandboxFiles") {
    const msg = typeof result.message === "string" ? result.message : "";
    const paths: string[] | undefined =
      toolName === "multiAgentDebate" ? result.sandboxFilesWritten : result.paths;
    const title = toolName === "multiAgentDebate" ? "Council run complete" : "Sandbox files updated";
  return (
      <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
        <p className="text-sm font-medium text-[var(--fg-primary)]">{title}</p>
        {msg ? (
          <p className="text-[11px] text-[var(--fg-secondary)] mt-1.5 leading-relaxed whitespace-pre-wrap">
            {msg.length > 900 ? `${msg.slice(0, 900)}…` : msg}
          </p>
        ) : null}
        {Array.isArray(paths) && paths.length > 0 && (
          <p className="text-[10px] text-[var(--fg-muted)] mt-1.5 font-mono truncate" title={paths.join(", ")}>
            {paths.length} file{paths.length === 1 ? "" : "s"}: {paths.slice(0, 4).join(", ")}
            {paths.length > 4 ? "…" : ""}
          </p>
        )}
    </div>
  );
}

  const handleDownloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (result.image) {
      const a = document.createElement("a");
      a.href = result.image.startsWith("data:") ? result.image : `data:image/jpeg;base64,${result.image}`;
      a.download = `generated_image_${Date.now()}.jpeg`;
      a.click();
    }
  };

  const getDocDataUrl = () => {
    let mime = "application/octet-stream";
    if (toolName === "generateExcel") mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (toolName === "generatePowerPoint") mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (toolName === "generatePDF") mime = "application/pdf";
    return result.content.startsWith("data:") ? result.content : `data:${mime};base64,${result.content}`;
  };

  const handlePreviewDoc = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (result.content) {
      const dataUrl = getDocDataUrl();
      // For PDF, we can use the base64 string directly in an iframe or new tab, but for
      // large files a Blob URL is better.
      const arr = dataUrl.split(",");
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const mime = dataUrl.match(/:(.*?);/)?.[1] || "application/octet-stream";
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }
  };

  const handleDownloadDoc = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (result.content) {
      const a = document.createElement("a");
      a.href = getDocDataUrl();
      a.download = result.filename || "download";
      a.click();
    }
  };

  if (toolName === "generateImage") {
    return <AsyncImage src={result.image} alt={result.prompt || "Generated AI image"} onDownload={handleDownloadImage} />;
  }

  // Fallback for Document types (Excel, PPT, PDF)
  let Icon = FileText;
  const title = result.filename || "Document";
  let description = "";

  if (toolName === "generateExcel") {
    Icon = FileSpreadsheet;
    description = `${result.rowCount || 0} rows exported`;
  } else if (toolName === "generatePowerPoint") {
    Icon = Presentation;
    description = `${result.slideCount || 0} slides generated`;
  } else if (toolName === "generatePDF") {
    Icon = FileText;
    description = `${result.pageCount || 1} page document`;
  }

  return (
    <div 
      className="mt-3 flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover-lift cursor-pointer hover:border-[var(--border-default)] transition-colors" 
      onClick={handlePreviewDoc}
      title="Click to preview in new tab"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-lg shrink-0 shadow-sm">
          <Icon size={18} className="text-[var(--fg-primary)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--fg-primary)] truncate max-w-[180px] sm:max-w-[250px] leading-tight">{title}</p>
          <p className="text-[11px] mt-0.5 text-[var(--fg-secondary)] truncate">{description}</p>
        </div>
      </div>
      <button 
        onClick={handleDownloadDoc}
        className="p-2 hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-subtle)] rounded-lg transition-colors text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] shrink-0 shadow-sm"
        title="Download File"
      >
        <Download size={16} />
      </button>
    </div>
  );
}

function isLikelyRawToolArgsJson(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 600) return false;
  if (!t.startsWith("{") || !t.endsWith("}")) return false;
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    if (typeof j !== "object" || j === null) return false;
    const keys = Object.keys(j);
    const toolish = new Set(["location", "symbol", "query", "max", "reason", "url"]);
    return keys.length > 0 && keys.length <= 8 && keys.every((k) => toolish.has(k));
  } catch {
    return false;
  }
}

function GeneratingEllipsis({ className }: { className?: string }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 3), 450);
    return () => clearInterval(id);
  }, []);
  const dots = phase === 0 ? "." : phase === 1 ? ".." : "...";
  return <span className={className}>Generating{dots}</span>;
}

function ChatMessage({
  msg,
  isLastAssistant,
  streaming,
  onOpenPreview,
  onContinue,
}: {
  msg: Message;
  isLastAssistant: boolean;
  streaming: boolean;
  onOpenPreview?: (code: string) => void;
  onContinue?: () => void;
}) {
  const isUser = msg.role === "user";
  const showGenerating =
    !isUser &&
    isLastAssistant &&
    streaming &&
    (!msg.content?.trim() || isLikelyRawToolArgsJson(msg.content));

  const isTimedOut =
    !isUser &&
    isLastAssistant &&
    !streaming &&
    msg.content?.includes("still working — please ask me to continue");

  const councilTrace = (msg.taskLogs || []).some(
    (l) => l.details && typeof l.details === "object" && (l.details as { agentRole?: string }).agentRole
  );
  const nonCouncilTaskLogs = (msg.taskLogs || []).filter((l) => !isCouncilTaskLog(l));

  const renderContent = (content: string) => {
    if (isUser) return content;
    if (!content.trim()) return null;
    return renderAssistantBlocks(content, onOpenPreview);
  };

  return (
      <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] sm:max-w-[80%] ${isUser ? "ml-8" : "mr-8"} w-full`}>
        {!isUser && councilTrace && (
          <CouncilActivityTimeline
            logs={msg.taskLogs || []}
            isStreaming={streaming}
            isLastAssistant={isLastAssistant}
          />
        )}
        {!isUser && nonCouncilTaskLogs.length > 0 && <ProgressIndicator logs={nonCouncilTaskLogs} />}
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap w-full overflow-hidden ${
            isUser
              ? "bg-[var(--fg-primary)] text-[var(--bg-base)] rounded-br-md"
              : "bg-[var(--bg-surface)] text-[var(--fg-primary)] border border-[var(--border-subtle)] rounded-bl-md"
          }`}
        >
          {showGenerating ? (
            <GeneratingEllipsis className="text-[var(--fg-tertiary)]" />
          ) : (
            renderContent(msg.content)
          )}
          {msg.toolResults && msg.toolResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {msg.toolResults.map((tr, idx) => (
                <GeneratedFileCard key={idx} result={tr.result} toolName={tr.toolName} />
              ))}
        </div>
          )}
        </motion.div>
        {!isUser && msg.content && msg.content.length > 20 && !showGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-1 flex items-center gap-1"
          >
            <TTSButton text={msg.content} />
          </motion.div>
        )}
        {isTimedOut && onContinue && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-2 rounded-xl border border-[rgba(232,68,10,0.2)] bg-[var(--accent-soft)] px-4 py-3 flex items-center justify-between gap-3"
          >
            <span className="text-sm text-[var(--fg-primary)]">
              Inceptive hit a time limit. Click to continue where it left off.
            </span>
            <button
              onClick={onContinue}
              className="shrink-0 rounded-lg bg-[var(--fg-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] hover:opacity-80 transition-opacity"
            >
              Continue →
            </button>
          </motion.div>
        )}
          </div>
    </motion.div>
  );
}

function AttachmentChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--fg-secondary)]">
      <span className="truncate max-w-[180px]">{name}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="p-0.5 rounded hover:bg-[var(--bg-overlay)]">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function getRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function artifactIconForType(type: string) {
  switch (type) {
    case "website":
      return Globe;
    case "image":
      return ImageIcon;
    case "powerpoint":
      return Presentation;
    case "excel":
      return FileSpreadsheet;
    case "pdf":
      return FileText;
    default:
      return Sparkles;
  }
}

function summarizePrompt(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 140);
}

function recentUserPrompt(messages: Message[]): string {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim())?.content.trim() || "Untitled artifact";
}

function WorkspaceBar({
  projects,
  activeProjectId,
  onProjectChange,
  artifacts,
  savingArtifact,
}: {
  projects: WorkspaceProject[];
  activeProjectId: string | null;
  onProjectChange: (id: string) => void;
  artifacts: WorkspaceArtifact[];
  savingArtifact: boolean;
}) {
  const activeProject = projects.find((project) => project.id === activeProjectId) || null;

  return (
    <div className="aurora-divider shrink-0 border-b border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">Workspace</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <select
                value={activeProjectId || ""}
                onChange={(e) => onProjectChange(e.target.value)}
                disabled={projects.length === 0}
                className="min-w-[220px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--fg-primary)] outline-none transition-colors focus:border-[var(--accent)]"
              >
                {projects.length === 0 && <option value="">Creating workspace…</option>}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {activeProject && (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-3 py-1 text-[11px] text-[var(--fg-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {activeProject.artifact_count || 0} artifact{activeProject.artifact_count === 1 ? "" : "s"}
                </span>
              )}
              {savingArtifact && (
                <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 text-[11px] text-[var(--fg-primary)]">
                  Saving output…
                </span>
              )}
        </div>
        </div>
          {/* Workspace help text removed (too noisy). */}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {artifacts.length === 0 ? null : (
            artifacts.map((artifact) => {
              const Icon = artifactIconForType(artifact.type);
              return (
                <div
                  key={artifact.id}
                  className="min-w-[210px] rounded-2xl border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2">
                      <Icon size={14} className="text-[var(--fg-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--fg-primary)]">{artifact.title}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        {artifact.type} · {getRelativeTime(artifact.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const REFINE_RECIPES = [
  "Make the hero feel more premium and high-conviction.",
  "Improve typography, spacing, and visual hierarchy.",
  "Add better motion, hover states, and polish.",
  "Make the mobile layout feel deliberate and strong.",
];

function BuildRecipeStrip({
  title,
  recipes,
  onPick,
}: {
  title: string;
  recipes: Array<{ label: string; prompt: string }>;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {recipes.map((recipe) => (
          <button
            key={recipe.label}
            type="button"
            onClick={() => onPick(recipe.prompt)}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]"
          >
            {recipe.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardExperience() {
  const searchParams = useSearchParams();
  const { messages, setMessages, startNewChat, incognito, setIncognito } = useChat();
  const { session } = useAuth();
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar();
  const sidebarWasCollapsedRef = useRef(sidebarCollapsed);
  const hasChat = messages.length > 0;

  const [input, setInput] = useState("");
  const [agentMode, setAgentMode] = useState<"build" | "plan">("build");
  const [streaming, setStreaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [recentArtifacts, setRecentArtifacts] = useState<WorkspaceArtifact[]>([]);
  const [savingArtifact, setSavingArtifact] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<AttachedFile[]>([]);
  const savedArtifactKeysRef = useRef<Set<string>>(new Set());
  const sendLockRef = useRef(false);
  const lastSentRef = useRef<{ text: string; ts: number }>({ text: "", ts: 0 });
  const prefillConsumedRef = useRef(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [monacoCode, setMonacoCode] = useState<string | null>(null);
  const [monacoLanguage, setMonacoLanguage] = useState<string>("javascript");
  /** When true, do not replace preview from streamed ```html (sandbox bundle is authoritative). */
  const preferSandboxPreviewRef = useRef(false);
  const [sandboxPaths, setSandboxPaths] = useState<string[] | null>(null);
  /** Live line from Council / preview stream — shown above the iframe */
  const [previewBuildStatus, setPreviewBuildStatus] = useState<string | null>(null);
  const [isMicListening, setIsMicListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const councilResumeRef = useRef<CouncilResumeClient | null>(null);
  const councilContinueRef = useRef(false);
  /** Prevents double-firing the automatic second request after `8:council_resume`. */
  const councilAutoContinueScheduledRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const sendMessageRef = useRef<
    (text: string, attachments?: AttachedFile[], baseMessages?: Message[]) => Promise<void>
  >(() => Promise.resolve());
  const [clarificationPrompt, setClarificationPrompt] = useState<{
    headline: string;
    choices: string[];
  } | null>(null);
  const orgAccessError = searchParams.get("error");

  // Auto-populate Monaco when code appears in messages
  useEffect(() => {
    const result = extractLatestCode(messages);
    if (result) {
      setMonacoCode(result.code);
      setMonacoLanguage(result.language);
    }
  }, [messages]);

  const getAccessToken = useCallback(() => session?.access_token ?? null, [session?.access_token]);
  const council = useCouncil(getAccessToken);
  const activeProject = projects.find((project) => project.id === activeProjectId) || null;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return [];
      const data = await res.json();
      const nextProjects = (data.projects || []) as WorkspaceProject[];
      setProjects(nextProjects);

      const saved =
        typeof window !== "undefined" ? window.localStorage.getItem("inceptive.activeProjectId") : null;
      const savedStillExists = saved && nextProjects.some((project) => project.id === saved);
      const fallback = nextProjects[0]?.id || null;
      const nextActive = savedStillExists ? saved : fallback;
      setActiveProjectId((current) =>
        current && nextProjects.some((project) => project.id === current) ? current : nextActive
      );
      return nextProjects;
    } catch {
      return [];
    }
  }, []);

  const fetchArtifacts = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/artifacts?project_id=${encodeURIComponent(projectId)}&limit=12`);
      if (!res.ok) return;
      const data = await res.json();
      setRecentArtifacts((data.artifacts || []) as WorkspaceArtifact[]);
    } catch {
      /* ignore */
    }
  }, []);

  const ensureWorkspaceProject = useCallback(
    async (prompt?: string) => {
      if (activeProjectId) return activeProjectId;
      const currentProjects = projects.length > 0 ? projects : await fetchProjects();
      if (currentProjects.length > 0) return currentProjects[0].id;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prompt ? summarizePrompt(prompt).slice(0, 48) : "Workspace",
          description: "Auto-created workspace for generated outputs",
          template: "blank",
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const created = data.project as WorkspaceProject | undefined;
      if (!created?.id) return null;

      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      return created.id;
    },
    [activeProjectId, projects, fetchProjects]
  );

  const persistArtifact = useCallback(
    async (payload: Record<string, unknown>) => {
      const projectId = await ensureWorkspaceProject(
        typeof payload.prompt === "string" ? payload.prompt : undefined
      );
      if (!projectId) return;

      setSavingArtifact(true);
      try {
        const res = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, project_id: projectId }),
        });
        if (!res.ok) return;
        await Promise.all([fetchProjects(), fetchArtifacts(projectId)]);
      } finally {
        setSavingArtifact(false);
      }
    },
    [ensureWorkspaceProject, fetchProjects, fetchArtifacts]
  );

  const buildProjectContext = useCallback((): ProjectContextPayload | null => {
    if (!activeProject) return null;
    return {
      id: activeProject.id,
      name: activeProject.name,
      description: activeProject.description || "",
      template: activeProject.template,
      latestArtifactType: activeProject.latest_artifact_type || null,
      recentArtifacts: recentArtifacts.slice(0, 6).map((artifact) => ({
        title: artifact.title,
        type: artifact.type,
        summary: artifact.summary || "",
      })),
    };
  }, [activeProject, recentArtifacts]);

  useEffect(() => {
    if (messages.length === 0) {
      councilResumeRef.current = null;
      councilContinueRef.current = false;
      councilAutoContinueScheduledRef.current = false;
      setClarificationPrompt(null);
    }
  }, [messages.length]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("inceptive.activeProjectId", activeProjectId);
    }
    void fetchArtifacts(activeProjectId);
  }, [activeProjectId, fetchArtifacts]);

  const startMic = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice input is not supported in this browser. Try Chrome."); return; }
    if (isMicListening) {
      recognitionRef.current?.stop();
      setIsMicListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = () => { setIsMicListening(false); };
    recognition.onend = () => { setIsMicListening(false); };
    recognition.start();
    setIsMicListening(true);
  }, [isMicListening]);

  // Auto-collapse sidebar when preview opens, restore when it closes
  useEffect(() => {
    if (previewCode) {
      sidebarWasCollapsedRef.current = sidebarCollapsed;
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(sidebarWasCollapsedRef.current);
    }
  }, [!!previewCode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (prefillConsumedRef.current) return;
    const prefill = searchParams.get("prefill");
    if (!prefill) return;
    if (input.trim().length > 0) {
      prefillConsumedRef.current = true;
      return;
    }
    prefillConsumedRef.current = true;
    setInput(prefill);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("prefill");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
  }, [searchParams, input]);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  const uploadFiles = useCallback(
    async (files: File[]): Promise<AttachedFile[]> => {
      const token = session?.access_token;
      if (!token || files.length === 0) return [];
      const uploaded: AttachedFile[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        try {
          const res = await fetch("/api/files/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          const preview = data.file?.content_preview || "";
          const url = data.url ? `\nSigned URL: ${data.url}` : "";
          uploaded.push({
            name: file.name,
            content: preview
              ? `[${file.name}]\n${preview}`
              : `Uploaded file: ${file.name} (${file.type || "unknown type"}).${url}`,
          });
        } catch {
          uploaded.push({
            name: file.name,
            content: `Uploaded file: ${file.name}. Content preview unavailable.`,
          });
        }
      }
      setPendingFiles((prev) => {
        const next = [...prev, ...uploaded];
        pendingFilesRef.current = next;
              return next;
            });
      return uploaded;
    },
    [session?.access_token]
  );

  const sendMessage = useCallback(
    async (text: string, attachments?: AttachedFile[], baseMessages?: Message[]) => {
      const attach: AttachedFile[] = attachments ?? pendingFilesRef.current;
      if (!text.trim() || streaming || sendLockRef.current) return;
      const now = Date.now();
      const last = lastSentRef.current;
      if (last.text === text.trim() && now - last.ts < 1200) return;
      sendLockRef.current = true;
      councilAutoContinueScheduledRef.current = false;
      lastSentRef.current = { text: text.trim(), ts: now };
      const token = session?.access_token;
      if (!token) {
        sendLockRef.current = false;
        redirectToSignIn();
        return;
      }

      /** Session-based Council (OpenRouter + Supabase sessions). Runs alongside normal chat; only for website-style builds. */
      if (isWebsiteBuildTask(text.trim())) {
        councilResumeRef.current = null;
        councilContinueRef.current = false;
        councilAutoContinueScheduledRef.current = false;
        setClarificationPrompt(null);

        const userMsg: Message = {
          id: `u_${Date.now()}`,
          role: "user",
          content: text.trim(),
          toolCalls: [],
          toolResults: [],
        };
        const sourceMessages = baseMessages ?? messages;
        const lastMsgInHistory = sourceMessages[sourceMessages.length - 1];
        const allMessages =
          lastMsgInHistory?.role === "user" && lastMsgInHistory.content.trim() === text.trim()
            ? sourceMessages
            : [...sourceMessages, userMsg];
        setMessages(allMessages);
        setInput("");
        setPendingFiles([]);
        pendingFilesRef.current = [];
        setClarificationPrompt(null);
        setStreaming(true);

        if (shouldOpenBuildPreviewLoading(text.trim())) {
          preferSandboxPreviewRef.current = false;
          setSandboxPaths(null);
          setPreviewCode(PREVIEW_LOADING_HTML);
          setPreviewBuildStatus("Council — running specialist chain…");
        }

        const assistantId = `a_${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "", toolCalls: [], toolResults: [] },
        ]);

        try {
          const result = await council.startCouncil(text.trim());
          if (result.ok) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: result.finalOutput } : m
              )
            );
            const bundled = bundleSessionCouncilOutputForPreview(result.finalOutput);
            if (bundled && bundled.length > 80) {
              preferSandboxPreviewRef.current = false;
              setSandboxPaths(null);
              setPreviewCode(bundled);
              setPreviewBuildStatus(null);
            }
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `Council could not finish: ${result.error}` }
                  : m
              )
            );
          }
        } finally {
          setStreaming(false);
          sendLockRef.current = false;
        }
        return;
      }

      if (shouldOpenBuildPreviewLoading(text.trim()) && text.trim().length > 220) {
        councilResumeRef.current = null;
        councilContinueRef.current = false;
        councilAutoContinueScheduledRef.current = false;
        setClarificationPrompt(null);
      }

      const userMsg: Message = {
        id: `u_${Date.now()}`,
        role: "user",
        content: text.trim(),
        toolCalls: [],
        toolResults: [],
      };
      const sourceMessages = baseMessages ?? messages;
      const lastMsgInHistory = sourceMessages[sourceMessages.length - 1];
      const allMessages =
        lastMsgInHistory?.role === "user" && lastMsgInHistory.content.trim() === text.trim()
          ? sourceMessages
          : [...sourceMessages, userMsg];
      setMessages(allMessages);
      setInput("");
      setPendingFiles([]);
      pendingFilesRef.current = [];
      setClarificationPrompt(null);
      setStreaming(true);

      if (shouldOpenBuildPreviewLoading(text.trim())) {
        preferSandboxPreviewRef.current = false;
        setSandboxPaths(null);
        setPreviewCode(PREVIEW_LOADING_HTML);
        setPreviewBuildStatus("Connecting — starting your build…");
      }

      const assistantId = `a_${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", toolCalls: [], toolResults: [] }]);

      let safetyTimer: ReturnType<typeof setTimeout> | undefined;
      const resetSafetyTimer = () => {
        if (safetyTimer) clearTimeout(safetyTimer);
        safetyTimer = setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.content.trim()
                ? { ...m, content: "The connection was lost or timed out. Please try once more." }
                : m
            )
          );
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              setStreaming(false);
              sendLockRef.current = false;
            })
          );
        }, 2_700_000); // 45 min idle — Council steps can be 15–20+ min on free models; heartbeats usually prevent this firing
      };

      resetSafetyTimer();

      try {
        const modePrefix = agentMode === "plan"
          ? "[PLAN MODE — Read-only analysis only. Do NOT execute code, send emails, make API calls, or take any action. Only analyze, explain, and propose what you WOULD do. Always end with a summary of proposed steps.]\n\n"
          : "[BUILD MODE — Full execution enabled. Complete the task end-to-end.]\n\n";

        const messagesWithMode = allMessages.map((m, i) =>
          i === allMessages.length - 1 && m.role === "user"
            ? { ...m, content: modePrefix + m.content }
            : m
        );

        const bodyPayload: Record<string, unknown> = {
          messages: messagesWithMode.map((m) => ({ role: m.role, content: m.content })),
          attachedFiles: attach.map((f) => ({ name: f.name, content: f.content })),
          projectContext: buildProjectContext(),
        };
        if (councilContinueRef.current && councilResumeRef.current) {
          bodyPayload.councilResume = councilResumeRef.current;
          bodyPayload.councilContinue = true;
        }

        const res = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: err.error || "Something went wrong." } : m))
          );
          requestAnimationFrame(() => requestAnimationFrame(() => setStreaming(false)));
          sendLockRef.current = false;
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          requestAnimationFrame(() => requestAnimationFrame(() => setStreaming(false)));
          sendLockRef.current = false;
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let currentToolResults: ToolResult[] = [];
        let currentTaskLogs: TaskLog[] = [];
        // Map toolCallId -> toolName so we can match tool-output-available events
        const toolCallIdToName = new Map<string, string>();

        const applyCouncilResumePayload = (p: {
          task: string;
          accumulatedContext: string;
          contributions: CouncilResumeClient["contributions"];
        }) => {
          councilResumeRef.current = {
            task: p.task,
            accumulatedContext: p.accumulatedContext,
            contributions: p.contributions,
          };
          councilContinueRef.current = true;
          if (councilAutoContinueScheduledRef.current) return;
          councilAutoContinueScheduledRef.current = true;
          window.setTimeout(() => {
            if (!councilContinueRef.current || !councilResumeRef.current) {
              councilAutoContinueScheduledRef.current = false;
              return;
            }
            void sendMessageRef.current(
              COUNCIL_RESUME_BRIDGE_MESSAGE,
              undefined,
              messagesRef.current
            );
          }, 200);
      };

      while (true) {
          resetSafetyTimer();
        const { done, value } = await reader.read();
          if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith("0:")) {
              try {
                const chunk = JSON.parse(line.slice(2));
                fullContent += chunk;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent, toolResults: currentToolResults } : m))
                );
              } catch {
                /* ignore */
              }
            } else if (line.startsWith("1:")) {
              // 1: = tool-call event. Capture toolCallId -> toolName mapping.
              try {
                const tc = JSON.parse(line.slice(2));
                if (tc.toolCallId && tc.toolName) {
                  toolCallIdToName.set(tc.toolCallId, tc.toolName);
                }
                const tn = tc.toolName || "";
                if (tn === "multiAgentDebate" || tn === "writeSandboxFiles") {
                  setPreviewCode(PREVIEW_LOADING_HTML);
                  setPreviewBuildStatus("Running build tools…");
                }
              } catch { /* ignore */ }
            } else if (line.startsWith("5:")) {
              try {
                const u = JSON.parse(line.slice(2)) as {
                  type?: string;
                  state?: string;
                  label?: string;
                };
                if (u.type === "preview" && u.state === "building") {
                  setPreviewCode(PREVIEW_LOADING_HTML);
                  if (typeof u.label === "string" && u.label.trim()) {
                    setPreviewBuildStatus(u.label.trim());
                  }
                }
                if (u.type === "preview" && u.state === "ready") {
                  setPreviewBuildStatus("Loading preview…");
                }
              } catch {
                /* ignore */
              }
            } else if (line.startsWith("6:")) {
              try {
                const payload = JSON.parse(line.slice(2)) as {
                  type?: string;
                  paths?: string[];
                  bundleHtml?: string;
                };
                if (payload.type !== "sandbox-bundle-ready") continue;
                councilResumeRef.current = null;
                councilContinueRef.current = false;
                councilAutoContinueScheduledRef.current = false;
                setClarificationPrompt(null);
                preferSandboxPreviewRef.current = true;
                if (Array.isArray(payload.paths)) setSandboxPaths(payload.paths);
                setPreviewBuildStatus("Loading multi-file sandbox preview…");
                if (typeof payload.bundleHtml === "string" && payload.bundleHtml.trim().length > 0) {
                  setPreviewCode(payload.bundleHtml);
                  setPreviewBuildStatus(null);
                } else {
                  const prevRes = await fetch("/api/agent/sandbox-preview", {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (prevRes.ok) {
                    const html = await prevRes.text();
                    if (html.trim().length > 0) {
                      setPreviewCode(html);
                      setPreviewBuildStatus(null);
                    } else {
                      preferSandboxPreviewRef.current = false;
                      setPreviewBuildStatus("Sandbox updated — empty bundle.");
                    }
                  } else {
                    preferSandboxPreviewRef.current = false;
                    setPreviewBuildStatus("Sandbox saved — could not load preview (try refresh).");
                  }
                }
              } catch {
                preferSandboxPreviewRef.current = false;
              }
            } else if (line.startsWith("2:")) {
              try {
                const tr = JSON.parse(line.slice(2));
                // Resolve toolName from the event itself or from our callId->name map
                const toolName = tr.toolName || toolCallIdToName.get(tr.toolCallId) || "";
                const result = tr.result ?? tr.output;
                // Only capture the generation tools to display custom UI cards
                if (
                  toolName === "generateExcel" ||
                  toolName === "generatePowerPoint" ||
                  toolName === "generatePDF" ||
                  toolName === "generateImage"
                ) {
                  currentToolResults = [...currentToolResults, { toolCallId: tr.toolCallId || Date.now().toString(), toolName, result }];
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, toolResults: currentToolResults } : m))
                  );
                } else if (toolName === "multiAgentDebate" && result && typeof result === "object") {
                  const slim = {
                    status: "success" as const,
                    message: typeof result.message === "string" ? result.message : "",
                    sandboxFilesWritten: Array.isArray(result.sandboxFilesWritten) ? result.sandboxFilesWritten : undefined,
                    agentsUsedCount: Array.isArray(result.agentsUsed) ? result.agentsUsed.length : undefined,
                  };
                  currentToolResults = [
                    ...currentToolResults,
                    { toolCallId: tr.toolCallId || Date.now().toString(), toolName, result: slim },
                  ];
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, toolResults: currentToolResults } : m))
                  );
                } else if (toolName === "writeSandboxFiles" && result && typeof result === "object") {
                  const slim = {
                    status: "success" as const,
                    message: typeof result.message === "string" ? result.message : "",
                    paths: Array.isArray(result.paths) ? result.paths : undefined,
                  };
                  currentToolResults = [
                    ...currentToolResults,
                    { toolCallId: tr.toolCallId || Date.now().toString(), toolName, result: slim },
                  ];
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, toolResults: currentToolResults } : m))
                  );
                }
              } catch {
                /* ignore */
              }
            } else if (line.startsWith("4:")) {
              try {
                const log = JSON.parse(line.slice(2)) as TaskLog;
                currentTaskLogs = [...currentTaskLogs];
                const existingIdx = currentTaskLogs.findIndex(l => l.id === log.id);
                if (existingIdx >= 0) {
                    currentTaskLogs[existingIdx] = { ...currentTaskLogs[existingIdx], ...log };
                } else {
                    currentTaskLogs.push(log);
                }
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, taskLogs: currentTaskLogs } : m))
                );
              } catch {
                /* ignore */
              }
            } else if (line.startsWith("3:")) {
              try {
                const errText = JSON.parse(line.slice(2));
                fullContent += `\n\n⚠️ ${errText}`;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
                );
              } catch {
                /* ignore */
              }
            } else if (line.startsWith("7:")) {
              try {
                const p = JSON.parse(line.slice(2)) as {
                  type?: string;
                  headline?: string;
                  choices?: string[];
                };
                if (p.type === "clarification" && Array.isArray(p.choices) && p.choices.length >= 2) {
                  setClarificationPrompt({
                    headline: typeof p.headline === "string" ? p.headline : "Choose one",
                    choices: p.choices.filter((c) => typeof c === "string" && c.trim()).slice(0, 4),
                  });
                }
              } catch {
                /* ignore */
              }
            } else if (line.startsWith("8:")) {
              try {
                const p = JSON.parse(line.slice(2)) as {
                  type?: string;
                  task?: string;
                  accumulatedContext?: string;
                  contributions?: CouncilResumeClient["contributions"];
                };
                if (
                  p.type === "council_resume" &&
                  typeof p.task === "string" &&
                  typeof p.accumulatedContext === "string" &&
                  Array.isArray(p.contributions)
                ) {
                  applyCouncilResumePayload({
                    task: p.task,
                    accumulatedContext: p.accumulatedContext,
                    contributions: p.contributions,
                  });
                }
              } catch {
                /* ignore */
              }
            }
          }
        }

        // Last protocol line often arrives without a trailing \n; it stays in `buffer` and was never parsed above.
        const tail = buffer.trim();
        if (tail.startsWith("8:")) {
          try {
            const p = JSON.parse(tail.slice(2)) as {
              type?: string;
              task?: string;
              accumulatedContext?: string;
              contributions?: CouncilResumeClient["contributions"];
            };
            if (
              p.type === "council_resume" &&
              typeof p.task === "string" &&
              typeof p.accumulatedContext === "string" &&
              Array.isArray(p.contributions)
            ) {
              applyCouncilResumePayload({
                task: p.task,
                accumulatedContext: p.accumulatedContext,
                contributions: p.contributions,
              });
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content || "Connection error. Please try again." } : m
          )
        );
    } finally {
        clearTimeout(safetyTimer);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setStreaming(false);
            sendLockRef.current = false;
          });
        });
      }
    },
    [messages, session?.access_token, streaming, setMessages, council.startCouncil]
  );

  sendMessageRef.current = sendMessage;

  const onClarificationPick = useCallback(
    (label: string) => {
      void sendMessage(label);
    },
    [sendMessage]
  );

  const onClarificationSomethingElse = useCallback(() => {
    focusDashboardChatInput();
  }, []);

  const onDismissClarification = useCallback(() => {
    councilResumeRef.current = null;
    councilContinueRef.current = false;
    councilAutoContinueScheduledRef.current = false;
    setClarificationPrompt(null);
  }, []);

  const handlePromptSend = useCallback(
    async (text: string, boxFiles?: File[]) => {
      if (streaming || sendLockRef.current) return;
      if (boxFiles?.length) await uploadFiles(boxFiles);
      await sendMessage(text);
    },
    [streaming, uploadFiles, sendMessage]
  );

  // Auto-detect HTML in the latest assistant message — merge CSS for blob preview; skip when sandbox bundle owns the iframe
  useEffect(() => {
    if (preferSandboxPreviewRef.current) return;
    if (streaming) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant?.content) return;
    const bundled = bundleSessionCouncilOutputForPreview(lastAssistant.content);
    if (bundled && bundled.length > 80) {
      setPreviewCode(bundled);
      setPreviewBuildStatus(null);
      return;
    }
    const match = lastAssistant.content.match(/```html\s*\n([\s\S]*?)```/);
    if (match?.[1] && match[1].trim().length > 50) {
      setPreviewCode(match[1].trim());
      setPreviewBuildStatus(null);
    }
  }, [messages, streaming]);

  useEffect(() => {
    const assistants = messages.filter((message) => message.role === "assistant");
    for (const assistant of assistants) {
      for (const toolResult of assistant.toolResults || []) {
        const dedupeKey = `${assistant.id}:${toolResult.toolCallId}:${toolResult.toolName}`;
        if (savedArtifactKeysRef.current.has(dedupeKey)) continue;

        const prompt = recentUserPrompt(messages);
        const result = toolResult.result as Record<string, any> | undefined;
        let payload: Record<string, unknown> | null = null;

        if (toolResult.toolName === "generateImage" && result?.image) {
          payload = {
            type: "image",
            title: summarizePrompt(prompt),
            source: toolResult.toolName,
            summary: "AI-generated image",
            preview_url: String(result.image),
            content_json: {
              prompt: result.prompt || prompt,
              width: result.width || null,
              height: result.height || null,
            },
            metadata: { toolName: toolResult.toolName },
            prompt,
          };
        } else if (toolResult.toolName === "generatePowerPoint" && result?.content) {
          payload = {
            type: "powerpoint",
            title: result.filename || `${summarizePrompt(prompt)}.pptx`,
            source: toolResult.toolName,
            summary: `${result.slideCount || 0} slides generated`,
            file_name: result.filename || null,
            mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            content_json: { base64: result.content, slideCount: result.slideCount || 0 },
            metadata: { toolName: toolResult.toolName },
            prompt,
          };
        } else if (toolResult.toolName === "generateExcel" && result?.content) {
          payload = {
            type: "excel",
            title: result.filename || `${summarizePrompt(prompt)}.xlsx`,
            source: toolResult.toolName,
            summary: `${result.rowCount || 0} rows exported`,
            file_name: result.filename || null,
            mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            content_json: { base64: result.content, rowCount: result.rowCount || 0 },
            metadata: { toolName: toolResult.toolName },
            prompt,
          };
        } else if (toolResult.toolName === "generatePDF" && result?.content) {
          payload = {
            type: "pdf",
            title: result.filename || `${summarizePrompt(prompt)}.pdf`,
            source: toolResult.toolName,
            summary: `${result.pageCount || 1} page document`,
            file_name: result.filename || null,
            mime_type: "application/pdf",
            content_json: { base64: result.content, pageCount: result.pageCount || 1 },
            metadata: { toolName: toolResult.toolName },
            prompt,
          };
        }

        if (!payload) continue;
        savedArtifactKeysRef.current.add(dedupeKey);
        void persistArtifact(payload).catch(() => {
          savedArtifactKeysRef.current.delete(dedupeKey);
        });
      }
    }
  }, [messages, persistArtifact]);

  useEffect(() => {
    if (streaming || !previewCode || previewCode === PREVIEW_LOADING_HTML) return;
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) return;

    const looksLikeWebsite =
      previewCode.includes("<html") ||
      previewCode.includes("<body") ||
      (lastAssistant.toolResults || []).some((toolResult) =>
        ["multiAgentDebate", "writeSandboxFiles"].includes(toolResult.toolName)
      );

    if (!looksLikeWebsite) return;

    const dedupeKey = `website:${lastAssistant.id}:${previewCode.length}`;
    if (savedArtifactKeysRef.current.has(dedupeKey)) return;

    const prompt = recentUserPrompt(messages);
    savedArtifactKeysRef.current.add(dedupeKey);
    void persistArtifact({
      type: "website",
      title: summarizePrompt(prompt),
      source: "dashboard.preview",
      summary: "Generated website/app preview",
      content_text: previewCode,
      content_json: { previewLength: previewCode.length },
      metadata: { assistantId: lastAssistant.id },
      prompt,
    }).catch(() => {
      savedArtifactKeysRef.current.delete(dedupeKey);
    });
  }, [messages, previewCode, streaming, persistArtifact]);

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] overflow-hidden !dark dark:bg-[#1e1e1e]" style={{ colorScheme: 'dark' }}>
      
      {/* ── TOP BAR (40px) ── */}
      <div className="flex items-center justify-between px-3 h-[40px] shrink-0 border-b border-[#2d2d2d] bg-[#1e1e1e]">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#1863dc]" />
            <span className="text-[13px] font-medium text-[#cccccc] tracking-tight">Inceptive</span>
          </div>
          <button 
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className="flex h-6 w-6 items-center justify-center rounded text-[#888888] hover:bg-[#2d2d2d] hover:text-[#cccccc] transition-colors"
          >
            {leftPanelOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
          </button>
        </div>
        
        <div className="flex flex-1 justify-center items-center">
          <span className="text-xs text-[#888888] font-mono">
            {activeProjectId ? "workspace/" + (activeProject?.name || "Code Studio") : "Code Studio"}
          </span>
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-2">
          <button className="flex h-[26px] items-center gap-1.5 rounded-md bg-[#1863dc] px-3 text-[11px] font-medium text-white hover:bg-[#1556c0] transition-colors shadow-sm">
            <Play size={10} className="fill-white" /> Run
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#888888] hover:bg-[#2d2d2d] hover:text-[#cccccc] transition-colors">
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── PANEL 1: LEFT FILE TREE ── */}
        {leftPanelOpen && (
          <div className="w-[200px] shrink-0 flex flex-col bg-[#1e1e1e] border-r border-[#2d2d2d]">
            <div className="px-3 py-2 flex items-center justify-between border-b border-[#2d2d2d]/50">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#888888]">Files</span>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
               <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#cccccc] hover:bg-[#2A2D2E] cursor-pointer transition-colors group">
                 <ChevronDown size={12} className="text-[#888888]" />
                 <span className="font-medium">PROJECT</span>
               </div>
               <div className="mt-1 flex items-center gap-2 px-3 py-1.5 text-[12px] bg-[#37373d] text-[#ffffff] cursor-pointer pl-6 border-l-2 border-[#1863dc]">
                 <Code2 size={13} className="text-[#519aba]" />
                 <span className="font-mono">{monacoLanguage === 'javascript' ? 'index.js' : 'App.tsx'}</span>
               </div>
               <div className="flex items-center justify-center pt-8 px-4 text-center">
                 <p className="text-[10px] text-[#666666] leading-relaxed">
                   Ask Inceptive to generate code or attach files to add them to context.
                 </p>
               </div>
            </div>
          </div>
        )}

        {/* ── PANEL 2: CENTER EDITOR ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          <div className="flex h-9 shrink-0 items-end px-2 bg-[#1e1e1e]">
            {/* Fake tab */}
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] bg-[#1e1e1e] text-[#cccccc] border-t-2 border-[#1863dc] rounded-t-sm max-w-[200px]">
              <Code2 size={13} className="text-[#519aba]" />
              <span className="truncate font-mono">{monacoLanguage === 'javascript' ? 'index.js' : 'App.tsx'}</span>
              <button className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-[#333] rounded">
                <X size={12} className="text-[#888]" />
              </button>
            </div>
            <div className="flex-1 border-b border-[#2d2d2d] mb-[-1px]"></div>
          </div>
          
          <div className="flex-1 relative bg-[#1e1e1e]">
            {monacoCode ? (
              <Suspense fallback={<div className="absolute inset-0 bg-[#1e1e1e] flex items-center justify-center"><GeneratingEllipsis className="text-[#888]" /></div>}>
                <MonacoEditorPanel 
                  code={monacoCode} 
                  language={monacoLanguage} 
                />
              </Suspense>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#555555]">
                <Sparkles size={32} className="mb-4 opacity-50" />
                <p className="text-sm font-medium">Welcome to Code Studio</p>
                <p className="text-xs mt-2 max-w-sm text-center opacity-80 leading-relaxed">
                   The agent writes to this scratchpad automatically. Use the chat on the right to start building.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── PANEL 3: RIGHT CHAT (380px) ── */}
        <div className="w-[380px] shrink-0 flex flex-col bg-[#252526] border-l border-[#2d2d2d]">
          <header className="flex h-[48px] shrink-0 items-center justify-between px-4 border-b border-[#2d2d2d]">
            <span className="text-[13px] font-semibold text-[#cccccc]">Inceptive AI</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void startNewChat()}
                className="flex h-7 items-center gap-1.5 rounded bg-[#333333] px-2.5 text-[11px] font-medium text-[#cccccc] hover:bg-[#444444] transition-colors"
              >
                <Plus size={12} /> New Chat
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col relative">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {!hasChat && (
                <div className="text-center py-6">
                  <h2 className="text-sm font-medium text-[#cccccc]">How can I help?</h2>
                  <p className="text-[11px] text-[#888888] mt-2 px-4 leading-relaxed">
                    I can generate code, analyze context, and build web apps end-to-end. I'll write directly to your editor.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => {
                  const isLastAssistant = i === messages.length - 1 && msg.role === "assistant";
                  return (
                    <ChatMessage
                      key={msg.id}
                      msg={msg}
                      isLastAssistant={isLastAssistant}
                      streaming={streaming}
                      onOpenPreview={(code) => setPreviewCode(code)}
                      onContinue={isLastAssistant ? () => {
                        void sendMessageRef.current("Continue from where you left off. Resume the task and complete it.");
                      } : undefined}
                    />
                  );
              })}
            </div>
          </div>

          <div className="shrink-0 p-4 border-t border-[#333333] bg-[#252526]">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pendingFiles.map((f, idx) => (
                  <AttachmentChip
                    key={`${f.name}-${idx}`}
                    name={f.name}
                    onRemove={() =>
                      setPendingFiles((prev) => {
                        const next = prev.filter((_, i) => i !== idx);
                        pendingFilesRef.current = next;
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            )}
            
            <CouncilProgress
              agents={council.agents}
              currentAgent={council.currentAgent}
              status={council.status}
              finalOutput={council.finalOutput}
              error={council.error}
              onCancel={council.cancel}
            />

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) await uploadFiles(files);
                e.currentTarget.value = "";
              }}
            />

            <div className="rounded-xl border border-[#3c3c3c] bg-[#1e1e1e] p-2 focus-within:border-[#555] transition-colors relative shadow-sm">
              <DashboardAiPrompt
                value={input}
                onChange={setInput}
                onSend={handlePromptSend}
                isLoading={streaming}
                placeholder="Ask Inceptive anything…"
                onAttachClick={() => fileInputRef.current?.click()}
                dragOver={dragOver}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const files = Array.from(e.dataTransfer.files || []);
                  if (files.length > 0) await uploadFiles(files);
                }}
              />
            </div>
            
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#666666] font-mono uppercase tracking-wider">Mode</span>
                <select 
                  value={agentMode} 
                  onChange={(e) => setAgentMode(e.target.value as any)}
                  className="bg-transparent text-[#cccccc] text-[10px] outline-none cursor-pointer font-medium"
                >
                  <option value="build" className="bg-[#1e1e1e]">Build</option>
                  <option value="plan" className="bg-[#1e1e1e]">Plan Only</option>
                </select>
              </div>
              <button
                type="button"
                onClick={startMic}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  isMicListening
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-[#888888] hover:text-[#cccccc] hover:bg-[#333333]'
                }`}
                title="Voice input"
              >
                {isMicListening ? <MicOff size={12} /> : <Mic size={12} />}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[#1e1e1e]" />}>
      <DashboardExperience />
    </Suspense>
  );
}
