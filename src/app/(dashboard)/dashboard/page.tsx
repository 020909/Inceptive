"use client";

import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Code2, FolderUp, Image as ImageIcon, PenLine, Plus, X, FileSpreadsheet, Presentation, FileText, Download } from "lucide-react";
import { useChat, type Message, type ToolResult, type TaskLog } from "@/lib/chat-context";
import { useAuth } from "@/lib/auth-context";
import { InceptiveV0ActionRow } from "@/components/ui/inceptive-v0-chat";
import { DashboardAiPrompt } from "@/components/ui/ai-prompt-box";
import { DashboardCodePanel } from "@/components/dashboard/dashboard-code-panel";
import { HtmlPreview } from "@/components/ui/html-preview";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { WebsitePreviewPanel } from "@/components/dashboard/website-preview-panel";

type AttachedFile = { name: string; content: string };

function GeneratedFileCard({ result, toolName }: { result: any; toolName: string }) {
  if (!result || result.status !== "success") return null;

  let Icon = FileText;
  let bgClass = "bg-zinc-800/40";
  let borderClass = "border-zinc-700/50";
  let title = result.filename || "Document";
  let description = "";

  if (toolName === "generateExcel") {
    Icon = FileSpreadsheet;
    bgClass = "bg-green-900/20";
    borderClass = "border-green-800/40";
    description = `${result.rowCount || 0} rows exported`;
  } else if (toolName === "generatePowerPoint") {
    Icon = Presentation;
    bgClass = "bg-orange-900/20";
    borderClass = "border-orange-800/40";
    description = `${result.slideCount || 0} slides generated`;
  } else if (toolName === "generatePDF") {
    Icon = FileText;
    bgClass = "bg-red-900/20";
    borderClass = "border-red-800/40";
    description = `${result.pageCount || 1} page document`;
  } else if (toolName === "generateImage") {
    Icon = ImageIcon;
    bgClass = "bg-indigo-900/20";
    borderClass = "border-indigo-800/40";
    title = "Generated Image";
    description = result.prompt || "AI generated image";
  }

  const handleDownload = () => {
    if (toolName === "generateImage") {
      if (result.image) {
        const a = document.createElement("a");
        a.href = `data:image/jpeg;base64,${result.image}`;
        a.download = "generated_image.jpg";
        a.click();
      }
    } else if (result.content) {
      let mime = "application/octet-stream";
      if (toolName === "generateExcel") mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (toolName === "generatePowerPoint") mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      if (toolName === "generatePDF") mime = "application/pdf";
      
      const a = document.createElement("a");
      a.href = `data:${mime};base64,${result.content}`;
      a.download = result.filename || "download";
      a.click();
    }
  };

  return (
    <div className={`mt-3 flex items-center justify-between p-3 rounded-xl border ${bgClass} ${borderClass} hover-lift cursor-pointer`} onClick={handleDownload}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-black/20 rounded-lg shrink-0">
          <Icon size={18} className="text-[var(--fg-primary)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--fg-primary)] truncate max-w-[180px] sm:max-w-[250px]">{title}</p>
          <p className="text-xs text-[var(--fg-secondary)] truncate">{description}</p>
        </div>
      </div>
      <button className="p-2 hover:bg-black/20 rounded-lg transition-colors text-[var(--fg-primary)] shrink-0">
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
}: {
  msg: Message;
  isLastAssistant: boolean;
  streaming: boolean;
  onOpenPreview?: (code: string) => void;
}) {
  const isUser = msg.role === "user";
  const showGenerating =
    !isUser &&
    isLastAssistant &&
    streaming &&
    (!msg.content?.trim() || isLikelyRawToolArgsJson(msg.content));

  // Extract HTML blocks to render standard text + the preview sandbox
  const renderContent = (content: string) => {
    if (isUser) return content;
    const parts = content.split(/```html\n([\s\S]*?)\n```/g);
    
    if (parts.length === 1) return content; // No HTML blocks
    
    return parts.map((part, index) => {
      // Every odd index in split with a capture group is the captured group (the code itself)
      if (index % 2 === 1) {
        return <HtmlPreview key={index} code={part} onOpenSplitScreen={onOpenPreview} />;
      }
      return part.trim() ? <span key={index}>{part}</span> : null;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] sm:max-w-[80%] ${isUser ? "ml-8" : "mr-8"} w-full`}>
        {!isUser && msg.taskLogs && msg.taskLogs.length > 0 && <ProgressIndicator logs={msg.taskLogs} />}
        <div
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
        </div>
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

function DashboardExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { messages, setMessages, startNewChat, incognito, setIncognito } = useChat();
  const { session } = useAuth();
  const hasChat = messages.length > 0;

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<AttachedFile[]>([]);
  const sendLockRef = useRef(false);
  const lastSentRef = useRef<{ text: string; ts: number }>({ text: "", ts: 0 });
  const prefillConsumedRef = useRef(false);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

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
      lastSentRef.current = { text: text.trim(), ts: now };
      const token = session?.access_token;
      if (!token) {
        sendLockRef.current = false;
        return;
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
      setStreaming(true);

      const assistantId = `a_${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", toolCalls: [], toolResults: [] }]);

      const safetyTimer = setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content.trim()
              ? { ...m, content: "I hit a timeout while processing this. Please try once more." }
              : m
          )
        );
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setStreaming(false);
            sendLockRef.current = false;
          })
        );
      }, 35000);

      try {
        const res = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            attachedFiles: attach.map((f) => ({ name: f.name, content: f.content })),
          }),
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

        while (true) {
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
            } else if (line.startsWith("2:")) {
              try {
                const tr = JSON.parse(line.slice(2));
                // Only capture the generation tools to display custom UI cards
                if (
                  tr.toolName === "generateExcel" || 
                  tr.toolName === "generatePowerPoint" || 
                  tr.toolName === "generatePDF" || 
                  tr.toolName === "generateImage"
                ) {
                   currentToolResults = [...currentToolResults, { toolCallId: tr.toolCallId || Date.now().toString(), toolName: tr.toolName, result: tr.result || tr.output }];
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
            }
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
    [messages, session, streaming, setMessages]
  );

  const handlePromptSend = useCallback(
    async (text: string, boxFiles?: File[]) => {
      if (streaming || sendLockRef.current) return;
      if (boxFiles?.length) await uploadFiles(boxFiles);
      await sendMessage(text);
    },
    [streaming, uploadFiles, sendMessage]
  );

  const actionItems = [
    { icon: Code2, label: "</> Code", onClick: () => setCodePanelOpen(true) },
    {
      icon: PenLine,
      label: "Write",
      onClick: () =>
        router.push(`/dashboard?prefill=${encodeURIComponent("Help me write ")}`),
    },
    {
      icon: ImageIcon,
      label: "Image",
      onClick: () =>
        router.push(`/dashboard?prefill=${encodeURIComponent("Create or refine an image concept: ")}`),
    },
    { icon: FolderUp, label: "Upload Project", onClick: () => fileInputRef.current?.click() },
  ];

  // Auto-detect HTML code in latest assistant message for split-screen
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant?.content) return;
    const match = lastAssistant.content.match(/```html\n([\s\S]*?)\n```/);
    if (match?.[1] && match[1].length > 50) {
      setPreviewCode(match[1]);
    }
  }, [messages]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-app)] text-[var(--fg-primary)]">
    {/* ── LEFT PANEL (Chat) ── */}
    <div className={`flex flex-col min-h-screen transition-all duration-300 ${previewCode ? 'w-1/2' : 'w-full'}`}>
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 sm:px-6">
        <div className="flex min-w-[120px] items-center gap-2">
          {streaming && <GeneratingEllipsis className="text-xs text-[var(--fg-muted)]" />}
          {incognito && (
            <span className="rounded-full border border-white/20 bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#D8D8E0]">
              Incognito
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startNewChat}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-medium text-black transition-opacity hover:opacity-90"
          >
            <Plus size={14} className="text-black" />
            New chat
          </button>
          <button
            type="button"
            onClick={() => setIncognito(!incognito)}
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-opacity hover:opacity-95",
              incognito
                ? "border-violet-400/70 bg-white ring-1 ring-violet-400/35"
                : "border-black/10 bg-white",
            ].join(" ")}
            title="Incognito: chats are not saved to history or session"
          >
            <Image
              src="/incognito-spy.jpg"
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain"
            />
            <span className="sr-only">Incognito mode</span>
          </button>
        </div>
      </header>

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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!hasChat ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-4 py-10 sm:px-6">
            <div className="mx-auto w-full max-w-4xl">
              <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-[var(--fg-primary)] sm:text-4xl">
                How can I help you today?
              </h1>
              <div className="space-y-3">
                <DashboardCodePanel
                  open={codePanelOpen}
                  onClose={() => setCodePanelOpen(false)}
                  sessionToken={session?.access_token}
                  setMessages={setMessages}
                />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
                <InceptiveV0ActionRow items={actionItems} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
              <div className="mx-auto max-w-4xl pb-4 pt-8 sm:pt-12">
                <div className="space-y-4 pb-4">
                  {messages.map((msg, i) => {
                    const isLast = i === messages.length - 1;
                    const isLastAssistant = isLast && msg.role === "assistant";
                    return (
                      <ChatMessage
                        key={msg.id}
                        msg={msg}
                        isLastAssistant={isLastAssistant}
                        streaming={streaming}
                        onOpenPreview={(code) => setPreviewCode(code)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="shrink-0 bg-[var(--bg-app)] px-4 pt-3 pb-6 sm:px-6">
              <div className="mx-auto w-full max-w-4xl space-y-3">
                <DashboardCodePanel
                  open={codePanelOpen}
                  onClose={() => setCodePanelOpen(false)}
                  sessionToken={session?.access_token}
                  setMessages={setMessages}
                />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
                <InceptiveV0ActionRow items={actionItems} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    {/* ── RIGHT PANEL (Live Preview) ── */}
    {previewCode && (
      <div className="w-1/2 min-h-screen border-l border-[var(--border-subtle)]">
        <WebsitePreviewPanel
          code={previewCode}
          onClose={() => setPreviewCode(null)}
          onCodeChange={(newCode) => setPreviewCode(newCode)}
        />
      </div>
    )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardExperience />
    </Suspense>
  );
}
