"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useChat, type Message, type ToolCall, type ToolResult } from "@/lib/chat-context";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  Send, Loader2, Globe, Mail as MailIcon,
  FileText, Check, Zap, ArrowUpRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import LiveTaskFeed from "@/components/LiveTaskFeed";
import MorningBriefing from "@/components/MorningBriefing";

/* ========================
   TYPES
======================== */
// Message, ToolCall, ToolResult are imported from chat-context

interface DashboardStats {
  tasks_completed: number;
  research_reports: number;
  emails_sent: number;
  currently_working: number;
}

const TOOL_META: Record<string, { icon: React.ReactNode; label: string }> = {
  searchWeb: { icon: <Globe className="w-3.5 h-3.5" />, label: "Searching the web" },
  draftEmail: { icon: <MailIcon className="w-3.5 h-3.5" />, label: "Drafting email" },
  saveResearchReport: { icon: <FileText className="w-3.5 h-3.5" />, label: "Saving report" },
};

const SUGGESTIONS = [
  "Read my Gmail inbox and summarize what needs attention",
  "Research top AI investors and draft cold outreach",
  "Send a follow-up email to my last Gmail thread",
  "Create a goal: 100 paid users by end of month",
];

/* ========================
   ANIMATED NUMBER
======================== */
function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94] as any,
      onUpdate: (v: number) => { if (node) node.textContent = Math.round(v).toString(); },
    });
    return controls.stop;
  }, [value]);
  return <span ref={ref}>0</span>;
}

/* ========================
   TYPING INDICATOR
======================== */
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

/* ========================
   STAT CARD — transparent, floating
======================== */
function StatCard({ title, value, icon, href, pulse }: {
  title: string; value: number; icon: React.ReactNode; href: string; pulse?: boolean;
}) {
  return (
    <Link href={href} className="block group">
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-colors duration-150"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border-subtle)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--background-overlay)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--background-elevated)"; }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }}>
          <div className="text-[var(--foreground)]">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-white leading-none mb-0.5 tracking-tight">
            <AnimatedNumber value={value} />
          </div>
          <div className="text-[11px] text-[var(--foreground-tertiary)] leading-tight font-medium">{title}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {pulse && <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] pulse-dot" />}
          <ArrowUpRight className="h-3.5 w-3.5 text-[var(--foreground-secondary)] group-hover:text-[var(--foreground-tertiary)] transition-colors" />
        </div>
      </motion.div>
    </Link>
  );
}

/* ========================
   MAIN DASHBOARD
======================== */
function WelcomeToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("welcome") === "true") {
      toast.success("Welcome to Inceptive — your AI just woke up 🚀", {
        duration: 6000,
        description: "You've been given 500 free credits to get started.",
      });
      // Remove the query param without a full reload
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [searchParams]);

  return null;
}

/* ========================
   MAIN DASHBOARD
======================== */
export default function DashboardPage() {
  // Single auth source — useAuth() syncs with the SSR client, no duplicate state
  const { user } = useAuth();

  /* — chat state (messages persist via ChatContext across navigation) — */
  const { messages, setMessages } = useChat();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [, setToolResults] = useState<ToolResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  /* — stats state — */
  const [stats, setStats] = useState<DashboardStats>({
    tasks_completed: 0, research_reports: 0, emails_sent: 0, currently_working: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  /* fetch stats — depends only on user */
  useEffect(() => {
    if (!user) { setStatsLoading(false); return; }
    const fetchStats = async () => {
      const supabase = createClient();
      try {
        const [researchRes, emailsRes, socialRes, recentResearchRes, recentEmailsRes] = await Promise.all([
          supabase.from("research_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("emails").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("social_posts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("research_reports").select("id, topic, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
          supabase.from("emails").select("id, subject, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        ]);
        const totalTasks = (researchRes.count || 0) + (emailsRes.count || 0) + (socialRes.count || 0);
        setStats({
          tasks_completed: totalTasks,
          research_reports: researchRes.count || 0,
          emails_sent: emailsRes.count || 0,
          currently_working: socialRes.count || 0,
        });
        // Merge recent items from research + emails (social_posts.created_at added by migration 005)
        const recentItems = [
          ...(recentResearchRes.data || []).map((r: any) => ({ id: r.id, title: r.topic, type: "research", created_at: r.created_at })),
          ...(recentEmailsRes.data || []).map((e: any) => ({ id: e.id, title: e.subject, type: "email", created_at: e.created_at })),
        ].filter(item => item.created_at)
         .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
        setRecentTasks(recentItems);
      } catch (err) { console.error(err); }
      finally { setStatsLoading(false); }
    };
    fetchStats();
  }, [user]);

  /* auto-scroll */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, toolCalls]);

  /* textarea auto-resize */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || !user || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); setAttachedFiles([]);
    setIsLoading(true);
    setToolCalls([]);
    setToolResults([]);
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "", toolCalls: [], toolResults: [] }]);

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          attachedFiles: await Promise.all(attachedFiles.map(async (file) => {
            const text = await file.text().catch(() => '');
            return { name: file.name, type: file.type, content: text.slice(0, 8000) };
          }))
        }),
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
            setMessages(prev => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.content = content;
              return next;
            });
          } else if (type === "1") {
            setToolCalls(prev => [...prev, data]);
            setMessages(prev => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.toolCalls = [...(msg.toolCalls || []), data];
              return next;
            });
          } else if (type === "2") {
            setToolResults(prev => [...prev, data]);
            setMessages(prev => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.toolResults = [...(msg.toolResults || []), data];
              return next;
            });
          } else if (type === "3") {
            const errMsg = typeof data === "string" ? data
              : data?.message || data?.error || JSON.stringify(data);
            // Write error into the chat bubble so it can't be missed
            setMessages(prev => {
              const next = [...prev];
              const msg = next.find(m => m.id === assistantMsgId);
              if (msg) msg.content = `⚠️ ${errMsg}`;
              return next;
            });
          }
        } catch {
          // ignore parse errors on individual lines
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush any remaining buffered data
          if (buffer.trim()) processLine(buffer);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      }
    } catch (err: any) {
      // Show error inline in the chat bubble so it can't be missed
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

  const firstName = user?.email?.split("@")[0] || "there";
  function getGreeting() {
    const h = new Date().getHours();
    return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{
      background: "var(--background)",
      backgroundImage: "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
    }}>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>

      {/* ====== CENTER — Agent Chat ====== */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between pl-14 pr-6 py-4 md:pl-6 shrink-0"
        >
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">
              Good {getGreeting()}{user ? `, ${firstName}` : ""}
            </h1>
          </div>
        </motion.div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5" ref={scrollRef}>
          <MorningBriefing />
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full py-16 text-center">
                <motion.div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 border overflow-hidden"
                  style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
                  animate={{ boxShadow: ["0 0 16px rgba(255,255,255,0.04)", "0 0 32px rgba(255,255,255,0.1)", "0 0 16px rgba(255,255,255,0.04)"] }}
                  transition={{ duration: 3.5, repeat: Infinity }}>
                  <img src="/logo.png" alt="" className="logo-avatar w-9 h-9 object-contain" />
                </motion.div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 + 0.1 }}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setInput(s)}
                      className="text-left px-6 py-5 rounded-2xl border text-sm text-[var(--foreground-secondary)] hover:text-white leading-snug"
                      style={{ background: "var(--card-hover)", borderColor: "var(--border)" }}>
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((m, i) => (
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
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden"
                      style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}>
                      <img src="/logo.png" alt="" className="logo-avatar w-4 h-4 object-contain" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {m.role === "assistant" && !m.content && isLoading && i === messages.length - 1 ? (
                      /* Typing indicator while waiting for first text token */
                      <div className="rounded-2xl border" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                        <TypingIndicator />
                      </div>
                    ) : (m.content || (m.role === "assistant" && !isLoading)) ? (
                      /* Render message content — or a retry prompt if empty */
                      <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "" : "text-[var(--foreground)]"}`}
                        style={{
                          background: m.role === "user" ? "var(--foreground)" : "var(--background-elevated)",
                          color: m.role === "user" ? "var(--background)" : undefined,
                          border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                        }}>
                        {m.role === "assistant" ? (
                          m.content
                            ? <div className="prose-inceptive"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                            : <span className="text-[var(--foreground-tertiary)] text-xs italic">No response — check your API key in Settings and try again.</span>
                        ) : m.content}
                      </div>
                    ) : null}
                    {m.role === "assistant" && (m.toolCalls?.length ?? 0) > 0 && (
                      <div className="space-y-1">
                        {(m.toolCalls || []).map((tc, idx) => {
                          const meta = TOOL_META[tc.toolName];
                          const isDone = (m.toolResults || []).some(r => r.toolCallId === tc.toolCallId) ||
                            (!isLoading && i !== messages.length - 1);
                          return (
                            <motion.div key={tc.toolCallId || idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.08 }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
                              style={{
                                background: "var(--background-elevated)",
                                borderColor: isDone ? "var(--border-subtle)" : "var(--border)",
                              }}>
                              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                style={{ background: "var(--background-overlay)", color: "var(--foreground)" }}>
                                {meta?.icon || <Globe className="w-3 h-3" />}
                              </div>
                              <span className="text-[11px] text-[var(--foreground-secondary)] flex-1">
                                {meta?.label || tc.toolName}
                                {tc.args?.query && <span className="text-white ml-1">&quot;{tc.args.query}&quot;</span>}
                              </span>
                              {isDone
                                ? <div className="flex items-center gap-1 text-[#FFFFFF]"><Check className="w-3 h-3" /><span className="text-[10px] font-medium">Done</span></div>
                                : <Loader2 className="w-3 h-3 animate-spin text-[var(--foreground-tertiary)]" />
                              }
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
        <div className="px-4 pb-5 pt-3 sm:px-6 sm:pb-6 shrink-0">
          {!user ? (
            <div className="text-center py-2">
              <a href="/login" className="text-sm text-[var(--foreground)] hover:opacity-75 transition-opacity">
                Sign in to chat with your agent
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
                  // Reset so same file can be re-selected
                  e.target.value = "";
                }}
              />

              {/* Input box — matches the background perfectly with subtle border */}
              <div
                className="relative rounded-2xl border"
                style={{ background: "var(--background)", borderColor: "var(--border)" }}
              >
                {/* + attach button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute left-2.5 bottom-2.5 w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-150"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--foreground-tertiary)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-tertiary)"; }}
                  title="Attach files"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <textarea ref={textareaRef} value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask your agent anything..."
                  disabled={isLoading} rows={1}
                  className="w-full bg-transparent text-white text-sm resize-none pl-12 py-3 pr-12 leading-relaxed"
                  style={{ maxHeight: "140px", outline: "none", boxShadow: "none", color: "var(--foreground)" }} />
                <div className="absolute right-2.5 bottom-2.5">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30"
                    style={{ background: input.trim() && !isLoading ? "var(--foreground)" : "rgba(255,255,255,0.06)" }}>
                    {isLoading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--background)" }} />
                      : <Send className="w-3.5 h-3.5" style={{ color: input.trim() && !isLoading ? "var(--background)" : "var(--foreground-tertiary)" }} />
                    }
                  </motion.button>
                </div>
              </div>
            </div>
          )}
          <p className="text-[10px] text-center text-[var(--foreground-secondary)] mt-2.5 uppercase tracking-widest font-medium">
            Inceptive Autonomous Engine
          </p>
        </div>
      </div>

      {/* ====== RIGHT — Stats panel ====== */}
      <div className="hidden lg:flex flex-col w-[272px] shrink-0 overflow-y-auto px-4 py-6 gap-6">

        {/* Stats */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-secondary)] font-semibold mb-3 px-1">Overview</p>
          {statsLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-[58px] rounded-2xl shimmer" />)}
            </div>
          ) : (
            <div className="space-y-2">
              <StatCard title="Total Actions" value={stats.tasks_completed} icon={<Zap className="h-4 w-4" />} href="/research" />
              <StatCard title="Research Reports" value={stats.research_reports} icon={<FileText className="h-4 w-4" />} href="/research" />
              <StatCard title="Emails Generated" value={stats.emails_sent} icon={<MailIcon className="h-4 w-4" />} href="/email" />
              <StatCard title="Social Posts" value={stats.currently_working} icon={<Check className="h-4 w-4" />} href="/social" />
            </div>
          )}
        </div>

        {/* Live Task Feed */}
        <LiveTaskFeed />
      </div>
    </div>
  );
}
