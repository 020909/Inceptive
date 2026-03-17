"use client";

import { useState, useEffect, useRef } from "react";
import { Send, User, Bot, Loader2, Info, ChevronDown, Check, X, Shield, Globe, Mail, Twitter, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

// Types
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ToolCall = {
  toolName: string;
  args: any;
  toolCallId: string;
};

type ToolResult = {
  toolName: string;
  result: any;
  toolCallId: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const ToolIcon = ({ name }: { name: string }) => {
  if (name === 'searchWeb') return <Globe className="w-3 h-3 text-blue-400" />;
  if (name === 'draftEmail') return <Mail className="w-3 h-3 text-emerald-400" />;
  if (name === 'scheduleSocialPost') return <Twitter className="w-3 h-3 text-sky-400" />;
  if (name === 'saveResearchReport') return <FileText className="w-3 h-3 text-purple-400" />;
  return <Info className="w-3 h-3 text-gray-400" />;
};

export default function AgentPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  
  // Real-time Diagnostics
  const [lastTrace, setLastTrace] = useState("IDLE");
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
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
  }, [messages, toolCalls, toolResults]);

  const handleSend = async () => {
    if (!input.trim() || !user || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setLastTrace("CONNECTING...");
    setToolCalls([]);
    setToolResults([]);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          user_id: user.id
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to connect to agent");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";
      setLastTrace("STREAMING...");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        setLastTrace(`RECEIVING: ${buffer.length}b`);

        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep the incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          const firstColon = line.indexOf(':');
          if (firstColon === -1) {
            // Raw text fallback
            assistantContent += line;
          } else {
            const type = line.substring(0, firstColon);
            const contentJson = line.substring(firstColon + 1);

            try {
              const data = JSON.parse(contentJson);
              if (type === '0') { // Text Delta
                assistantContent += data;
              } else if (type === '1') { // Tool Call
                setToolCalls(prev => [...prev, data]);
              } else if (type === '2') { // Tool Result
                setToolResults(prev => [...prev, data]);
              } else if (type === '3') { // Error
                setLastTrace(`ERROR: ${data}`);
                toast.error(`Agent Error: ${data}`);
              }
            } catch (e) {
              // Parse failed, treat as raw text
              assistantContent += line;
            }
          }

          // Update message UI
          setMessages(prev => {
            const next = [...prev];
            const msg = next.find(m => m.id === assistantMsgId);
            if (msg) msg.content = assistantContent;
            return next;
          });
        }
      }

      setLastTrace("IDLE");
    } catch (err: any) {
      console.error("[Agent] Request failed:", err);
      setLastTrace(`ERROR: ${err.message}`);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="bg-[#111] p-6 rounded-2xl border border-[#1F1F1F]">
            <Shield className="w-12 h-12 text-[#444] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Authenticated Session Required</h2>
            <p className="text-sm text-gray-500 mb-6">Please sign in to your Inceptive account to access the autonomous agent engine.</p>
            <Button className="w-full bg-white text-black hover:bg-gray-200" onClick={() => (window.location.href = "/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-white p-4 lg:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Inceptive Autonomous Agent
          </h1>
          <p className="text-xs text-[#555] mt-1 tracking-wider uppercase font-semibold flex items-center gap-2">
            Manus Engine v5.0.0
            <span className="bg-[#1F1F1F] text-[#888] px-1.5 py-0.5 rounded text-[10px] border border-[#333]">v5.0.0-ULTRA-STABLE</span>
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-6 px-2 pb-4 scroll-smooth custom-scrollbar" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12">
            <div className="w-16 h-16 rounded-full bg-[#0D0D0D] border border-[#1F1F1F] flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">What is your mission today?</h2>
              <p className="text-sm text-[#888] max-w-sm mx-auto">
                I can research topics, draft emails, and schedule social posts autonomously.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg w-full">
              {[
                "Research the latest news on AI Agents",
                "Draft an introductory email to a VC",
                "Suggest 3 tweets about SpaceX Starship",
                "What is my current goal status?"
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-left px-4 py-3 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] hover:bg-[#111] hover:border-[#333] transition-all text-xs text-gray-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                m.role === "user" ? "bg-white border-white" : "bg-black border-[#1F1F1F]"
              }`}>
                {m.role === "user" ? <User className="w-4 h-4 text-black" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className="space-y-3">
                {m.content && (
                  <div className={`rounded-2xl px-4 py-3 text-sm prose prose-invert max-w-none leading-relaxed ${
                    m.role === "user" ? "bg-white text-black font-medium" : "bg-[#0D0D0D] border border-[#1F1F1F] text-gray-100"
                  }`}>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
                
                {/* Visualizing Autonomous Thoughts/Tools */}
                {m.role === "assistant" && (toolCalls.length > 0) && (
                  <div className="flex flex-col gap-2 w-full">
                    {toolCalls.map((tc, idx) => (
                      <div key={tc.toolCallId || idx} className="flex items-center gap-3 bg-[#080808] border border-[#111] rounded-lg px-3 py-2 text-[11px] text-[#888]">
                        <div className="w-5 h-5 rounded bg-[#111] flex items-center justify-center">
                          <ToolIcon name={tc.toolName} />
                        </div>
                        <span className="flex-1 truncate">Executing <span className="text-white">{tc.toolName}</span>...</span>
                        {toolResults.some(r => r.toolCallId === tc.toolCallId) ? (
                          <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                            <Check className="w-3 h-3" /> Done
                          </div>
                        ) : (
                          <Loader2 className="w-3 h-3 animate-spin text-white/50" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Diagnostics Panel (Small) */}
      <div className="mt-4 p-3 rounded-xl border border-[#1F1F1F] bg-[#050505] text-[10px] font-mono text-[#444] flex justify-between items-center h-8">
        <div className="flex gap-4">
          <span className="text-[#666]">TRACE: <span className={lastTrace.includes('ERROR') ? 'text-red-500' : 'text-emerald-500'}>{lastTrace}</span></span>
          <span className="text-[#666]">MSGS: <span className="text-white">{messages.length}</span></span>
        </div>
        <div className="flex gap-2">
          <span className="bg-[#111] px-1.5 rounded border border-[#1F1F1F]">MANUAL_FETCH_MODE</span>
        </div>
      </div>

      {/* Input Section */}
      <div className="mt-4 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent -top-20 pointer-events-none" />
        <div className="relative group">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type your mission (e.g. 'Update me on the latest news')..."
            disabled={isLoading}
            className="w-full bg-[#0D0D0D] border-[#1F1F1F] text-white rounded-2xl h-14 pl-5 pr-20 focus-visible:ring-1 focus-visible:ring-white transition-all group-hover:border-[#333] shadow-2xl"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="w-10 h-10 rounded-xl bg-white text-black hover:bg-gray-200"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-center text-[#444] mt-3 uppercase tracking-widest font-bold">
          Powered by Inceptive Autonomous ReAct Engine
        </p>
      </div>
    </div>
  );
}
