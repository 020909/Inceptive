'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OmniscientInputBar } from '@/components/omniscient-input-bar';
import { Sparkles } from 'lucide-react';

// ─── Sophisticated Dynamic Background ──────────────────────
const DynamicBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    <motion.div
      className="absolute inset-0 opacity-20"
      animate={{
        background: [
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.02) 0%, transparent 60%)',
          'radial-gradient(circle at 70% 60%, rgba(255,255,255,0.04) 0%, transparent 60%)',
          'radial-gradient(circle at 40% 80%, rgba(255,255,255,0.02) 0%, transparent 60%)',
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.02) 0%, transparent 60%)',
        ],
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
    />
  </div>
);

// ─── Suggested Action Button ──────────────────────────────
const SuggestedAction = ({ label, index }: { label: string; index: number }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
    className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/50 text-[13px] font-medium tracking-tight transition-all hover:bg-white/[0.08] hover:border-white/[0.12] hover:text-white"
  >
    {label}
  </motion.button>
);

export default function DashboardPage() {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setShowContent(true);
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#1E1E1C]">
      <DynamicBackground />

      {/* HEADER */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-[13px] tracking-tight">Welcome back,</span>
          <span className="text-white font-semibold text-[13px] tracking-tight">Founder</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-[11px] font-bold uppercase tracking-widest">System Online</span>
          </div>
        </div>
      </motion.header>

      {/* CONTENT AREA */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-20">
        <AnimatePresence>
          {showContent && (
            <div className="w-full max-w-2xl flex flex-col items-center text-center">
              {/* Status Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8"
              >
                <Sparkles size={14} className="text-white/80" />
                <span className="text-white/80 text-[13px] font-medium tracking-tight">Your AI agent is ready</span>
              </motion.div>

              {/* Central Greeting */}
              <div className="mb-12">
                <motion.h1
                  className="text-5xl md:text-6xl font-semibold text-white mb-6 tracking-[-0.03em] leading-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  What would you like<br />to accomplish?
                </motion.h1>
                <motion.p
                  className="text-lg text-white/50 tracking-tight font-medium max-w-md mx-auto leading-relaxed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                >
                  Inceptive can research, write, code, and automate your entire workflow.
                </motion.p>
              </div>

              {/* Omniscient Input Bar */}
              <div className="w-full mb-10">
                <OmniscientInputBar />
              </div>

              {/* Suggested Actions */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {["Research a topic", "Write an email", "Analyze data", "Build a feature"].map((label, i) => (
                  <SuggestedAction key={label} label={label} index={i} />
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* FOOTER */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 px-8 py-5 border-t border-white/[0.06]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-white/30 text-[11px] font-medium tracking-tight">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50 text-[10px] mx-1">⌘</kbd> 
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50 text-[10px] mx-1">K</kbd> for commands
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">v1.0.0</span>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
