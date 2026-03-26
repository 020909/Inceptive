'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { OmniscientInputBar } from '@/components/omniscient-input-bar';
import { Sparkles, ArrowRight, Zap, TrendingUp, Mail, FileText, Search, Bot } from 'lucide-react';

const QuickAction = ({ icon: Icon, label, description }: { icon: any; label: string; description: string }) => (
  <motion.button
    whileHover={{ y: -2, x: 2 }}
    whileTap={{ scale: 0.98 }}
    className="group relative p-4 rounded-xl bg-[#262624] border border-white/[0.06] hover:border-white/[0.12] text-left w-full transition-all duration-200"
  >
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-white/[0.06] text-white">
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div className="flex-1">
        <div className="text-white font-medium text-sm mb-0.5">{label}</div>
        <div className="text-white/40 text-xs">{description}</div>
      </div>
      <ArrowRight size={16} className="text-white/20 group-hover:text-white/40 transition-colors mt-2" />
    </div>
  </motion.button>
);

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="p-4 rounded-xl bg-[#262624] border border-white/[0.06]">
    <div className="flex items-center justify-between mb-2">
      <Icon size={16} className="text-white/50" strokeWidth={1.5} />
      <span className="text-xs text-white/30">{label}</span>
    </div>
    <div className="text-2xl font-semibold text-white">{value}</div>
  </div>
);

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">Welcome back,</span>
            <span className="text-white font-semibold text-sm">Founder</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#262624] border border-white/[0.06]">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white/70 text-xs font-medium">System Online</span>
          </div>
        </div>
      </motion.header>

      <div className="max-w-6xl mx-auto">
        {/* Main Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-16 text-center"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#262624] border border-white/[0.08] mb-6">
            <Sparkles size={14} className="text-white/80" />
            <span className="text-white/70 text-xs font-medium">AI Agent Ready</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl font-semibold text-white mb-4 tracking-tight">
            What would you like<br />to accomplish?
          </h1>

          {/* Subtitle */}
          <p className="text-white/50 text-lg mb-8 max-w-md mx-auto">
            Research, write, code, and automate your workflows with AI.
          </p>

          {/* Input */}
          <div className="max-w-2xl mx-auto mb-6">
            <OmniscientInputBar />
          </div>

          {/* Keyboard Hint */}
          <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 text-[10px] border border-white/[0.08]">⌘K</kbd>
            <span>for quick actions</span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          <StatCard icon={Zap} label="Today" value="100" />
          <StatCard icon={TrendingUp} label="This Week" value="487" />
          <StatCard icon={FileText} label="Total Tasks" value="1,243" />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            <span className="text-xs text-white/30">Popular this week</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <QuickAction 
              icon={Mail}
              label="Draft Email Campaign"
              description="Generate personalized outreach emails"
            />
            <QuickAction 
              icon={FileText}
              label="Research Report"
              description="Deep research with citations"
            />
            <QuickAction 
              icon={TrendingUp}
              label="Competitive Analysis"
              description="Analyze competitors and market trends"
            />
            <QuickAction 
              icon={Sparkles}
              label="Content Creation"
              description="Generate blog posts and articles"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}