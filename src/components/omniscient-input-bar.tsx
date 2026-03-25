'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Command, ArrowRight } from 'lucide-react';

export function OmniscientInputBar() {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div 
      className={`relative flex items-center gap-4 px-6 py-5 rounded-[24px] bg-[#262624] border border-white/[0.08] transition-all duration-300 ${
        isFocused ? "border-white/[0.15] shadow-[0_0_40px_rgba(255,255,255,0.03)]" : ""
      }`}
    >
      <Command size={20} className={`${isFocused ? "text-white/60" : "text-white/30"} transition-colors`} />
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Ask Inceptive to do anything..."
        className="flex-1 bg-transparent border-none outline-none text-white text-[17px] tracking-tight placeholder:text-white/20 font-medium"
      />
      <div className="flex items-center gap-2 text-white/30">
        <span className="text-[13px] font-medium">Enter</span>
        <ArrowRight size={16} />
      </div>
    </div>
  );
}
