"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
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

export default function AgentPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  
  const [conversations] = useState([
    { id: "1", title: "Market Research: EV Charging", createdAt: new Date() },
    { id: "2", title: "Competitor Analysis", createdAt: new Date() },
  ]);
  const [activeConversation] = useState("1");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStep]);

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
    const topic = input.trim();
    setInput("");
    setIsProcessing(true);

    try {
      // Step-by-step progress with 800ms delays as requested
      setCurrentStep(1);
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      setCurrentStep(2);
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      setCurrentStep(3);
      await new Promise((resolve) => setTimeout(resolve, 800));

      const response = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic: topic, 
          user_id: user?.id 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("No API key found")) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: "No API key found. Please add your API key in Settings.",
              timestamp: new Date(),
              isError: true,
            },
          ]);
        } else {
          throw new Error(data.error || "Failed to conduct research");
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data.report.content,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${err.message}`,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
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
              onClick={() => setMessages([])}
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
                  I can conduct research, analyze markets, find competitors, and much more. Try asking me "Research the future of SpaceX".
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-2xl lg:max-w-3xl rounded-xl px-4 py-3 text-sm flex flex-col gap-2 ${
                    msg.role === "user"
                      ? "bg-white text-black"
                      : msg.isError
                      ? "bg-[#EF4444]/10 border border-[#EF4444]/30 text-white"
                      : "bg-[#0D0D0D] border border-[#1F1F1F] text-white"
                  }`}
                >
                  {msg.isError && msg.content.includes("Settings") ? (
                    <div className="flex flex-col gap-2">
                       <p className="text-[#EF4444] font-medium">{msg.content.replace("Settings", "")}</p>
                       <Link 
                         href="/settings" 
                         className="text-white underline hover:text-white/80 transition-colors w-fit font-bold"
                       >
                         Settings
                       </Link>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-black/50' : 'text-[#555555]'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {/* Steps feedback */}
            <AnimatePresence>
              {currentStep !== null && (
                <div className="space-y-2 pt-2">
                  {currentStep >= 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs text-[#888888]"
                    >
                      <span className="text-white">🔍</span> Analyzing your request...
                      {currentStep > 1 && <Check className="h-3 w-3 text-emerald-500" />}
                    </motion.div>
                  )}
                  {currentStep >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs text-[#888888]"
                    >
                      <span className="text-white">📡</span> Calling AI with your API key...
                      {currentStep > 2 && <Check className="h-3 w-3 text-emerald-500" />}
                    </motion.div>
                  )}
                  {currentStep >= 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs text-[#888888]"
                    >
                      <span className="text-white">💾</span> Saving to your Research dashboard...
                      {isProcessing && currentStep === 3 && <Loader2 className="h-3 w-3 animate-spin text-white" />}
                    </motion.div>
                  )}
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
