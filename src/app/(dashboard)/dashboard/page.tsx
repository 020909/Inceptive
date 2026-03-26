'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OmniscientInputBar } from '@/components/omniscient-input-bar';
import { ArrowRight, Mail, FileText, TrendingUp, Sparkles, Zap, Search, Bot } from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <p className="text-[11px] text-[var(--fg-tertiary)] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-muted)] mt-1">{sub}</p>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, description, href }: {
  icon: any; label: string; description: string; href: string;
}) {
  const router = useRouter();
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push(href)}
      className="group relative p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] text-left w-full transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-secondary)]">
          <Icon size={16} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--fg-primary)] font-medium text-sm mb-0.5">{label}</p>
          <p className="text-[var(--fg-tertiary)] text-xs">{description}</p>
        </div>
        <ArrowRight size={14} className="text-[var(--fg-muted)] group-hover:text-[var(--fg-tertiary)] transition-colors mt-1 shrink-0" />
      </div>
    </motion.button>
  );
}

export default function DashboardPage() {
  const [credits, setCredits] = useState<{ credits: number; plan: string } | null>(null);

  useEffect(() => {
    fetch("/api/credits").then(r => r.json()).then(setCredits).catch(() => {});
  }, []);

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header bar ── */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between px-8 pt-6 pb-2"
      >
        <div className="flex items-center gap-2">
          <span className="text-[var(--fg-tertiary)] text-sm">{getGreeting()}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          </span>
          <span className="text-[var(--fg-secondary)] text-[11px] font-medium">System Online</span>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="w-full max-w-2xl text-center"
        >
          <motion.h1
            variants={fadeUp}
            className="text-[42px] font-semibold text-[var(--fg-primary)] tracking-[-0.04em] leading-[1.1] mb-3"
          >
            What would you like<br />to accomplish?
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-[var(--fg-tertiary)] text-base mb-8 max-w-md mx-auto"
          >
            Research, write, code, and automate — Inceptive handles it.
          </motion.p>

          <motion.div variants={fadeUp} className="mb-4">
            <OmniscientInputBar />
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center justify-center gap-1.5 text-[var(--fg-muted)] text-[11px]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--fg-tertiary)] text-[10px] border border-[var(--border-subtle)]">⌘K</kbd>
            <span>for quick actions</span>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Bottom section ── */}
      <div className="px-8 pb-8 max-w-5xl mx-auto w-full">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          <StatCard label="Credits" value={credits ? String(credits.credits) : "—"} sub={credits?.plan ? `${credits.plan} plan` : undefined} />
          <StatCard label="Status" value="Active" sub="All systems running" />
          <StatCard label="Agents" value="Ready" sub="0 tasks queued" />
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[var(--fg-secondary)]">Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction icon={Mail} label="Email Autopilot" description="Manage inbox and draft replies" href="/email" />
            <QuickAction icon={Search} label="Deep Research" description="Research with citations" href="/research" />
            <QuickAction icon={Bot} label="Agent Tasks" description="Run autonomous workflows" href="/agent" />
            <QuickAction icon={Sparkles} label="Skills Library" description="One-click AI workflows" href="/skills" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
