"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Moon,
  Loader2,
  Check,
  Search,
  MessageSquare,
  Plus,
  AlertCircle,
  Database,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isError?: boolean;
}

interface Step {
  id: string;
  label: string;
  status: "pending" | "loading" | "complete";
  icon: any;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
}

const RESEARCH_KEYWORDS = [
  "research",
  "find",
  "analyze",
  "look up",
  "investigate",
  "competitors",
  "market",
];

export default function AgentPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<Step[]>([]);
  
  const [conversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentSteps]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userPrompt = input.trim().toLowerCase();
    setInput("");
    setIsProcessing(true);

    // Initial steps
    const steps: Step[] = [
      { id: "1", label: "RESEARCH — Analyzing your request...", status: "loading", icon: Search },
      { id: "2", label: "FETCHING — Calling AI with your API key...", status: "pending", icon: Radio },
      { id: "3", label: "SAVING — Saving report to your dashboard...", status: "pending", icon: Database },
      { id: "4", label: "COMPLETE — Report ready. Check your Research tab.", status: "pending", icon: Check },
    ];
    setCurrentSteps(steps);

    // Detect research intent
    const isResearchRequest = RESEARCH_KEYWORDS.some(k => userPrompt.includes(k));

    if (isResearchRequest) {
      try {
        // Step 1: Analyzing... (done by UI)
        await new Promise(r => setTimeout(r, 1000));
        setCurrentSteps(prev => prev.map(s => s.id === "1" ? { ...s, status: "complete" } : s.id === "2" ? { ...s, status: "loading" } : s));

        // Step 2: Calling AI
        const response = await fetch("/api/agent/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: userPrompt, user_id: user?.id }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.error?.includes("No API key found")) {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: "assistant",
              content: "You haven't added an API key yet. Go to Settings to add your Gemini, OpenAI, or Claude key.",
              timestamp: new Date(),
              isError: true
            }]);
            setCurrentSteps([]);
            return;
          }
          throw new Error(data.error || "Failed to conduct research");
        }

        setCurrentSteps(prev => prev.map(s => s.id === "2" ? { ...s, status: "complete" } : s.id === "3" ? { ...s, status: "loading" } : s));
        
        // Step 3: Saving... (already done by API, just simulate short delay for UX)
        await new Promise(r => setTimeout(r, 800));
        setCurrentSteps(prev => prev.map(s => s.id === "3" ? { ...s, status: "complete" } : s.id === "4" ? { ...s, status: "loading" } : s));

        // Step 4: Complete
        await new Promise(r => setTimeout(r, 500));
        setCurrentSteps(prev => prev.map(s => s.id === "4" ? { ...s, status: "complete" } : s));

        // Add final report message
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: data.report.content,
          timestamp: new Date(),
        }]);

      } catch (err: any) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${err.message}`,
          timestamp: new Date(),
          isError: true
        }]);
        setCurrentSteps([]);
      } finally {
        setIsProcessing(false);
        // Clear steps after a few seconds
        setTimeout(() => setCurrentSteps([]), 5000);
      }
    } else {
      // For non-research, we just give a simple response for now or call a generic AI
      // The requirement focuses on Research fixing.
      await new Promise(r => setTimeout(r, 1000));
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm currently specialized in Research tasks. Try asking me to 'Research' a topic or 'Analyze' a market!",
        timestamp: new Date(),
      }]);
      setIsProcessing(false);
      setCurrentSteps([]);
    }
  };

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] -m-6 md:-m-8">
        {/* Conversation Sidebar */}
        <div className="hidden lg:flex w-[280px] flex-col bg-[#050505] border-r border-[#1F1F1F] h-full">
          <div className="p-4">
            <Button
              className="w-full h-10 bg-[#111111] text-white hover:bg-[#1F1F1F] border border-[#1F1F1F] rounded-lg text-sm font-medium transition-all duration-200"
              onClick={() => { setMessages([]); setCurrentSteps([]); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  activeConversation === conv.id
                    ? "bg-[#111111] text-white"
                    : "text-[#888888] hover:bg-[#0A0A0A] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col relative max-w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F1F]">
            <h1 className="text-lg font-bold text-white">Agent</h1>
            <Button className="bg-white text-black hover:bg-white/90 rounded-lg h-9 px-4 text-sm font-medium transition-all duration-200">
              <Moon className="h-4 w-4 mr-2" />
              Run Overnight
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D0D0D] border border-[#1F1F1F] mb-6">
                  <BotIcon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  What should your AI work on?
                </h3>
                <p className="text-sm text-[#888888] max-w-md">
                  Ask me to research a topic, analyze a market, or find competitors. I&apos;ll execute it in real-time.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-3xl rounded-xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-white text-black"
                      : msg.isError
                      ? "bg-[#EF4444]/10 border border-[#EF4444]/30 text-white"
                      : "bg-[#0D0D0D] border border-[#1F1F1F] text-white"
                  }`}
                >
                  {msg.isError && msg.content.includes("Settings") ? (
                    <div>
                      {msg.content.split("Settings")[0]}
                      <Link href="/settings" className="text-white underline font-semibold">
                        Settings
                      </Link>
                      {msg.content.split("Settings")[1]}
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none">
                       <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  <p className={`text-[10px] mt-2 ${msg.role === "user" ? "text-black/50" : "text-[#555555]"}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {/* Status Steps */}
            <AnimatePresence>
              {currentSteps.length > 0 && (
                <div className="space-y-3 pt-4">
                  {currentSteps.map((step) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg border text-sm transition-colors duration-200 ${
                        step.status === "loading"
                          ? "bg-[#111111] border-[#333333] text-white"
                          : step.status === "complete"
                          ? "bg-[#0D0D0D] border-[#1F1F1F] text-[#888888]"
                          : "bg-transparent border-transparent text-[#555555]"
                      }`}
                    >
                      {step.status === "loading" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <step.icon className={`h-3.5 w-3.5 ${step.status === 'complete' ? 'text-white' : ''}`} />
                      )}
                      <span className="font-medium">{step.label}</span>
                      {step.status === "complete" && <Check className="h-3 w-3 ml-auto text-white" />}
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-[#1F1F1F]">
            <form onSubmit={handleSend} className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message your AI agent..."
                disabled={isProcessing}
                className="flex-1 h-11 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200"
              />
              <Button
                type="submit"
                disabled={isProcessing || !input.trim()}
                className="h-11 w-11 bg-white text-black hover:bg-white/90 rounded-lg transition-all duration-200 p-0 shrink-0"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
