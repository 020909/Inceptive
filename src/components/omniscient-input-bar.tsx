'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Command, ArrowRight, Sparkles } from 'lucide-react';

export function OmniscientInputBar() {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    // Handle submission logic here
    console.log('Submitting:', inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group"
    >
      <div
        className={`
          relative flex items-center gap-4 
          px-6 py-4 rounded-2xl
          bg-[#262624] border transition-all duration-300
          ${isFocused 
            ? 'border-white/[0.12] shadow-[0_0_40px_rgba(99,102,241,0.1)] bg-white/[0.06]' 
            : 'border-white/[0.08] hover:border-white/[0.10] hover:bg-white/[0.05]'
          }
        `}
      >
        {/* Icon */}
        <div className={`transition-colors ${isFocused ? 'text-white' : 'text-white/40'}`}> 
          <Command size={20} strokeWidth={1.5} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Inceptive to do anything..."
          className="
            flex-1 bg-transparent border-none outline-none 
            text-white text-base tracking-tight
            placeholder:text-white/30
            font-medium
          "
        />

        {/* Submit Button */}
        <motion.button
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            transition-all
            ${inputValue.trim()
              ? 'bg-white text-[#262624] hover:bg-white/90'
              : 'bg-white/[0.06] text-white/30 cursor-not-allowed'
            }
          `}
        >
          <span className="text-sm font-medium">Send</span>
          <ArrowRight size={14} />
        </motion.button>
      </div>

      {/* Glow effect on focus */}
      {isFocused && (
        <div className="absolute inset-0 -z-10 rounded-2xl bg-white/5 blur-xl" />
      )}
    </motion.div>
  );
}