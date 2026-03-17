"use client";

import { useState, useEffect, useRef } from "react";
import { Send, User, Bot, Loader2, Globe, Mail, FileText, Shield, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

type Message = { id: string; role: "user" | "assistant"; content: string };
type ToolCall = { toolName: string; args: any; toolCallId: string };
type ToolResult = { toolName: string; result: any; toolCallId: string };

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
  return createClient(url, key);
};
const supabase = getSupabase();

const TOOL_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  searchWeb: { icon: <Globe className="w-3.5 h-3.5" />, label: "Searching the web", color: "#007AFF" },
  draftEmail: { icon: <Mail className="w-3.5 h-3.5" />, label: "Drafting email", color: "#30D158" },
  scheduleSocialPost: { icon: <Zap className="w-3.5 h-3.5" />, label: "Scheduling post", color: "#FFD60A" },
  saveResearchReport: { icon: <FileText className="w-3.5 h-3.5" />, label: "Saving report", color: "#BF5AF2" },
};

const SUGGESTIONS = [
  "Research the latest trends in AI agents",
  "Draft an intro email to a potential investor",
  "What are the top 5 SaaS tools for founders?",
  "Summarise my current goal status",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "#8E8E93" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export default function AgentPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, toolCalls]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || !user || isLoading) return;
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
        body: JSON.stringify({ messages: [...messages, userMsg], user_id: user.id }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to connect to agent");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream available");

      const decoder = new TextDecoder();
      let assistantContent = "";
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
          if (firstColon === -1) { assistantContent += line; continue; }
          const type = line.substring(0, firstColon);
          const contentJson = line.substring(firstColon + 1);
          try {
            const data = JSON.parse(contentJson);
            if (type === "0") { assistantContent += data; }
            else if (type === "1") { setToolCalls(prev => [...prev, data]); }
            else if (type === "2") { setToolResults(prev => [...prev, data]); }
            else if (type === "3") { toast.error(`Agent Error: ${data}`); }
          } catch { assistantContent += line; }

          setMessages(prev => {
            const next = [...prev];
            const msg = next.find(m => m.id === assistantMsgId);
            if (msg) msg.content = assistantContent;
            return next;
          });
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#007AFF]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4 max-w-sm"
        >
          <div className="p-6 rounded-2xl border" style={{ background: "#242426", borderColor: "#38383A" }}>
            <Shield className="w-10 h-10 text-[#48484A] mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Sign in required</h2>
            <p className="text-sm text-[#8E8E93] mb-5">
              Please sign in to access the Inceptive agent.
            </p>
            <Button
              className="w-full font-semibold rounded-xl border-0 hover:opacity-90"
              style={{ background: "#007AFF", color: "#FFFFFF" }}
              onClick={() => (window.location.href = "/login")}
            >
              Go to Login
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-4 mb-2 border-b border-[#2C2C2E]"
      >
        <div>
          <h1 className="text-xl font-bold text-white">Agent</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] pulse-dot" />
            <span className="text-xs text-[#8E8E93]">Inceptive Engine · Ready</span>
          </div>
        </div>
      </motion.div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full py-16 text-center"
            >
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 border"
                style={{ background: "#007AFF18", borderColor: "#007AFF30" }}
                animate={{ boxShadow: ["0 0 16px rgba(0,122,255,0.1)", "0 0 32px rgba(0,122,255,0.2)", "0 0 16px rgba(0,122,255,0.1)"] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Bot className="w-6 h-6 text-[#007AFF]" />
              </motion.div>
              <h2 className="text-lg font-semibold text-white mb-2">What&apos;s your mission?</h2>
              <p className="text-sm text-[#8E8E93] mb-8 max-w-xs">
                I can research topics, draft emails, schedule posts, and more — autonomously.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <motion.button
                    key={s}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setInput(s)}
                    className="text-left px-4 py-3 rounded-xl border text-xs text-[#8E8E93] hover:text-white transition-colors duration-150"
                    style={{ background: "#242426", borderColor: "#38383A" }}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-3 max-w-[82%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${
                  m.role === "user"
                    ? "border-white/20 bg-white"
                    : "border-[#007AFF]/30 bg-[#007AFF]/10"
                }`}>
                  {m.role === "user"
                    ? <User className="w-3.5 h-3.5 text-black" />
                    : <Bot className="w-3.5 h-3.5 text-[#007AFF]" />
                  }
                </div>

                <div className="space-y-2">
                  {/* Message bubble */}
                  {m.content ? (
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "text-white"
                        : "text-[#E5E5EA]"
                    }`} style={{
                      background: m.role === "user" ? "#007AFF" : "#242426",
                      border: m.role === "user" ? "none" : "1px solid #38383A",
                    }}>
                      {m.role === "assistant" ? (
                        <div className="prose-inceptive">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : m.content}
                    </div>
                  ) : isLoading && i === messages.length - 1 ? (
                    <div className="rounded-2xl border" style={{ background: "#242426", borderColor: "#38383A" }}>
                      <TypingIndicator />
                    </div>
                  ) : null}

                  {/* Tool calls */}
                  {m.role === "assistant" && toolCalls.length > 0 && i === messages.length - 1 && (
                    <div className="space-y-1.5">
                      {toolCalls.map((tc, idx) => {
                        const meta = TOOL_META[tc.toolName];
                        const isDone = toolResults.some(r => r.toolCallId === tc.toolCallId);
                        return (
                          <motion.div
                            key={tc.toolCallId || idx}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
                            style={{ background: "#1C1C1E", borderColor: isDone ? "#2C2C2E" : `${meta?.color || "#007AFF"}30` }}
                          >
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${meta?.color || "#007AFF"}18`, color: meta?.color || "#007AFF" }}>
                              {meta?.icon || <Globe className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs text-[#8E8E93] flex-1">
                              {meta?.label || tc.toolName}
                              {tc.args?.query && <span className="text-white ml-1">"{tc.args.query}"</span>}
                            </span>
                            {isDone ? (
                              <div className="flex items-center gap-1 text-[#30D158]">
                                <Check className="w-3 h-3" />
                                <span className="text-[10px] font-medium">Done</span>
                              </div>
                            ) : (
                              <Loader2 className="w-3 h-3 animate-spin text-[#8E8E93]" />
                            )}
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
      <div className="pt-4 border-t border-[#2C2C2E]">
        <div className="relative rounded-2xl border transition-colors duration-150"
          style={{ background: "#242426", borderColor: isLoading ? "#007AFF40" : "#38383A" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type your mission… (Enter to send, Shift+Enter for new line)"
            disabled={isLoading}
            rows={1}
            className="w-full bg-transparent text-white text-sm placeholder:text-[#48484A] resize-none px-4 py-3.5 pr-14 outline-none leading-relaxed"
            style={{ maxHeight: "160px" }}
          />
          <div className="absolute right-2.5 bottom-2.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40"
              style={{ background: input.trim() && !isLoading ? "#007AFF" : "#2A2A2C" }}
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-white" />
                : <Send className="w-4 h-4 text-white" />
              }
            </motion.button>
          </div>
        </div>
        <p className="text-[10px] text-center text-[#48484A] mt-2 uppercase tracking-widest">
          Powered by Inceptive Autonomous Engine
        </p>
      </div>
    </div>
  );
}
