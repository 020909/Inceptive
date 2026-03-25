'use client';

import { motion } from 'framer-motion';
import { OmniscientInputBar } from '@/components/omniscient-input-bar';
import { Sidebar } from '@/components/sidebar';

const DynamicBackground = () => (
  <motion.div
    className="absolute inset-0 z-0 opacity-10"
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.1 }}
    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
    style={{
      background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)',
    }}
  />
);

export default function DashboardPage() {
  const userName = "User";

  return (
    <div className="flex h-full">
      <Sidebar />
      <motion.main
        className="flex-1 flex flex-col p-8 relative overflow-hidden bg-[#242424] ml-64 transition-all duration-300 ease-in-out"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
      >
        <DynamicBackground />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center">
          <motion.h1
            className="text-5xl font-bold text-white mb-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 100, damping: 20 }}
          >
            Good Evening, {userName}
          </motion.h1>
          <motion.p
            className="text-white/70 text-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 100, damping: 20 }}
          >
            I'm your AI assistant. What would you like to accomplish today?
          </motion.p>
          <div className="mt-12 w-full max-w-3xl">
          </div>
        </div>
        <div className="relative z-10 mt-auto w-full flex justify-center pb-8">
          <OmniscientInputBar />
        </div>
      </motion.main>
    </div>
  );
}
