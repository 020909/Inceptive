'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Search, Mail, Sparkles, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

const ghostSuggestions = [
  "Summarize my latest emails",
  "Draft a marketing campaign",
  "Research market trends for AI",
  "Generate code for a new feature"
];

const toolSuggestions = [
  { name: "Agent", icon: Bot, command: "/agent", desc: "Activate specialized agent" },
  { name: "Research", icon: Search, command: "/research", desc: "Deep web research" },
  { name: "Email", icon: Mail, command: "/email", desc: "Manage your inbox" },
];

export function OmniscientInputBar() {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Rotate ghost suggestions
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIndex((prev) => (prev + 1) % ghostSuggestions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const showToolSuggestions = inputValue.startsWith('/') || (isFocused && inputValue.length === 0);

  return (
    <motion.div 
      className="relative w-full"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      {/* Ghost Suggestions / Tool List Above Bar */}
      <AnimatePresence mode="wait">
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 w-full mb-4 px-2 pointer-events-none"
          >
            {showToolSuggestions ? (
              <div className="flex flex-wrap gap-2 pointer-events-auto">
                {toolSuggestions.map((tool, idx) => (
                  <motion.div
                    key={tool.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#282828]/80 backdrop-blur-xl border border-white/10 ambient-shadow cursor-pointer hover:bg-white/[0.05] transition-colors"
                    onClick={() => {
                      setInputValue(tool.command + ' ');
                      inputRef.current?.focus();
                    }}
                  >
                    <tool.icon size={14} className="text-white/60" strokeWidth={1.5} />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-white tracking-tight">{tool.name}</span>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest">{tool.command}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : inputValue.length === 0 ? (
              <motion.div 
                className="flex items-center gap-2 text-white/30 text-xs font-medium tracking-tight ml-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Sparkles size={12} strokeWidth={2} />
                <span>Try: "{ghostSuggestions[suggestionIndex]}"</span>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Bar */}
      <motion.div
        className={cn(
          "relative flex items-end gap-3 p-3 rounded-[24px] bg-[#282828]/60 backdrop-blur-2xl border transition-all duration-500",
          isFocused 
            ? "border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.05)] bg-[#282828]/80" 
            : "border-white/10 ambient-shadow"
        )}
      >
        {/* Left Action / Context Icon */}
        <div className="h-11 flex items-center justify-center pl-1">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <Command size={14} className="text-white/40" strokeWidth={2} />
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Ask anything or type '/' for tools..."
          className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20 py-2.5 text-[15px] font-medium tracking-tight leading-relaxed resize-none min-h-[44px] max-h-[200px]"
          rows={1}
        />

        {/* Right Action: Send Button */}
        <div className="h-11 flex items-center pr-1">
          <motion.button
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
              inputValue.length > 0 
                ? "bg-white text-black" 
                : "bg-white/5 text-white/20"
            )}
            whileHover={inputValue.length > 0 ? { scale: 1.05, y: -1 } : {}}
            whileTap={{ scale: 0.95 }}
          >
            <Send size={16} strokeWidth={2.5} className={inputValue.length > 0 ? "ml-0.5" : ""} />
          </motion.button>
        </div>
      </motion.div>

      {/* Subtle Bottom Glow on Focus */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-1 rounded-[28px] bg-white/[0.03] blur-xl -z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}