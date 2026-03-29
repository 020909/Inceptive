'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Search, Bot, Sparkles, ArrowUp, Loader2, FileText, Target, Send as SendIcon, Plus, Paperclip, X } from 'lucide-react';
import { useChat, type Message } from '@/lib/chat-context';
import { useAuth } from '@/lib/auth-context';

type AttachedFile = { name: string; content: string };
const PENDING_FILES_SESSION_KEY = "inceptive_pending_files";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <p className="text-[11px] text-[var(--fg-tertiary)] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-muted)] mt-1">{sub}</p>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, description, href }: {
  icon: any; label: string; description: string; href: string;
}) {
  const router = useRouter();
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push(href)}
      className="group relative p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] text-left w-full transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-secondary)]">
          <Icon size={16} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--fg-primary)] font-medium text-sm mb-0.5">{label}</p>
          <p className="text-[var(--fg-tertiary)] text-xs">{description}</p>
        </div>
        <ArrowRight size={14} className="text-[var(--fg-muted)] group-hover:text-[var(--fg-tertiary)] transition-colors mt-1 shrink-0" />
      </div>
    </motion.button>
  );
}

/** Model sometimes echoed tool JSON before the stream fix — hide it while streaming */
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
}: {
  msg: Message;
  isLastAssistant: boolean;
  streaming: boolean;
}) {
  const isUser = msg.role === "user";
  const showGenerating =
    !isUser &&
    isLastAssistant &&
    streaming &&
    (!msg.content?.trim() || isLikelyRawToolArgsJson(msg.content));
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[80%] ${isUser ? "ml-12" : "mr-12"}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[var(--fg-primary)] text-[var(--bg-base)] rounded-br-md"
            : "bg-[var(--bg-surface)] text-[var(--fg-primary)] border border-[var(--border-subtle)] rounded-bl-md"
        }`}>
          {showGenerating ? (
            <GeneratingEllipsis className="text-[var(--fg-tertiary)]" />
          ) : (
            msg.content
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AttachmentChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--fg-secondary)]">
      <Paperclip size={11} />
      <span className="truncate max-w-[180px]">{name}</span>
      {onRemove && (
        <button onClick={onRemove} className="p-0.5 rounded hover:bg-[var(--bg-overlay)]">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function ChatView() {
  const { messages, setMessages, startNewChat } = useChat();
  const { session } = useAuth();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendLockRef = useRef(false);
  const lastSentRef = useRef<{ text: string; ts: number }>({ text: "", ts: 0 });
  const autoResizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const lineHeight = 24;
    const maxHeight = lineHeight * 5;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    autoResizeTextarea(inputRef.current);
  }, [input, autoResizeTextarea]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const token = session?.access_token;
    if (!token || files.length === 0) return;
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
    setPendingFiles((prev) => [...prev, ...uploaded]);
  }, [session?.access_token]);

  const sendMessage = useCallback(async (
    text: string,
    attachments: AttachedFile[] = pendingFiles,
    baseMessages?: Message[]
  ) => {
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

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text.trim(), toolCalls: [], toolResults: [] };
    const sourceMessages = baseMessages ?? messages;
    const lastMsgInHistory = sourceMessages[sourceMessages.length - 1];
    const allMessages =
      lastMsgInHistory?.role === "user" && lastMsgInHistory.content.trim() === text.trim()
        ? sourceMessages
        : [...sourceMessages, userMsg];
    setMessages(allMessages);
    setInput('');
    setPendingFiles([]);
    setStreaming(true);

    const assistantId = `a_${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", toolCalls: [], toolResults: [] }]);
    const safetyTimer = setTimeout(() => {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId && !m.content.trim()
            ? { ...m, content: "I hit a timeout while processing this. Please try once more." }
            : m
        )
      );
      setStreaming(false);
      sendLockRef.current = false;
    }, 35000);

    try {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          attachedFiles: attachments.map((f) => ({ name: f.name, content: f.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: err.error || "Something went wrong." } : m));
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setStreaming(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // Stream protocol: 0=text, 1=tool-call, 2=tool-result, 3=error, 4=task-log
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2));
              fullContent += text;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
            } catch {}
          } else if (line.startsWith('1:')) {
            /* tool-call: do not surface tool names in the UI */
          } else if (line.startsWith('3:')) {
            try {
              const errText = JSON.parse(line.slice(2));
              fullContent += `\n\n⚠️ ${errText}`;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
            } catch {}
          } else if (line.startsWith('4:')) {
            /* task log — ignore for chat UI */
          }
        }
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content || "Connection error. Please try again." } : m));
    } finally {
      clearTimeout(safetyTimer);
      setStreaming(false);
      sendLockRef.current = false;
    }
  }, [messages, session, streaming, setMessages, pendingFiles]);

  const handleSubmit = () => { sendMessage(input); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) await uploadFiles(files);
  };

  // Auto-trigger: if there's a single user message with no assistant reply, stream it
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current || streaming) return;
    if (messages.length === 1 && messages[0].role === "user") {
      triggered.current = true;
      const text = messages[0].content;
      // HeroView already placed a user message. We clear it so sendMessage can rebuild
      // the full exchange, and we pass attachments from sessionStorage.
      setMessages([]);
      let attachmentsFromStorage: AttachedFile[] = [];
      try {
        const raw = sessionStorage.getItem(PENDING_FILES_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) attachmentsFromStorage = parsed as AttachedFile[];
        }
      } catch {
        // ignore
      } finally {
        try {
          sessionStorage.removeItem(PENDING_FILES_SESSION_KEY);
        } catch {
          // ignore
        }
      }
      setTimeout(() => sendMessage(text, attachmentsFromStorage, []), 50);
    }
  }, [messages.length, sendMessage, streaming, setMessages]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-[var(--fg-primary)]">Chat</h1>
          {streaming && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-[var(--fg-muted)]"
            >
              <GeneratingEllipsis />
            </motion.span>
          )}
        </div>
        <button
          onClick={startNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-black bg-white border border-white transition-colors hover:opacity-90"
        >
          <Plus size={14} />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            const isLastAssistant = isLast && msg.role === "assistant";
            return (
              <ChatMessage
                key={msg.id}
                msg={msg}
                isLastAssistant={isLastAssistant}
                streaming={streaming}
              />
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div
        className={`px-8 py-4 border-t border-[var(--border-subtle)] ${dragOver ? "bg-[var(--bg-elevated)]" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="max-w-3xl mx-auto">
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingFiles.map((f, idx) => (
                <AttachmentChip key={`${f.name}-${idx}`} name={f.name} onRemove={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-strong)]">
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 h-8 w-8 rounded-lg border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
              title="Attach files"
            >
              <Plus size={15} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                autoResizeTextarea(e.currentTarget);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              disabled={streaming}
              className="flex-1 bg-transparent border-none outline-none resize-none overflow-y-auto text-[var(--fg-primary)] text-[15px] leading-6 placeholder:text-[var(--fg-muted)] min-h-[24px] max-h-[120px] disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || streaming}
              className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 ${
                input.trim() && !streaming
                  ? 'bg-[var(--fg-primary)] text-[var(--bg-base)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--fg-muted)] cursor-not-allowed'
              }`}
            >
              {streaming ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroView() {
  const [creditsData, setCreditsData] = useState<{ credits: { remaining: number; total: number }; plan: string } | null>(null);

  useEffect(() => {
    fetch("/api/credits").then(r => r.json()).then(setCreditsData).catch(() => {});
  }, []);

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  const { setMessages } = useChat();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const searchParams = useSearchParams();
  const prefillConsumedRef = useRef(false);
  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeHero = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const lineHeight = 24;
    const maxHeight = lineHeight * 5;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    autoResizeHero(heroInputRef.current);
  }, [value, autoResizeHero]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const token = session?.access_token;
    if (!token || files.length === 0) return;
    const uploaded: AttachedFile[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      const preview = data.file?.content_preview || "";
      const url = data.url ? `\nSigned URL: ${data.url}` : "";
      uploaded.push({
        name: file.name,
        content: preview
          ? `[${file.name}]\n${preview}`
          : `Uploaded file: ${file.name} (${file.type || "unknown type"}).${url}`,
      });
    }
    setPendingFiles((prev) => [...prev, ...uploaded]);
  }, [session?.access_token]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text) return;
    setValue('');
    if (pendingFiles.length > 0) {
      try {
        sessionStorage.setItem(PENDING_FILES_SESSION_KEY, JSON.stringify(pendingFiles));
      } catch {
        // ignore; chat will fall back to no attachments
      }
    }
    // Claude-like behavior: user's visible message should stay clean (no "Attached files" scaffolding).
    setMessages([{ id: Date.now().toString(), role: "user", content: text, toolCalls: [], toolResults: [] }]);
    setPendingFiles([]);
  }, [value, setMessages, pendingFiles]);

  useEffect(() => {
    if (prefillConsumedRef.current) return;
    const prefill = searchParams.get("prefill");
    if (!prefill) return;
    if (value.trim().length > 0) {
      prefillConsumedRef.current = true;
      return;
    }

    prefillConsumedRef.current = true;
    setValue(prefill);

    // Consume the param so refresh/back doesn’t re-fill.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("prefill");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch {
      // ignore
    }
  }, [searchParams, setValue, value]);

  return (
    <div className="min-h-screen flex flex-col">
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between px-8 pt-6 pb-2"
      >
        <span className="text-[var(--fg-tertiary)] text-sm">{getGreeting()}</span>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          </span>
          <span className="text-[var(--fg-secondary)] text-[11px] font-medium">System Online</span>
        </div>
      </motion.header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-16">
        <motion.div variants={stagger} initial="hidden" animate="show" className="w-full max-w-2xl text-center">
          <motion.h1 variants={fadeUp} className="text-[42px] font-semibold text-[var(--fg-primary)] tracking-[-0.04em] leading-[1.1] mb-3">
            What would you like<br />to accomplish?
          </motion.h1>
          <motion.p variants={fadeUp} className="text-[var(--fg-tertiary)] text-base mb-8 max-w-md mx-auto">
            Research, write, code, and automate — Inceptive handles it.
          </motion.p>

          <motion.div variants={fadeUp} className="mb-4">
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 justify-center">
                {pendingFiles.map((f, idx) => (
                  <AttachmentChip key={`${f.name}-${idx}`} name={f.name} onRemove={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} />
                ))}
              </div>
            )}
            <div
              className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border transition-all duration-200 ${
                dragOver
                  ? 'border-[var(--border-strong)] bg-[var(--bg-elevated)]'
                  : focused
                    ? 'border-[var(--border-strong)] shadow-[0_0_0_1px_var(--border-subtle)]'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
              }`}
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
            >
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
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 h-8 w-8 rounded-lg border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
                title="Attach files"
              >
                <Plus size={15} />
              </button>
              <textarea
                ref={heroInputRef}
                value={value}
                onChange={e => {
                  setValue(e.target.value);
                  autoResizeHero(e.currentTarget);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Ask Inceptive anything..."
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none overflow-y-auto text-[var(--fg-primary)] text-[15px] tracking-[-0.01em] leading-6 placeholder:text-[var(--fg-muted)] min-h-[24px] max-h-[120px]"
              />
              <button
                onClick={submit}
                disabled={!value.trim()}
                className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 ${
                  value.trim() ? 'bg-[var(--fg-primary)] text-[var(--bg-base)]' : 'bg-[var(--bg-elevated)] text-[var(--fg-muted)] cursor-not-allowed'
                }`}
              >
                <ArrowUp size={16} strokeWidth={2} />
              </button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center justify-center gap-1.5 text-[var(--fg-muted)] text-[11px]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--fg-tertiary)] text-[10px] border border-[var(--border-subtle)]">⌘K</kbd>
            <span>for quick actions</span>
          </motion.div>
        </motion.div>
      </div>

      <div className="px-8 pb-8 max-w-5xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Credits" value={creditsData ? `${creditsData.credits.remaining}` : "—"} sub={creditsData?.plan ? `${creditsData.plan} plan` : undefined} />
          <StatCard label="Status" value="Active" sub="All systems running" />
          <StatCard label="Agents" value="Ready" sub="0 tasks queued" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[var(--fg-secondary)]">Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction icon={Mail} label="Email Autopilot" description="Manage inbox and draft replies" href="/email" />
            <QuickAction icon={Search} label="Deep Research" description="Research with citations" href="/research" />
            <QuickAction icon={Bot} label="Agent Tasks" description="Run autonomous workflows" href="/agent" />
            <QuickAction icon={Sparkles} label="Skills Library" description="One-click AI workflows" href="/skills" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { messages } = useChat();
  const hasChat = messages.length > 0;

  return (
    <AnimatePresence mode="wait">
      {hasChat ? (
        <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ChatView />
        </motion.div>
      ) : (
        <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Suspense fallback={null}>
            <HeroView />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
