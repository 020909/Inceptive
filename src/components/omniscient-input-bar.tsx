'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Search, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const ghostSuggestions = [
  "Summarize my latest emails",
  "Draft a marketing campaign for product launch",
  "Research market trends for Q2",
  "Generate code for a new feature"
];

const toolSuggestions = [
  { name: "Agent", icon: Bot, command: "/agent" },
  { name: "Research", icon: Search, command: "/research" },
  { name: "Email", icon: Mail, command: "/email" },
];

export function OmniscientInputBar() {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const filteredGhostSuggestions = ghostSuggestions.filter(s => 
    s.toLowerCase().includes(inputValue.toLowerCase())
  );
  const filteredToolSuggestions = toolSuggestions.filter(t => 
    t.name.toLowerCase().includes(inputValue.toLowerCase()) || t.command.includes(inputValue.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(e.target.value.length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [inputValue]);

  return (
    <motion.div
      className="relative w-full max-w-3xl frosted-glass ambient-shadow rounded-xl p-2"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.8 }}
    >
      <AnimatePresence>
        {isFocused && showSuggestions && (filteredGhostSuggestions.length > 0 || filteredToolSuggestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="absolute bottom-full left-0 w-full mb-2 rounded-lg frosted-glass ambient-shadow overflow-hidden z-50"
          >
            {filteredToolSuggestions.length > 0 && (
              <div className="p-2 border-b border-white/10">
                <p className="text-white/50 text-xs mb-1">Tools</p>
                {filteredToolSuggestions.map((tool, index) => (
                  <motion.div
                    key={tool.name}
                    className="flex items-center gap-2 p-2 rounded-md text-white hover:bg-white/10 cursor-pointer"
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                    onClick={() => handleSuggestionClick(tool.command)}
                  >
                    <tool.icon size={16} className="text-white/70" />
                    <span>{tool.name}</span>
                    <span className="text-white/50 text-xs ml-auto">{tool.command}</span>
                  </motion.div>
                ))}
              </div>
            )}
            {filteredGhostSuggestions.length > 0 && (
              <div className="p-2">
                <p className="text-white/50 text-xs mb-1">Suggestions</p>
                {filteredGhostSuggestions.map((suggestion, index) => (
                  <motion.p
                    key={index}
                    className="p-2 rounded-md text-white/70 hover:bg-white/10 cursor-pointer"
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </motion.p>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <motion.textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 100)}
          placeholder="Type your message..."
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/50 p-2 text-lg w-full resize-none",
            isFocused && 'ring-2 ring-white/30 rounded-lg'
          )}
          rows={1}
          style={{ minHeight: '44px' }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
        <motion.button
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Send size={20} />
        </motion.button>
      </div>
    </motion.div>
  );
}