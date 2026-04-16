"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  BarChart2,
  GitBranch,
  Search,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-inter">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,10,0.8)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">Inceptive</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] rounded-full px-2 py-0.5 bg-[rgba(232,68,10,0.15)] text-[#e8440a] border border-[rgba(232,68,10,0.2)] ml-1">
            Enterprise
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[rgba(255,255,255,0.6)] hover:text-white transition-colors px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-[#e8440a] text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start free →
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="pt-32 pb-20 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(232,68,10,0.2)] bg-[rgba(232,68,10,0.08)] px-4 py-1.5 text-sm text-[#e8440a] mb-8">
            <Sparkles size={13} />
            Backed by enterprise-grade security
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-[-0.04em] leading-none mb-6 max-w-4xl mx-auto">
            Your AI operations team.<br />
            <span
              style={{
                background: "linear-gradient(135deg, #e8440a, #ff6b37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Working 24/7.
            </span>
          </h1>
          <p className="text-xl text-[rgba(255,255,255,0.55)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Inceptive deploys autonomous AI agents that handle email, research, workflows, and reporting — so your team ships more with less.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-2xl bg-[#e8440a] text-white px-8 py-3.5 text-base font-semibold hover:opacity-90 transition-all flex items-center gap-2 hover:gap-3"
            >
              Start for free <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-[rgba(255,255,255,0.12)] text-white px-8 py-3.5 text-base hover:border-[rgba(255,255,255,0.24)] transition-all"
            >
              Sign in →
            </Link>
          </div>
          <p className="mt-5 text-sm text-[rgba(255,255,255,0.3)]">
            No credit card required · 14-day free trial
          </p>
        </motion.div>
      </div>

      {/* STATS BAR */}
      <div className="mt-16 py-8 border-y border-[rgba(255,255,255,0.06)] grid grid-cols-3 max-w-2xl mx-auto text-center gap-8">
        <div>
          <div className="text-3xl font-bold mb-1">23h</div>
          <div className="text-sm text-[rgba(255,255,255,0.4)]">saved per employee / week</div>
        </div>
        <div>
          <div className="text-3xl font-bold mb-1">3 sec</div>
          <div className="text-sm text-[rgba(255,255,255,0.4)]">average agent response time</div>
        </div>
        <div>
          <div className="text-3xl font-bold mb-1">SOC 2</div>
          <div className="text-sm text-[rgba(255,255,255,0.4)]">Type II certified</div>
        </div>
      </div>

      {/* FEATURE GRID */}
      <div className="mt-24 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything your team needs to move faster
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="rounded-xl bg-[rgba(232,68,10,0.1)] text-[#e8440a] p-2.5 w-10 h-10 flex items-center justify-center mb-4">
              <Mail size={20} />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI Email Agent</h3>
            <p className="text-sm text-[rgba(255,255,255,0.6)]">
              Draft, triage, and send emails in your voice. Type one sentence, get a polished email.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="rounded-xl bg-[rgba(232,68,10,0.1)] text-[#e8440a] p-2.5 w-10 h-10 flex items-center justify-center mb-4">
              <Search size={20} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Enterprise Search</h3>
            <p className="text-sm text-[rgba(255,255,255,0.6)]">
              Search emails, documents, and reports in one place. Built-in knowledge base.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="rounded-xl bg-[rgba(232,68,10,0.1)] text-[#e8440a] p-2.5 w-10 h-10 flex items-center justify-center mb-4">
              <GitBranch size={20} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Visual Workflows</h3>
            <p className="text-sm text-[rgba(255,255,255,0.6)]">
              Drag-and-drop automation canvas. Chain AI agents into multi-step pipelines.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="rounded-xl bg-[rgba(232,68,10,0.1)] text-[#e8440a] p-2.5 w-10 h-10 flex items-center justify-center mb-4">
              <BarChart2 size={20} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Research Reports</h3>
            <p className="text-sm text-[rgba(255,255,255,0.6)]">
              Deep market research on any topic. Sources included, delivered in minutes.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="rounded-xl bg-[rgba(232,68,10,0.1)] text-[#e8440a] p-2.5 w-10 h-10 flex items-center justify-center mb-4">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Human-in-the-Loop</h3>
            <p className="text-sm text-[rgba(255,255,255,0.6)]">
              Every agent action is reviewable. Approve, reject, or modify before execution.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="rounded-xl bg-[rgba(232,68,10,0.1)] text-[#e8440a] p-2.5 w-10 h-10 flex items-center justify-center mb-4">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Skills Library</h3>
            <p className="text-sm text-[rgba(255,255,255,0.6)]">
              15+ pre-built agent playbooks. Inbox triage, lead research, weekly ops reports.
            </p>
          </div>
        </div>
      </div>

      {/* SOCIAL PROOF SECTION */}
      <div className="mt-24 text-center px-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[rgba(255,255,255,0.3)] mb-8">
          Built for teams at companies like
        </p>
        <div className="flex flex-wrap justify-center items-center gap-10">
          <span className="text-[rgba(255,255,255,0.2)] text-sm font-semibold tracking-wide">Acme Corp</span>
          <span className="text-[rgba(255,255,255,0.2)] text-sm font-semibold tracking-wide">TechCo</span>
          <span className="text-[rgba(255,255,255,0.2)] text-sm font-semibold tracking-wide">Meridian</span>
          <span className="text-[rgba(255,255,255,0.2)] text-sm font-semibold tracking-wide">Apex Systems</span>
          <span className="text-[rgba(255,255,255,0.2)] text-sm font-semibold tracking-wide">Lightwave</span>
          <span className="text-[rgba(255,255,255,0.2)] text-sm font-semibold tracking-wide">Orbis</span>
        </div>
      </div>

      {/* A16Z QUOTE CALLOUT */}
      <div className="mt-16 max-w-3xl mx-auto rounded-3xl border border-[rgba(232,68,10,0.15)] bg-[rgba(232,68,10,0.05)] p-8 text-center">
        <p className="text-lg text-[rgba(255,255,255,0.7)] leading-relaxed italic">
          "29% of the Fortune 500 are now live, paying customers of a leading AI startup. The window for first-mover advantage is closing."
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.3)] mt-4">
          — a16z Enterprise AI Report, April 2026
        </p>
      </div>

      {/* PRICING SECTION */}
      <div className="mt-24 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          Simple, transparent pricing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1 — Pro */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-8 flex flex-col">
            <div className="text-xl font-medium mb-4 text-[#e8440a]">Pro</div>
            <div className="text-4xl font-bold mb-2">$2,000<span className="text-lg text-[rgba(255,255,255,0.5)] font-normal">/month</span></div>
            <div className="text-sm text-[rgba(255,255,255,0.5)] mb-8">Per workspace · billed monthly</div>
            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Unlimited AI agents</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Email + Research + Workflows</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">15+ Skills playbooks</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Gmail & Slack integrations</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Priority support</span>
              </div>
            </div>
            <Link
              href="/signup"
              className="block w-full py-3 text-center rounded-xl bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors border border-[rgba(255,255,255,0.1)] text-sm font-medium"
            >
              Start free trial →
            </Link>
          </div>

          {/* Card 2 — Enterprise */}
          <div className="rounded-2xl border border-[rgba(232,68,10,0.3)] bg-[rgba(232,68,10,0.05)] p-8 relative flex flex-col">
            <div className="absolute -top-3 right-4 text-xs bg-[#e8440a] text-white rounded-full px-3 py-1 font-medium tracking-wide">
              Most Popular
            </div>
            <div className="text-xl font-medium mb-4 text-[#e8440a]">Enterprise</div>
            <div className="text-4xl font-bold mb-2">$5,000+<span className="text-lg text-[rgba(255,255,255,0.5)] font-normal">/month</span></div>
            <div className="text-sm text-[rgba(255,255,255,0.5)] mb-8">Custom pricing for large teams</div>
            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Everything in Pro</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Custom AI personas</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Human-in-the-loop approvals</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Knowledge Base (unlimited docs)</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">SSO + SAML</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">Dedicated success manager</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#e8440a] mt-0.5" />
                <span className="text-sm text-[rgba(255,255,255,0.8)]">SLA + uptime guarantee</span>
              </div>
            </div>
            <Link
              href="/login"
              className="block w-full py-3 text-center rounded-xl bg-[#e8440a] hover:opacity-90 transition-opacity text-sm font-medium"
            >
              Talk to us →
            </Link>
          </div>
        </div>
      </div>

      {/* CTA SECTION */}
      <div className="mt-24 mb-16 text-center px-6">
        <div
          className="rounded-3xl p-16 max-w-4xl mx-auto"
          style={{ background: "radial-gradient(ellipse at center, rgba(232,68,10,0.12), transparent 70%)" }}
        >
          <h2 className="text-4xl font-bold mb-4">Ready to give your team an AI workforce?</h2>
          <p className="text-lg text-[rgba(255,255,255,0.6)] mb-8 max-w-xl mx-auto">
            Set up in 5 minutes. Your first agents are running today.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#e8440a] text-white px-8 py-4 text-lg font-semibold hover:opacity-90 transition-all hover:gap-3"
          >
            Get started free <ArrowRight size={20} />
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-8 px-6 text-center text-sm text-[rgba(255,255,255,0.3)]">
        © 2026 Inceptive AI · Enterprise AI Operations Platform
      </footer>
    </div>
  );
}
