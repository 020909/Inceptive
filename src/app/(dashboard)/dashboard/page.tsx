'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { OmniscientInputBar } from '@/components/omniscient-input-bar';
import { Sparkles } from 'lucide-react';

const SuggestedAction = ({ label }: { label: string }) => (
  <button
    className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/50 text-[13px] font-medium tracking-tight transition-all hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-white"
  >
    {label}
  </button>
);

export default function DashboardPage() {
  return (
    <div className="relative flex flex-col min-h-screen bg-[#1E1E1C]">
      {/* HEADER */}
      <header className="relative z-10 flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-[13px] tracking-tight font-medium">Welcome back,</span>
          <span className="text-white font-semibold text-[13px] tracking-tight">Founder</span>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <span className="text-white/60 text-[11px] font-bold uppercase tracking-widest">System Online</span>
        </div>
      </header>

      {/* CENTER CONTENT */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-2xl flex flex-col items-center text-center">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-10">
            <Sparkles size={14} className="text-white/80" />
            <span className="text-white/70 text-[13px] font-medium tracking-tight">Your AI agent is ready</span>
          </div>

          {/* Heading */}
          <div className="mb-14">
            <h1 className="text-[56px] font-bold text-white mb-6 tracking-[-0.04em] leading-[1.1]">
              What would you like<br />to accomplish?
            </h1>
            <p className="text-lg text-white/30 tracking-tight font-medium max-w-[450px] mx-auto leading-relaxed">
              Inceptive can research, write, code, and automate your workflows.
            </p>
          </div>

          {/* Input Bar */}
          <div className="w-full max-w-2xl mb-10">
            <OmniscientInputBar />
          </div>

          {/* Suggested Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {["Research a topic", "Write an email", "Analyze data", "Build a feature"].map((label) => (
              <SuggestedAction key={label} label={label} />
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="px-10 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-white/20 text-[11px] font-medium tracking-tight">
            Press 
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 text-[10px] mx-1 border border-white/5 font-sans">⌘</kbd> 
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 text-[10px] mx-1 border border-white/5 font-sans">K</kbd> 
            for commands
          </div>
          <span className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em]">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
