'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OmniscientInputBar } from '@/components/omniscient-input-bar';
import { Sparkles, ArrowRight } from 'lucide-react';

// ─── Sophisticated Dynamic Background ──────────────────────
const DynamicBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    {/* Soft, moving radial gradient */}
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
    <div className="relative flex flex-col h-screen overflow-hidden bg-[#1E1E1C]">
      <DynamicBackground />

      {/* BILLION-DOLLAR DASHBOARD HEADER */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-10 py-6 border-b border-white/[0.04]"
      >
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-[13px] font-medium tracking-tight">Welcome back,</span>
          <span className="text-white font-semibold text-[13px] tracking-tight">Founder</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-white/60 text-[11px] font-bold uppercase tracking-widest">System Online</span>
          </div>
        </div>
      </motion.header>

      {/* Main Command Workspace */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <AnimatePresence>
          {showContent && (
            <div className="w-full max-w-2xl flex flex-col items-center">
              {/* Status Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-10"
              >
                <Sparkles size={14} className="text-white/80" />
                <span className="text-white/70 text-[13px] font-medium tracking-tight">Your AI agent is ready</span>
              </motion.div>

              {/* Central Greeting */}
              <div className="text-center mb-14">
                <motion.h1
                  className="text-[52px] font-bold text-white mb-6 tracking-[-0.04em] leading-[1.1]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  What would you like<br />to accomplish?
                </motion.h1>
                <motion.p
                  className="text-lg text-white/30 tracking-tight font-medium max-w-[400px] mx-auto leading-relaxed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                >
                  Inceptive can research, write, code, and automate your entire workflow.
                </motion.p>
              </div>

              {/* Omniscient Input Bar Wrapper */}
              <div className="w-full max-w-2xl mb-10">
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
      </main>

      {/* BILLION-DOLLAR DASHBOARD FOOTER */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 px-10 py-6 border-t border-white/[0.04]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-white/20 text-[11px] font-medium tracking-tight">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 text-[10px] mx-1 border border-white/5">⌘</kbd> 
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 text-[10px] mx-1 border border-white/5">K</kbd> for command hub
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em]">v1.0.0 ALPHA</span>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
