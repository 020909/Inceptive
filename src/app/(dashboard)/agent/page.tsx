"use client";

import React, { useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { createClient } from "@/lib/supabase";
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

export default function AgentPage() {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  // Vercel AI SDK hook for streaming messages and tool calls
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = (useChat as any)({
    api: "/api/agent/stream",
    body: {
      user_id: user?.id,
    },
    // We pass user_id again in the submission to be safe
    onResponse: () => {
      console.log("Agent started responding...");
    },
    onError: (err: any) => {
      console.error("Agent Error:", err);
    }
  });

  const onAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim()) return;
    
    if (!user?.id) {
      toast.error("Still synchronizing your session... please wait 2 seconds.");
      return;
    }
    // Force user_id into the body for this specific request
    handleSubmit(e, {
      body: {
        user_id: user.id
      }
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) scrollToBottom();
  }, [messages, isLoading, mounted]);

  if (!mounted) return null;

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] -m-6 md:-m-8">
        
        {/* Sidebar */}
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

        {/* Main Agent Interface */}
        <div className="flex flex-1 flex-col relative max-w-full overflow-hidden">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F1F]">
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="h-5 w-5 text-[#888]" />
                Inceptive Autonomous Agent
              </h1>
              <p className="text-xs text-[#555] mt-1 tracking-wider uppercase font-semibold">Manus Engine v2.0</p>
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
                  I can chain actions together. Try saying: "Research the history of SpaceX, draft an email to Elon Musk about it, and schedule a tweet summarizing the key findings."
                </p>
              </div>
            )}

            {messages.map((m: any) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                
                {/* Standard Text Message */}
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

                {/* Tool Invocations (The "Manus's Computer" view) */}
                {m.toolInvocations?.map((toolInv: any) => (
                  <div key={toolInv.toolCallId} className="w-full max-w-2xl lg:max-w-3xl mb-4 ml-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-[#1F1F1F] to-transparent" />
                    </div>

                    <div className="bg-[#050505] border border-[#1F1F1F] rounded-lg p-3 overflow-hidden">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#888] uppercase tracking-wider">
                          <ToolIcon toolName={toolInv.toolName} />
                          <span>{toolInv.toolName}</span>
                        </div>
                        {toolInv.state === "result" ? (
                          <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">Success</span>
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin text-[#888]" />
                        )}
                      </div>

                      <div className="bg-black border border-[#111] rounded p-2 text-xs font-mono text-[#555] whitespace-pre-wrap overflow-x-auto">
                        <span className="text-[#888]">// Args:</span>
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

            {error && (
              <div className="max-w-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-xl px-4 py-3 text-sm">
                Error: {error.message}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="p-4 border-t border-[#1F1F1F] bg-[#050505]">
            <form onSubmit={onAgentSubmit} className="flex gap-3 max-w-4xl mx-auto">
              <Input
                value={input}
                onChange={handleInputChange}
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
