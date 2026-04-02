'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { useChat } from '@/lib/chat-context';

export function OmniscientInputBar() {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();
  const { startNewChat, setMessages } = useChat();

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text) return;
    setValue('');
    await startNewChat();
    setMessages([{ id: Date.now().toString(), role: "user", content: text, toolCalls: [], toolResults: [] }]);
    router.push("/dashboard");
  }, [value, startNewChat, setMessages, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative"
    >
      <div
        className={`
          relative flex items-center gap-3 px-5 py-4 rounded-[24px]
          bg-[var(--bg-surface)] border transition-all duration-200
          shadow-[0_20px_60px_rgba(0,0,0,0.3)]
          ${focused
            ? 'border-[var(--accent)] shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_2px_var(--accent-glow)]'
            : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
          }
        `}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Inceptive anything..."
          rows={1}
          className="
            flex-1 bg-transparent border-none outline-none resize-none
            text-[var(--fg-primary)] text-[15px] tracking-[-0.01em] leading-6
            placeholder:text-[var(--fg-muted)]
            min-h-[24px] max-h-[120px]
          "
        />

        <button
          onClick={submit}
          disabled={!value.trim()}
          className={`
            shrink-0 flex items-center justify-center w-9 h-9 rounded-xl
            transition-all duration-150
            ${value.trim()
              ? 'bg-[#6510F4] text-white hover:bg-[#7C3AED] hover:-translate-y-px'
              : 'bg-[var(--bg-elevated)] text-[var(--fg-muted)] cursor-not-allowed'
            }
          `}
        >
          <ArrowUp size={18} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
}