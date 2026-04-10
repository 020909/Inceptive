"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Code, Video, FileSearch, Send, ArrowRight } from "lucide-react";

export type AgentMode = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  welcomeMessage: string;
  systemPrompt: string;
};

export const AGENT_MODES: AgentMode[] = [
  {
    id: "marketing",
    name: "Marketing",
    icon: <Megaphone className="w-5 h-5" />,
    description: "Multi-channel campaigns, social scheduling, and copy.",
    welcomeMessage: "🔥 Marketing Agent activated. I just scheduled 3 posts and drafted 7 cold emails while you were reading this.",
    systemPrompt: "You are an elite Marketing Agent. You specialize in viral hooks, SEO logic, and scheduling optimal posts. Be highly aggressive with growth tactics."
  },
  {
    id: "coding",
    name: "Coding",
    icon: <Code className="w-5 h-5" />,
    description: "Full-stack development, debugging, and architecture.",
    welcomeMessage: "💻 Coding Agent online. I've analyzed your repo structure and I'm ready to ship.",
    systemPrompt: "You are a 10x Staff Engineer. Write perfectly typed, bug-free TypeScript and React. Always provide fully implemented solutions, not partial snippets."
  },
  {
    id: "video",
    name: "Video Editor",
    icon: <Video className="w-5 h-5" />,
    description: "Script generation, pacing, and B-roll selection.",
    welcomeMessage: "🎬 Video Editor ready. Send me your raw footage or topics and I'll cut a viral script.",
    systemPrompt: "You are a top-tier YouTube and TikTok video strategist/editor. Guide the user through hooks, retention mechanics, and pacing."
  },
  {
    id: "research",
    name: "Research & Reporting",
    icon: <FileSearch className="w-5 h-5" />,
    description: "Deep-dive analysis, scraping, and data synthesis.",
    welcomeMessage: "📊 Research Agent deployed. I have full web access. What's the target?",
    systemPrompt: "You are a relentless Research Agent. Use web searches to cross-reference data and provide high-density, citation-backed reports."
  },
  {
    id: "outreach",
    name: "Outreach & Sales",
    icon: <Send className="w-5 h-5" />,
    description: "Lead generation, CRM syncing, and follow-ups.",
    welcomeMessage: "🤝 Outreach Agent active. Give me an ICP and I'll find 100 leads.",
    systemPrompt: "You are a ruthless Sales Director. You specialize in high-converting cold email sequences, DMs, and overcoming objections."
  }
];

interface Props {
  onStartAgent: (mode: AgentMode, initialPrompt: string) => void;
}

export function AgentModeSelector({ onStartAgent }: Props) {
  const [selectedMode, setSelectedMode] = useState<AgentMode | null>(null);
  const [prompt, setPrompt] = useState("");

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMode || !prompt.trim()) return;
    onStartAgent(selectedMode, prompt);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold tracking-tight text-[var(--fg-primary)] mb-3">Select Your Agent</h1>
        <p className="text-[var(--foreground-secondary)] text-sm max-w-lg mx-auto">
          Choose a highly specialized autonomous agent to act on your behalf.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full mb-8">
        {AGENT_MODES.map((mode, i) => {
          const isSelected = selectedMode?.id === mode.id;
          return (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedMode(mode)}
              className={`p-5 rounded-2xl border text-left flex flex-col transition-all duration-200 ${
                isSelected 
                  ? "bg-[var(--foreground)] text-[var(--background)] border-transparent"
                  : "bg-[var(--background-elevated)] text-[var(--fg-primary)] border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                isSelected ? "bg-[var(--background)] text-[var(--foreground)]" : "bg-[var(--background-overlay)] text-[var(--foreground-secondary)]"
              }`}>
                {mode.icon}
              </div>
              <h3 className="font-semibold text-base mb-1">{mode.name}</h3>
              <p className={`text-xs leading-relaxed ${isSelected ? "text-[var(--background)] opacity-80" : "text-[var(--foreground-secondary)]"}`}>
                {mode.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedMode && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: 20 }}
            className="w-full max-w-2xl mx-auto overflow-hidden"
          >
            <form onSubmit={handleStart} className="relative mt-4">
              <input
                type="text"
                autoFocus
                placeholder={`Give the ${selectedMode.name} Agent a primary directive...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-[var(--background-elevated)] border border-[var(--border)] text-[var(--fg-primary)] text-sm rounded-2xl pl-5 pr-14 py-4 outline-none focus:border-[var(--ring)] transition-colors"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
              />
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square rounded-xl bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center disabled:opacity-50 transition-opacity hover:opacity-90"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
