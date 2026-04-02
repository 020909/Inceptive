'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowUp, Code2, PenLine, Image as ImageIcon, FolderUp } from 'lucide-react';
import { useChat } from '@/lib/chat-context';

/** Icon-only action button that reveals its label on hover */
function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group/action flex items-center gap-0 overflow-hidden rounded-full px-2.5 py-1.5 text-[var(--fg-muted)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-secondary)]"
      type="button"
    >
      <Icon size={15} />
      {/* Label: 0-width by default, expands on hover */}
      <span
        className="
          text-xs font-medium whitespace-nowrap
          max-w-0 opacity-0 overflow-hidden
          group-hover/action:max-w-[80px] group-hover/action:opacity-100 group-hover/action:ml-1.5
          transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]
        "
      >
        {label}
      </span>
    </button>
  );
}

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
          relative flex flex-col gap-3 rounded-[28px]
          backdrop-blur-xl bg-[var(--bg-surface)]/92
          border transition-[box-shadow,border-color,background-color] duration-200 ease-out
          ${focused
            ? "border-[rgba(245,245,247,0.15)] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_2px_rgba(245,245,247,0.1)]"
            : "border-[var(--border-subtle)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] hover:border-[var(--border-default)]"
          }
        `}
        style={{ padding: "16px 24px" }}
      >
        {/* Input row */}
        <div className="flex items-end gap-3">
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
              flex-1 min-h-[24px] max-h-[120px] resize-none border-none bg-transparent text-[15px]
              leading-6 tracking-[-0.01em] text-[var(--text-secondary)] outline-none
              placeholder:text-[var(--fg-muted)]
            "
          />

          <button
            onClick={submit}
            disabled={!value.trim()}
            className={`
              shrink-0 flex items-center justify-center w-9 h-9 rounded-xl
              transition-all duration-150
              ${value.trim()
                ? "bg-[#F5F5F7] text-[rgb(38,38,36)] hover:bg-[#FFFFFF] hover:-translate-y-px"
                : "bg-[var(--bg-elevated)] text-[var(--fg-muted)] cursor-not-allowed"
              }
            `}
          >
            <ArrowUp size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-1 -mx-1">
          <ActionButton
            icon={Code2}
            label="Code"
            onClick={() => router.push(`/dashboard?prefill=${encodeURIComponent("Help me code ")}`)}
          />
          <ActionButton
            icon={PenLine}
            label="Write"
            onClick={() => router.push(`/dashboard?prefill=${encodeURIComponent("Help me write ")}`)}
          />
          <ActionButton
            icon={ImageIcon}
            label="Image"
            onClick={() => router.push(`/dashboard?prefill=${encodeURIComponent("Create an image of ")}`)}
          />
          <ActionButton icon={FolderUp} label="Upload" />
        </div>
      </div>
    </motion.div>
  );
}
