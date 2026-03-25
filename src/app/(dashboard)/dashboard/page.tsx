'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OmniscientInputBar } from '@/components/omniscient-input-bar';

// ─── Sophisticated Dynamic Background ──────────────────────
const DynamicBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    {/* Soft, moving radial gradient */}
    <motion.div
      className="absolute inset-0 opacity-30"
      animate={{
        background: [
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.03) 0%, transparent 50%)',
          'radial-gradient(circle at 70% 60%, rgba(255,255,255,0.05) 0%, transparent 50%)',
          'radial-gradient(circle at 40% 80%, rgba(255,255,255,0.03) 0%, transparent 50%)',
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.03) 0%, transparent 50%)',
        ],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    />
    {/* Ultra-fine grain texture */}
    <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
  </div>
);

// ─── Floating AI Response Card ─────────────────────────────
const ResponseCard = ({ content, delay = 0 }: { content: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 100, damping: 20, delay }}
    className="relative w-full max-w-2xl mb-6 p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md ambient-shadow"
  >
    <div className="text-sm leading-relaxed tracking-[-0.01em] text-white/90">
      {content}
    </div>
  </motion.div>
);

export default function DashboardPage() {
  const userName = "aly"; // Dynamic name would come from auth context
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setShowContent(true);
  }, []);

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-[#242424]">
      <DynamicBackground />

      {/* Main Command Workspace */}
      <main className="relative z-10 flex-1 flex flex-col items-center pt-[15vh] px-6 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence>
          {showContent && (
            <>
              {/* Greeting Section */}
              <div className="text-center mb-16">
                <motion.h1
                  className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-[-0.03em]"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  Good Evening, {userName}
                </motion.h1>
                <motion.p
                  className="text-lg md:text-xl text-white/40 tracking-[-0.02em] font-medium"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                >
                  I'm your AI assistant. What would you like to accomplish today?
                </motion.p>
              </div>

              {/* Placeholder for Dynamic Content / Chat History */}
              {/* <ResponseCard content="I've analyzed your upcoming schedule. You have 3 high-priority tasks remaining for the day. Would you like me to help you draft the follow-up emails for the Q3 planning session?" delay={0.4} /> */}
            </>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Omniscient Input Bar */}
      <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center px-6 pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto">
          <OmniscientInputBar />
        </div>
      </div>
    </div>
  );
}
