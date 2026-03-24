"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAgent } from "@/lib/agent-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Pause, Play, Square,
  FileText, Folder, Clock, Activity, Cpu,
  ChevronRight, Terminal, Zap, MessageSquare,
  PanelLeft, PanelRight, Maximize2, Minimize2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AgentStatusBar } from "@/components/agent/AgentStatusBar";
import { TaskVisualization } from "@/components/agent/TaskVisualization";
import { FileWorkspace } from "@/components/agent/FileWorkspace";
import { ActivityLog } from "@/components/agent/ActivityLog";
import { MemoryPanel } from "@/components/agent/MemoryPanel";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const { status, tasks, pauseAgent, resumeAgent, logs } = useAgent();

  // Panel visibility states
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [activeLeftTab, setActiveLeftTab] = useState<"chat" | "tasks">("chat");
  const [activeRightTab, setActiveRightTab] = useState<"files" | "memory" | "logs">("files");

  // Chat state
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: "user" as const,
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Simulate agent response - replace with real API call
    setTimeout(() => {
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "I'm processing your request. This is a demo response - integrate with your actual agent API here.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 1500);
  };

  const firstName = user?.email?.split("@")[0] || "there";
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      {/* Top Navigation Bar */}
      <AgentStatusBar
        status={status}
        onPause={pauseAgent}
        onResume={resumeAgent}
        taskCount={tasks.length}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat / Tasks */}
        <AnimatePresence mode="wait">
          {showLeftPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex flex-col border-r border-[var(--border)] bg-[var(--background-elevated)]"
            >
              {/* Tab Switcher */}
              <div className="flex border-b border-[var(--border)]">
                <button
                  onClick={() => setActiveLeftTab("chat")}
                  className={cn(
                    "flex-1 px-4 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-2",
                    activeLeftTab === "chat"
                      ? "text-[var(--foreground)] border-b border-[var(--foreground)]"
                      : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat
                </button>
                <button
                  onClick={() => setActiveLeftTab("tasks")}
                  className={cn(
                    "flex-1 px-4 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-2",
                    activeLeftTab === "tasks"
                      ? "text-[var(--foreground)] border-b border-[var(--foreground)]"
                      : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
                  )}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Tasks
                  {tasks.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] rounded">
                      {tasks.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {activeLeftTab === "chat" ? (
                  <div className="h-full flex flex-col">
                    {/* Chat Messages */}
                    <div
                      ref={scrollRef}
                      className="flex-1 overflow-y-auto p-4 space-y-4"
                    >
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-6">
                          <div className="w-12 h-12 rounded-xl bg-[var(--background-overlay)] border border-[var(--border)] flex items-center justify-center mb-4">
                            <Zap className="w-5 h-5 text-[var(--foreground-secondary)]" />
                          </div>
                          <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                            Good {greeting()}, {firstName}
                          </h3>
                          <p className="text-xs text-[var(--foreground-tertiary)] max-w-[240px]">
                            Your AI agent is ready. Describe what you need and I'll handle it autonomously.
                          </p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "flex gap-3",
                              msg.role === "user" ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0",
                              msg.role === "user"
                                ? "bg-[var(--foreground)] text-[var(--background)]"
                                : "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]"
                            )}>
                              {msg.role === "user" ? firstName[0]?.toUpperCase() : "AI"}
                            </div>
                            <div className={cn(
                              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                              msg.role === "user"
                                ? "bg-[var(--foreground)] text-[var(--background)]"
                                : "bg-[var(--background-overlay)] border border-[var(--border)] text-[var(--foreground)]"
                            )}>
                              {msg.role === "assistant" ? (
                                <div className="prose-inceptive text-inherit">
                                  <ReactMarkdown>
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                msg.content
                              )}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-[var(--border)]">
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          placeholder="What should I do?"
                          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 pr-12 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
                          rows={1}
                          style={{ maxHeight: "120px" }}
                        />
                        <button
                          onClick={handleSend}
                          disabled={!input.trim() || isLoading}
                          className="absolute right-2 bottom-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--foreground-muted)] mt-2 text-center">
                        Press Enter to send, Shift+Enter for new line
                      </p>
                    </div>
                  </div>
                ) : (
                  <TaskVisualization tasks={tasks} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Left Panel */}
        <button
          onClick={() => setShowLeftPanel(!showLeftPanel)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-16 bg-[var(--background-elevated)] border border-[var(--border)] border-l-0 rounded-r-lg flex items-center justify-center text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] transition-colors"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        {/* Center Panel - Main Activity / Preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
          {/* Activity Header */}
          <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[var(--foreground-tertiary)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Activity
                </span>
              </div>
              {status === "working" && (
                <span className="px-2 py-0.5 text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] rounded-full animate-pulse">
                  Processing
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] transition-colors">
                Clear
              </button>
            </div>
          </div>

          {/* Activity Content - Live Task Feed */}
          <ActivityLog logs={logs} />
        </div>

        {/* Right Panel - Files / Memory / Logs */}
        <AnimatePresence mode="wait">
          {showRightPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex flex-col border-l border-[var(--border)] bg-[var(--background-elevated)]"
            >
              {/* Tab Switcher */}
              <div className="flex border-b border-[var(--border)]">
                <button
                  onClick={() => setActiveRightTab("files")}
                  className={cn(
                    "flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                    activeRightTab === "files"
                      ? "text-[var(--foreground)] border-b border-[var(--foreground)]"
                      : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
                  )}
                >
                  <Folder className="w-3.5 h-3.5" />
                  Files
                </button>
                <button
                  onClick={() => setActiveRightTab("memory")}
                  className={cn(
                    "flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                    activeRightTab === "memory"
                      ? "text-[var(--foreground)] border-b border-[var(--foreground)]"
                      : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
                  )}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Memory
                </button>
                <button
                  onClick={() => setActiveRightTab("logs")}
                  className={cn(
                    "flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                    activeRightTab === "logs"
                      ? "text-[var(--foreground)] border-b border-[var(--foreground)]"
                      : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Logs
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {activeRightTab === "files" && <FileWorkspace />}
                {activeRightTab === "memory" && <MemoryPanel />}
                {activeRightTab === "logs" && (
                  <div className="h-full p-4 overflow-y-auto">
                    <div className="space-y-2">
                      {logs.slice(-20).map((log, i) => (
                        <div
                          key={i}
                          className="text-[11px] font-mono text-[var(--foreground-tertiary)]"
                        >
                          <span className="text-[var(--foreground-muted)]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          {" "}
                          <span className={cn(
                            log.level === "error" && "text-[var(--destructive)]",
                            log.level === "success" && "text-[var(--success)]",
                            log.level === "warning" && "text-[var(--warning)]"
                          )}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Right Panel */}
        <button
          onClick={() => setShowRightPanel(!showRightPanel)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-16 bg-[var(--background-elevated)] border border-[var(--border)] border-r-0 rounded-l-lg flex items-center justify-center text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] transition-colors"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
