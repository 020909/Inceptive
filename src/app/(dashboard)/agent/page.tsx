"use client"; // force strict client directive


import React, { useState, useRef, useEffect } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { AgentModeSelector, AgentMode } from "@/components/AgentModeSelector";
import { useAuth } from "@/lib/auth-context";
import { useChat, type Message, type ToolCall, type ToolResult } from "@/lib/chat-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Globe, Mail as MailIcon,
  FileText, Check, ArrowLeft, Plus, PanelRightOpen, PanelRightClose
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import LiveTaskFeed from "@/components/LiveTaskFeed";
import { toast } from "sonner";

const TOOL_META: Record<string, { icon: React.ReactNode; label: string }> = {
  searchWeb: { icon: <Globe className="w-3.5 h-3.5" />, label: "Searching the web" },
  draftEmail: { icon: <MailIcon className="w-3.5 h-3.5" />, label: "Drafting email" },
  saveResearchReport: { icon: <FileText className="w-3.5 h-3.5" />, label: "Saving report" },
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "#555555" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </div>
  );
}

export default function AgentLivePage() {
  const { user } = useAuth();
  const { startNewChat } = useChat();

  const [activeMode, setActiveMode] = useState<AgentMode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [feedOpen, setFeedOpen] = useState(true);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, toolCalls, toolResults]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const handleStartAgent = async (mode: AgentMode, initialPrompt: string) => {
    await startNewChat();
    setActiveMode(mode);
    setToolCalls([]);
    setToolResults([]);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: initialPrompt };
    setMessages([userMsg]);
    setIsLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const preface = `**${mode.welcomeMessage}**\n\n`;
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: preface, toolCalls: [], toolResults: [] }]);

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [userMsg], systemOverride: mode.systemPrompt }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let content = preface;
      let buffer = "";

      const processLine = (line: string) => {
        if (!line.trim()) return;
        const firstColon = line.indexOf(":");
        if (firstColon === -1) return;
        const type = line.substring(0, firstColon);
        const json = line.substring(firstColon + 1);
        try {
          const data = JSON.parse(json);
          if (type === "0") {
            content += data;
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.content = content;
              return next;
            });
          } else if (type === "1") {
            setToolCalls(prev => [...prev, data]);
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.toolCalls = [...(msg.toolCalls || []), data];
              return next;
            });
          } else if (type === "2") {
            setToolResults(prev => [...prev, data]);
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.toolResults = [...(msg.toolResults || []), data];
              return next;
            });
          } else if (type === "3") {
            const errMsg = typeof data === "string" ? data : data?.message || data?.error || JSON.stringify(data);
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.content = `⚠️ ${errMsg}`;
              return next;
            });
          }
        } catch {}
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) processLine(buffer);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      }
    } catch (err: any) {
      const errText = err.message || "Something went wrong. Please try again.";
      setMessages(prev => {
        const next = [...prev];
        const msg = next.find(m => m.id === assistantMsgId);
        if (msg) msg.content = `⚠️ ${errText}`;
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || !user || !activeMode || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setToolCalls([]);
    setToolResults([]);
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "", toolCalls: [], toolResults: [] }]);

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg], systemOverride: activeMode.systemPrompt }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let content = "";
      let buffer = "";

      const processLine = (line: string) => {
        if (!line.trim()) return;
        const firstColon = line.indexOf(":");
        if (firstColon === -1) return;
        const type = line.substring(0, firstColon);
        const json = line.substring(firstColon + 1);
        try {
          const data = JSON.parse(json);
          if (type === "0") {
            content += data;
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.content = content;
              return next;
            });
          } else if (type === "1") {
            setToolCalls(prev => [...prev, data]);
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.toolCalls = [...(msg.toolCalls || []), data];
              return next;
            });
          } else if (type === "2") {
            setToolResults(prev => [...prev, data]);
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.toolResults = [...(msg.toolResults || []), data];
              return next;
            });
          } else if (type === "3") {
            const errMsg = typeof data === "string" ? data : data?.message || data?.error || JSON.stringify(data);
            setMessages((prev: Message[]) => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.content = `⚠️ ${errMsg}`;
              return next;
            });
          }
        } catch {}
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) processLine(buffer);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      }
    } catch (err: any) {
      const errText = err.message || "Something went wrong. Please try again.";
      setMessages(prev => {
        const next = [...prev];
        const msg = next.find(m => m.id === assistantMsgId);
        if (msg) msg.content = `⚠️ ${errText}`;
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeMode) {
    return (
      <PageTransition>
        <div className="h-full w-full bg-[var(--background)] p-4 md:p-8 overflow-y-auto">
          <AgentModeSelector onStartAgent={handleStartAgent} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden" style={{
        background: "var(--background)",
        backgroundImage: "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}>
        {/* Top bar */}
        <div className="flex items-center gap-4 pl-4 md:pl-8 pr-6 py-4 shrink-0 border-b border-[var(--border)] bg-[var(--background)]">
          <button onClick={() => setActiveMode(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--background-elevated)] border border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--foreground-secondary)]" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-lg bg-[var(--background-overlay)] flex items-center justify-center text-[var(--foreground)]">
              {activeMode.icon}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-none">{activeMode.name} Agent</h1>
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-tertiary)] mt-1">Specialized Mode</p>
            </div>
          </div>
          <button onClick={() => setFeedOpen(!feedOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--background-elevated)] border border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors"
            title={feedOpen ? "Hide activity feed" : "Show activity feed"}>
            {feedOpen
              ? <PanelRightClose className="w-4 h-4 text-[var(--foreground-secondary)]" />
              : <PanelRightOpen className="w-4 h-4 text-[var(--foreground-secondary)]" />}
          </button>
        </div>

        {/* Body: Chat + Feed */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat column */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5" ref={scrollRef}>
              <AnimatePresence initial={false}>
                {messages.map((m: Message, i: number) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`flex gap-2.5 max-w-[90%] sm:max-w-[82%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {m.role === "user" ? (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold select-none"
                          style={{ background: "var(--foreground)", color: "var(--background)" }}>
                          {user?.email?.[0]?.toUpperCase() || "U"}
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: "var(--foreground)", color: "var(--background)" }}>
                          {activeMode.icon}
                        </div>
                      )}
                      <div className="space-y-1.5 w-full">
                        {m.role === "assistant" && !m.content && isLoading && i === messages.length - 1 ? (
                          <div className="rounded-2xl border" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                            <TypingIndicator />
                          </div>
                        ) : (m.content || (m.role === "assistant" && !isLoading)) ? (
                          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "" : "text-[var(--foreground)]"}`}
                            style={{
                              background: m.role === "user" ? "var(--foreground)" : "var(--background-elevated)",
                              color: m.role === "user" ? "var(--background)" : undefined,
                              border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                            }}>
                            {m.role === "assistant" ? (
                              m.content
                                ? <div className="prose-inceptive max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                                : <span className="text-[var(--foreground-tertiary)] text-xs italic">No response — check your API key in Settings and try again.</span>
                            ) : m.content}
                          </div>
                        ) : null}
                        {m.role === "assistant" && (m.toolCalls?.length ?? 0) > 0 && (
                          <div className="space-y-1 mt-2">
                            {(m.toolCalls || []).map((tc: ToolCall, idx: number) => {
                              const meta = TOOL_META[tc.toolName];
                              const isDone = (m.toolResults || []).some((r: ToolResult) => r.toolCallId === tc.toolCallId) || (!isLoading && i !== messages.length - 1);
                              return (
                                <motion.div key={tc.toolCallId || idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.08 }}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg border max-w-max"
                                  style={{
                                    background: "var(--background-overlay)",
                                    borderColor: isDone ? "var(--border-subtle)" : "var(--border)",
                                  }}>
                                  <div className="w-4 h-4 flex items-center justify-center shrink-0 text-[var(--foreground-secondary)]">
                                    {meta?.icon || <Globe className="w-3 h-3" />}
                                  </div>
                                  <span className="text-xs text-[var(--foreground-secondary)] font-medium">
                                    {meta?.label || tc.toolName}
                                  </span>
                                  {isDone
                                    ? <div className="flex items-center gap-1 text-[#FFFFFF] ml-2"><Check className="w-3.5 h-3.5" /></div>
                                    : <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--foreground-tertiary)] ml-2" />}
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Input */}
            <div className="px-4 pb-5 pt-3 md:px-8 border-t border-[var(--border)] bg-[var(--background)] shrink-0">
              <div className="max-w-4xl mx-auto">
                {!user ? (
                  <div className="text-center py-2">
                    <a href="/login" className="text-sm text-[var(--foreground)] hover:opacity-75 transition-opacity">
                      Sign in to use the agent
                    </a>
                  </div>
                ) : (
                  <div>
                    {/* Attached files list */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-1 pb-2">
                        {attachedFiles.map((file, i) => (
                          <div key={i}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-[var(--foreground-secondary)] border"
                            style={{ background: "var(--background)", borderColor: "var(--border)" }}
                          >
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="max-w-[140px] truncate">{file.name}</span>
                            <button
                              onClick={() => setAttachedFiles(f => f.filter((_, j) => j !== i))}
                              className="ml-0.5 hover:text-white transition-colors"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) {
                          setAttachedFiles(prev => [...prev, ...files]);
                          toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached`);
                        }
                        e.target.value = "";
                      }}
                    />

                    <div className="relative rounded-2xl border transition-colors focus-within:border-[var(--foreground-secondary)]"
                      style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                      <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute left-3 bottom-2.5 w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-150"
                        style={{ background: "rgba(255,255,255,0.05)", color: "var(--foreground-tertiary)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-tertiary)"; }}
                        title="Attach files">
                        <Plus className="w-4 h-4" />
                      </button>
                      <textarea ref={textareaRef} value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={`Continue commanding the ${activeMode.name} Agent...`}
                        disabled={isLoading} rows={1}
                        className="w-full bg-transparent text-[var(--foreground)] text-sm resize-none pl-14 py-3.5 pr-14 leading-relaxed outline-none"
                        style={{ maxHeight: "140px" }} />
                      <div className="absolute right-3 bottom-2.5">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={handleSend}
                          disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30"
                          style={{ background: (input.trim() || attachedFiles.length > 0) && !isLoading ? "var(--foreground)" : "rgba(255,255,255,0.06)" }}>
                          {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--background)" }} />
                            : <Send className="w-4 h-4" style={{ color: (input.trim() || attachedFiles.length > 0) && !isLoading ? "var(--background)" : "var(--foreground-tertiary)" }} />}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Feed panel */}
          {feedOpen && (
            <div className="hidden lg:flex flex-col w-[280px] shrink-0 overflow-y-auto border-l px-4 py-5"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}>
              <LiveTaskFeed />
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
