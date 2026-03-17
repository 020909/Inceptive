"use client";

import React, { useRef, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Moon,
  Loader2,
  Cpu,
  Globe,
  Mail,
  Share2,
  FileText,
  Target,
  Plus,
  MessageSquare
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolInvocations?: any[];
}

/**
 * v3.0-MANUAL-RESILIENCE Overhaul
 * This component replaces useChat with a manual fetch loop for 100% transparency.
 */
function AgentChatContent({ user }: { user: any }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastTrace, setLastTrace] = useState<string>("IDLE");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setLastTrace("CONNECTING...");

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          user_id: user.id,
        }),
      });

      setLastTrace(`${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      setLastTrace("STREAMING...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = ""; // Buffer for partial chunks

      // Initialize assistant message
      setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setLastTrace(`RECEIVING: ${chunk.length}b`);
        
        // Protocol-Agnostic Aggressive Update:
        // If it's a standard token (no SDK prefix), just append it.
        // If it looks like protocol lines (0:"), try to parse them.
        
        if (chunk.includes('\n')) {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const firstColon = line.indexOf(':');
            
            if (firstColon !== -1 && firstColon < 3) {
              const type = line.substring(0, firstColon);
              const content = line.substring(firstColon + 1);
              try {
                if (type === '0') { // Text chunk
                   assistantContent += JSON.parse(content);
                } else if (type === '1') { // Tool Call
                  const toolCall = JSON.parse(content);
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const toolInvocations = m.toolInvocations || [];
                    return { ...m, toolInvocations: [...toolInvocations, { ...toolCall, state: 'call' }] };
                  }));
                } else if (type === '2') { // Tool Result
                  const toolResult = JSON.parse(content);
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const toolInvocations = (m.toolInvocations || []).map(ti => 
                      ti.toolCallId === toolResult.toolCallId ? { ...ti, state: 'result', result: toolResult.result } : ti
                    );
                    return { ...m, toolInvocations };
                  }));
                }
              } catch (e) { assistantContent += content; }
            } else {
              assistantContent += line + "\n";
            }
          }
        } else {
          // If no newlines, check if it's a likely raw text token
          if (!chunk.includes(':') || chunk.length > 5) {
            assistantContent += chunk;
          } else {
            buffer += chunk; // Might be a partial protocol chunk
          }
        }

        setMessages(prev => prev.map(m => 
          m.id === assistantMsgId ? { ...m, content: assistantContent } : m
        ));
      }

    } catch (err: any) {
      console.error("[v3.0] Stream Error:", err);
      setLastTrace(`ERROR: ${err.message}`);
      toast.error(`Agent Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col relative max-w-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F1F]">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#888]" />
            Inceptive Autonomous Agent
          </h1>
          <p className="text-xs text-[#555] mt-1 tracking-wider uppercase font-semibold flex items-center gap-2">
            Manus Engine v4.0.0
            <span className="bg-[#1F1F1F] text-[#888] px-1.5 py-0.5 rounded text-[10px] border border-[#333]">v4.0.0-STABLE</span>
          </p>
        </div>
        <Button className="bg-white text-black hover:bg-white/90 rounded-lg h-9 px-4 text-sm font-medium">
          <Moon className="h-4 w-4 mr-2" /> Run Overnight
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D0D0D] border border-[#1F1F1F] mb-6">
              <BotIcon className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Complex tasks, fully automated.</h3>
            <p className="text-sm text-[#888888] max-w-md">
              Try: "Research current events in AI, summarize them, and draft me an update."
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            {m.content && (
              <div
                className={`max-w-2xl lg:max-w-3xl rounded-xl px-4 py-3 text-sm flex flex-col gap-2 mb-2 ${
                  m.role === "user" ? "bg-white text-black" : "bg-[#0D0D0D] border border-[#1F1F1F] text-white"
                }`}
              >
                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            )}

            {m.toolInvocations?.map((toolInv: any) => (
              <div key={toolInv.toolCallId} className="w-full max-w-2xl lg:max-w-3xl mb-4 ml-2">
                <div className="bg-[#050505] border border-[#1F1F1F] rounded-lg p-3 overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#888] uppercase tracking-wider">
                      <ToolIcon toolName={toolInv.toolName} />
                      <span>{toolInv.toolName}</span>
                    </div>
                    {toolInv.state === "result" ? (
                      <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">Success</span>
                    ) : (
                      <div className="flex items-center gap-2 text-[10px] text-[#555] animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    )}
                  </div>
                  <div className="bg-black border border-[#111] rounded p-2 text-xs font-mono text-[#555] whitespace-pre-wrap overflow-x-auto">
                    <span className="text-[#888]">// Executing:</span>
                    <br />
                    {JSON.stringify(toolInv.args, null, 2)}
                  </div>
                  {toolInv.state === "result" && (
                    <div className="mt-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded p-2 text-xs font-mono text-emerald-500/80 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      <span className="text-[#555]">// Result:</span>
                      <br />
                      {typeof toolInv.result === 'object' ? JSON.stringify(toolInv.result, null, 2) : String(toolInv.result)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div ref={messagesEndRef} />
        
        {/* NETWORK TRACE PANEL (v3.0) */}
        <div className="mt-8 p-4 rounded-xl border border-[#1F1F1F] bg-[#050505] text-[10px] font-mono text-[#444]">
          <p className="mb-1 text-[#666] uppercase font-bold tracking-widest text-[9px]">NETWORK TRACE (v3.0)</p>
          <p>USER_ID: {user.id}</p>
          <p>LAST_EVENT: <span className={lastTrace.includes('ERROR') ? 'text-red-500' : 'text-emerald-500'}>{lastTrace}</span></p>
          <p>MESSAGES: {messages.length}</p>
          <p className="mt-1 text-emerald-500/30">Manual fetch mode active. Bypassing SDK protocols.</p>
        </div>
      </div>

      <div className="p-4 border-t border-[#1F1F1F] bg-[#050505]">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Give your agent a complex mission..."
            disabled={isLoading}
            className="flex-1 h-12 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-xl focus:border-white focus:ring-0 shadow-inner"
          />
          <Button
            type="submit"
            disabled={isLoading || !input?.trim()}
            className="h-12 w-12 bg-white text-black rounded-xl p-0 hover:scale-95 transition-transform"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-1" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AgentPage() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] -m-6 md:-m-8">
        <div className="hidden lg:flex w-[280px] flex-col bg-[#050505] border-r border-[#1F1F1F] h-full">
          <div className="p-4">
            <Button className="w-full h-10 bg-[#111111] text-white border border-[#1F1F1F] rounded-lg">
              <Plus className="h-4 w-4 mr-2" /> New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            <button className="w-full text-left px-3 py-2.5 rounded-lg text-sm bg-[#111111] text-white">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Current Session</span>
              </div>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-[#444]">
             <Loader2 className="h-8 w-8 animate-spin mb-4" />
             <p className="text-sm font-mono tracking-widest uppercase">Syncing Autonomous Session...</p>
          </div>
        ) : !user ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-[#EF4444]">
             <p className="text-sm font-bold uppercase tracking-widest">Authentication Required</p>
             <p className="text-xs text-[#555] mt-2">Please login to access the autonomous agent.</p>
          </div>
        ) : (
          <AgentChatContent user={user} key={user.id} />
        )}
      </div>
    </PageTransition>
  );
}

function ToolIcon({ toolName }: { toolName: string }) {
  const cn = "h-4 w-4";
  switch (toolName) {
    case "searchWeb": return <Globe className={cn} />;
    case "draftEmail": return <Mail className={cn} />;
    case "scheduleSocialPost": return <Share2 className={cn} />;
    case "saveResearchReport": return <FileText className={cn} />;
    case "updateGoalProgress": return <Target className={cn} />;
    default: return <Cpu className={cn} />;
  }
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
