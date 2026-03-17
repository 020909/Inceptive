"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  Send, User, Bot, Loader2, Globe, Mail as MailIcon,
  FileText, Check, Zap, Target, ArrowUpRight,
  CheckCircle2, Clock,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils";

/* ========================
   SUPABASE for auth check
======================== */
const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
  return createSupabaseClient(url, key);
};
const anonSupabase = getSupabase();

/* ========================
   TYPES
======================== */
type Message = { id: string; role: "user" | "assistant"; content: string };
type ToolCall = { toolName: string; args: any; toolCallId: string };
type ToolResult = { toolName: string; result: any; toolCallId: string };

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
  "Research the latest AI agent frameworks",
  "Draft an email to a potential investor",
  "What are the top 5 tools for startup founders?",
  "Show me my goal progress",
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
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "#8E8E93" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </div>
  );
}

/* ========================
   STAT CARD (right panel)
======================== */
function StatCard({ title, value, icon, href, pulse }: {
  title: string; value: number; icon: React.ReactNode; href: string; pulse?: boolean;
}) {
  return (
    <Link href={href} className="block group">
      <motion.div whileHover={{ x: 2 }} transition={{ duration: 0.15 }}
        className="flex items-center gap-3 p-3.5 rounded-xl border transition-colors duration-150"
        style={{ background: "#242426", borderColor: "#38383A" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(0,122,255,0.12)" }}>
          <div className="text-[#007AFF]">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-white leading-none mb-0.5">
            <AnimatedNumber value={value} />
          </div>
          <div className="text-[11px] text-[#8E8E93] leading-tight">{title}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {pulse && <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] pulse-dot" />}
          <ArrowUpRight className="h-3.5 w-3.5 text-[#48484A] group-hover:text-[#8E8E93] transition-colors" />
        </div>
      </motion.div>
    </Link>
  );
}

/* ========================
   MAIN DASHBOARD
======================== */
export default function DashboardPage() {
  const { user } = useAuth();

  /* — chat state — */
  const [authUser, setAuthUser] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* — stats state — */
  const [stats, setStats] = useState<DashboardStats>({
    tasks_completed: 0, research_reports: 0, emails_sent: 0, currently_working: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [activeGoals, setActiveGoals] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  /* init auth */
  useEffect(() => {
    anonSupabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setAuthUser(session.user);
      setSessionLoading(false);
    });
    const { data: { subscription } } = anonSupabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setSessionLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* fetch stats */
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      const supabase = createClient();
      try {
        const [tasksRes, researchRes, emailsRes, workingRes, recentTasksRes, goalsRes] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("research_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("emails").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "sent"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "in_progress"),
          supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("goals").select("*").eq("user_id", user.id).eq("status", "active"),
        ]);
        setStats({
          tasks_completed: tasksRes.count || 0,
          research_reports: researchRes.count || 0,
          emails_sent: emailsRes.count || 0,
          currently_working: workingRes.count || 0,
        });
        setRecentTasks(recentTasksRes.data || []);
        setActiveGoals(goalsRes.data || []);
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
    if (!input.trim() || !authUser || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setToolCalls([]);
    setToolResults([]);
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg], user_id: authUser.id }),
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to connect"); }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let content = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const firstColon = line.indexOf(":");
          if (firstColon === -1) { content += line; continue; }
          const type = line.substring(0, firstColon);
          const json = line.substring(firstColon + 1);
          try {
            const data = JSON.parse(json);
            if (type === "0") content += data;
            else if (type === "1") setToolCalls(prev => [...prev, data]);
            else if (type === "2") setToolResults(prev => [...prev, data]);
            else if (type === "3") toast.error(`Agent Error: ${data}`);
          } catch { content += line; }
          setMessages(prev => {
            const next = [...prev];
            const msg = next.find(m => m.id === assistantMsgId);
            if (msg) msg.content = content;
            return next;
          });
        }
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setIsLoading(false); }
  };

  const firstName = user?.email?.split("@")[0] || "there";
  function getGreeting() {
    const h = new Date().getHours();
    return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#1C1C1E" }}>

      {/* ====== CENTER — Agent Chat ====== */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-[#2C2C2E]">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C2C2E] shrink-0">
          <div>
            <h1 className="text-base font-semibold text-white">
              Good {getGreeting()}, {firstName}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] pulse-dot" />
              <span className="text-xs text-[#8E8E93]">Agent ready</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" ref={scrollRef}>
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full py-16 text-center">
                <motion.div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 border"
                  style={{ background: "rgba(0,122,255,0.1)", borderColor: "rgba(0,122,255,0.2)" }}
                  animate={{ boxShadow: ["0 0 16px rgba(0,122,255,0.08)", "0 0 28px rgba(0,122,255,0.2)", "0 0 16px rgba(0,122,255,0.08)"] }}
                  transition={{ duration: 3, repeat: Infinity }}>
                  <Bot className="w-6 h-6 text-[#007AFF]" />
                </motion.div>
                <h2 className="text-base font-semibold text-white mb-1.5">What&apos;s your mission?</h2>
                <p className="text-sm text-[#8E8E93] mb-7 max-w-xs">Research, draft emails, schedule posts — I handle it autonomously.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <motion.button key={s} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setInput(s)}
                      className="text-left px-3.5 py-2.5 rounded-xl border text-xs text-[#8E8E93] hover:text-white transition-colors duration-150"
                      style={{ background: "#242426", borderColor: "#38383A" }}>
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-2.5 max-w-[80%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                    m.role === "user" ? "bg-white border-white/20" : "border-[#007AFF]/30 bg-[#007AFF]/10"
                  }`}>
                    {m.role === "user"
                      ? <User className="w-3 h-3 text-black" />
                      : <Bot className="w-3 h-3 text-[#007AFF]" />
                    }
                  </div>
                  <div className="space-y-1.5">
                    {m.content ? (
                      <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "text-white" : "text-[#E5E5EA]"}`}
                        style={{ background: m.role === "user" ? "#007AFF" : "#242426", border: m.role === "assistant" ? "1px solid #38383A" : "none" }}>
                        {m.role === "assistant"
                          ? <div className="prose-inceptive"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                          : m.content
                        }
                      </div>
                    ) : isLoading && i === messages.length - 1 ? (
                      <div className="rounded-2xl border" style={{ background: "#242426", borderColor: "#38383A" }}>
                        <TypingIndicator />
                      </div>
                    ) : null}
                    {m.role === "assistant" && toolCalls.length > 0 && i === messages.length - 1 && (
                      <div className="space-y-1">
                        {toolCalls.map((tc, idx) => {
                          const meta = TOOL_META[tc.toolName];
                          const isDone = toolResults.some(r => r.toolCallId === tc.toolCallId);
                          return (
                            <motion.div key={tc.toolCallId || idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.08 }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
                              style={{ background: "#1C1C1E", borderColor: isDone ? "#2C2C2E" : "rgba(0,122,255,0.25)" }}>
                              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                style={{ background: "rgba(0,122,255,0.15)", color: "#007AFF" }}>
                                {meta?.icon || <Globe className="w-3 h-3" />}
                              </div>
                              <span className="text-[11px] text-[#8E8E93] flex-1">
                                {meta?.label || tc.toolName}
                                {tc.args?.query && <span className="text-white ml-1">"{tc.args.query}"</span>}
                              </span>
                              {isDone
                                ? <div className="flex items-center gap-1 text-[#30D158]"><Check className="w-3 h-3" /><span className="text-[10px] font-medium">Done</span></div>
                                : <Loader2 className="w-3 h-3 animate-spin text-[#8E8E93]" />
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
        <div className="px-5 pb-5 pt-3 border-t border-[#2C2C2E] shrink-0">
          {sessionLoading ? (
            <div className="h-12 rounded-2xl shimmer" />
          ) : !authUser ? (
            <div className="text-center">
              <a href="/login" className="text-sm text-[#007AFF] hover:opacity-80">Sign in to chat with your agent</a>
            </div>
          ) : (
            <div className="relative rounded-2xl border transition-colors duration-150"
              style={{ background: "#242426", borderColor: isLoading ? "rgba(0,122,255,0.4)" : "#38383A" }}>
              <textarea ref={textareaRef} value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type your mission… (Enter to send)"
                disabled={isLoading} rows={1}
                className="w-full bg-transparent text-white text-sm placeholder:text-[#48484A] resize-none px-4 py-3 pr-12 outline-none leading-relaxed"
                style={{ maxHeight: "140px" }} />
              <div className="absolute right-2 bottom-2">
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40"
                  style={{ background: input.trim() && !isLoading ? "#007AFF" : "#2A2A2C" }}>
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5 text-white" />}
                </motion.button>
              </div>
            </div>
          )}
          <p className="text-[10px] text-center text-[#48484A] mt-2 uppercase tracking-widest">
            Powered by Inceptive Autonomous Engine
          </p>
        </div>
      </div>

      {/* ====== RIGHT — Stats panel ====== */}
      <div className="hidden lg:flex flex-col w-[272px] shrink-0 overflow-y-auto px-4 py-5 gap-4">

        {/* Stats */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#636366] font-semibold mb-3 px-1">Overview</p>
          {statsLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl shimmer" />)}
            </div>
          ) : (
            <div className="space-y-2">
              <StatCard title="Tasks Completed" value={stats.tasks_completed} icon={<Zap className="h-4 w-4" />} href="/reports" />
              <StatCard title="Research Reports" value={stats.research_reports} icon={<FileText className="h-4 w-4" />} href="/research" />
              <StatCard title="Emails Sent" value={stats.emails_sent} icon={<MailIcon className="h-4 w-4" />} href="/email" />
              <StatCard title="Currently Working" value={stats.currently_working} icon={<Zap className="h-4 w-4" />} href="/reports" pulse />
            </div>
          )}
        </div>

        {/* Goal Progress */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] uppercase tracking-widest text-[#636366] font-semibold">Goals</p>
            <Link href="/goals" className="text-[10px] text-[#007AFF] hover:opacity-80 flex items-center gap-0.5">
              Manage <ArrowUpRight className="h-2.5 w-2.5" />
            </Link>
          </div>
          {statsLoading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
          ) : activeGoals.length === 0 ? (
            <div className="text-center py-6 rounded-xl border" style={{ background: "#242426", borderColor: "#38383A" }}>
              <Target className="h-5 w-5 text-[#48484A] mx-auto mb-2" />
              <p className="text-xs text-[#636366]">No active goals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGoals.slice(0, 4).map((goal: any) => (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium text-white truncate max-w-[160px]">{goal.title}</span>
                    <span className="text-[11px] text-[#007AFF] font-semibold">{goal.progress_percent}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "#2A2A2C" }}>
                    <motion.div className="h-full rounded-full" style={{ background: "#007AFF" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${goal.progress_percent}%` }}
                      transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] uppercase tracking-widest text-[#636366] font-semibold">Recent Activity</p>
            <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] pulse-dot" />
          </div>
          {statsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
          ) : recentTasks.length === 0 ? (
            <div className="text-center py-6 rounded-xl border" style={{ background: "#242426", borderColor: "#38383A" }}>
              <Clock className="h-5 w-5 text-[#48484A] mx-auto mb-2" />
              <p className="text-xs text-[#636366]">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentTasks.map((task: any, i: number) => (
                <motion.div key={task.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border"
                  style={{ background: "#242426", borderColor: "#38383A" }}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{task.title}</p>
                    <p className="text-[10px] text-[#636366]">{formatTimeAgo(new Date(task.created_at))}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
