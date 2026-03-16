"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Mail,
  Share2,
  Globe,
  MessageSquare,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ActionItem {
  id: string;
  type: "RESEARCH" | "EMAIL" | "SOCIAL" | "BROWSER";
  description: string;
  status: "loading" | "complete";
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
}

const actionIcons = {
  RESEARCH: Search,
  EMAIL: Mail,
  SOCIAL: Share2,
  BROWSER: Globe,
};

const actionColors = {
  RESEARCH: "text-[#888888]",
  EMAIL: "text-[#888888]",
  SOCIAL: "text-[#888888]",
  BROWSER: "text-[#888888]",
};

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="hidden lg:flex w-[280px] flex-col bg-[#050505] border-r border-[#1F1F1F] h-full">
      <div className="p-4">
        <Button
          onClick={onNew}
          className="w-full h-10 bg-[#111111] text-white hover:bg-[#1F1F1F] border border-[#1F1F1F] rounded-lg text-sm font-medium transition-all duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
              activeId === conv.id
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
  );
}

function ActionFeed({ actions }: { actions: ActionItem[] }) {
  return (
    <div className="space-y-3">
      <AnimatePresence>
        {actions.map((action) => {
          const Icon = actionIcons[action.type];
          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[#0D0D0D] border border-[#1F1F1F]"
            >
              <div className="mt-0.5">
                {action.status === "loading" ? (
                  <Loader2 className="h-4 w-4 text-[#888888] animate-spin" />
                ) : (
                  <Check className="h-4 w-4 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${actionColors[action.type]}`}
                  >
                    {action.type}
                  </span>
                  <Icon className="h-3 w-3 text-[#555555]" />
                </div>
                <p className="text-sm text-white">{action.description}</p>
              </div>
              <span className="text-[10px] text-[#555555] mt-1">
                {action.timestamp.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default function AgentPage() {
  useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversations] = useState<Conversation[]>([
    {
      id: "1",
      title: "Research competitor analysis",
      createdAt: new Date(),
    },
  ]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    "1"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, actions]);

  const simulateAgentActions = async () => {
    const actionSequence: Omit<ActionItem, "id" | "timestamp" | "status">[] = [
      { type: "RESEARCH", description: "Searching for relevant information..." },
      { type: "BROWSER", description: "Browsing top results and extracting data..." },
      { type: "EMAIL", description: "Drafting summary email with findings..." },
      { type: "SOCIAL", description: "Creating social media post draft..." },
    ];

    for (let i = 0; i < actionSequence.length; i++) {
      const action: ActionItem = {
        id: `action-${Date.now()}-${i}`,
        ...actionSequence[i],
        status: "loading",
        timestamp: new Date(),
      };

      setActions((prev) => [...prev, action]);

      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

      setActions((prev) =>
        prev.map((a) =>
          a.id === action.id ? { ...a, status: "complete" as const } : a
        )
      );
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content:
          "I've completed the research and prepared a summary. I found relevant data, drafted an email, and created a social media post. Check your Email and Social Media tabs for the results.",
        timestamp: new Date(),
      },
    ]);

    setIsProcessing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);
    setActions([]);

    simulateAgentActions();
  };

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] -m-6 md:-m-8">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversation}
          onSelect={setActiveConversation}
          onNew={() => {
            setMessages([]);
            setActions([]);
          }}
        />

        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F1F]">
            <h1 className="text-lg font-bold text-white">Agent</h1>
            <Button className="bg-white text-black hover:bg-white/90 rounded-lg h-9 px-4 text-sm font-medium transition-all duration-200">
              <Moon className="h-4 w-4 mr-2" />
              Run Overnight
            </Button>
          </div>

          {/* Messages + Actions */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && actions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D0D0D] border border-[#1F1F1F] mb-6">
                  <MessageSquare className="h-7 w-7 text-[#555555]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  What should your AI work on?
                </h3>
                <p className="text-sm text-[#888888] max-w-md">
                  Type a goal or task below and watch your agent execute it in
                  real-time with live action updates.
                </p>
              </div>
            )}

            {messages
              .filter((m) => m.role === "user")
              .map((message) => (
                <div
                  key={message.id}
                  className="flex justify-end"
                >
                  <div className="max-w-md rounded-xl bg-white text-black px-4 py-3 text-sm">
                    {message.content}
                  </div>
                </div>
              ))}

            {actions.length > 0 && <ActionFeed actions={actions} />}

            {messages
              .filter((m) => m.role === "assistant")
              .map((message) => (
                <div key={message.id} className="flex justify-start">
                  <div className="max-w-md rounded-xl bg-[#0D0D0D] border border-[#1F1F1F] px-4 py-3 text-sm text-white">
                    {message.content}
                  </div>
                </div>
              ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-[#1F1F1F]">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell your agent what to do..."
                disabled={isProcessing}
                className="flex-1 h-11 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200"
              />
              <Button
                type="submit"
                disabled={isProcessing || !input.trim()}
                className="h-11 w-11 bg-white text-black hover:bg-white/90 rounded-lg transition-all duration-200 p-0"
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
