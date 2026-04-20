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
    <div
      className="min-h-screen bg-[#000000] text-white overflow-x-hidden"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* ── NAVBAR ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#000000]/80 backdrop-blur-md border-b border-white/10"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-normal tracking-tight text-white"
            style={{ fontFamily: "var(--font-header)" }}
          >
            Inceptive
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.2em] rounded-full px-2 py-0.5 border border-white/20 text-[#93939f] ml-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Enterprise
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm text-white hover:text-[#3b82f6] transition-colors px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white text-black px-5 py-2 text-sm hover:opacity-90 transition-opacity"
          >
            Start free
          </Link>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <div className="pt-36 pb-24 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Section label */}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] text-[#93939f] mb-10"
            style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.28px" }}
          >
            <Sparkles size={12} />
            Backed by enterprise-grade security
          </div>

          {/* Hero headline — Libre Baskerville at 72px */}
          <h1
            className="mb-6 max-w-4xl mx-auto text-white"
            style={{
              fontFamily: "var(--font-header)",
              fontSize: "clamp(42px, 6vw, 72px)",
              fontWeight: 400,
              lineHeight: 1.0,
              letterSpacing: "-1.44px",
            }}
          >
            Your AI operations team.
            <br />
            Working 24/7.
          </h1>

          {/* Subtitle — DM Sans 18px */}
          <p
            className="text-[#93939f] max-w-2xl mx-auto mb-12"
            style={{ fontSize: "18px", lineHeight: 1.4, fontFamily: "var(--font-body)" }}
          >
            Inceptive deploys autonomous AI agents that handle email, research, workflows, and reporting — so your team ships more with less.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white text-black px-8 py-3.5 text-[15px] hover:opacity-90 transition-all hover:gap-3"
            >
              Start for free <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 text-white px-8 py-3.5 text-[15px] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-all"
            >
              Sign in →
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-[#93939f]">
            No credit card required · 14-day free trial
          </p>
        </motion.div>
      </div>

      {/* ── STATS BAR ── */}
      <div className="py-10 border-y border-white/10 grid grid-cols-3 max-w-2xl mx-auto text-center gap-8">
        <div>
          <div
            className="text-3xl mb-1 text-white"
            style={{ fontFamily: "var(--font-header)", fontWeight: 400 }}
          >
            23h
          </div>
          <div className="text-sm text-[#93939f]">saved per employee / week</div>
        </div>
        <div>
          <div
            className="text-3xl mb-1 text-white"
            style={{ fontFamily: "var(--font-header)", fontWeight: 400 }}
          >
            3 sec
          </div>
          <div className="text-sm text-[#93939f]">average agent response time</div>
        </div>
        <div>
          <div
            className="text-3xl mb-1 text-white"
            style={{ fontFamily: "var(--font-header)", fontWeight: 400 }}
          >
            SOC 2
          </div>
          <div className="text-sm text-[#93939f]">Type II certified</div>
        </div>
      </div>

      {/* ── FEATURE GRID ── */}
      <div className="mt-24 px-6 max-w-6xl mx-auto">
        {/* Section label */}
        <p
          className="text-center text-[#93939f] mb-4"
          style={{ fontFamily: "var(--font-mono)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.28px" }}
        >
          Platform capabilities
        </p>
        <h2
          className="text-center mb-14 text-white"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(28px, 3.5vw, 48px)",
            fontWeight: 400,
            lineHeight: 1.2,
            letterSpacing: "-0.48px",
          }}
        >
          Everything your team needs to move faster
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Mail, title: "AI Email Agent", desc: "Draft, triage, and send emails in your voice. Type one sentence, get a polished email." },
            { icon: Search, title: "Enterprise Search", desc: "Search emails, documents, and reports in one place. Built-in knowledge base." },
            { icon: GitBranch, title: "Visual Workflows", desc: "Drag-and-drop automation canvas. Chain AI agents into multi-step pipelines." },
            { icon: BarChart2, title: "Research Reports", desc: "Deep market research on any topic. Sources included, delivered in minutes." },
            { icon: Shield, title: "Human-in-the-Loop", desc: "Every agent action is reviewable. Approve, reject, or modify before execution." },
            { icon: Zap, title: "Skills Library", desc: "15+ pre-built agent playbooks. Inbox triage, lead research, weekly ops reports." },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-[22px] border border-white/5 bg-[#171717] p-7 hover:border-white/20 transition-colors"
            >
              <div className="rounded-[8px] bg-white/5 text-white p-2.5 w-10 h-10 flex items-center justify-center mb-5">
                <Icon size={19} />
              </div>
              <h3
                className="mb-2 text-white"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "18px",
                  fontWeight: 400,
                  lineHeight: 1.3,
                  letterSpacing: "-0.18px",
                }}
              >
                {title}
              </h3>
              <p className="text-[14px] text-[#93939f] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRUST BAR ── */}
      <div className="mt-24 text-center px-6">
        <p
          className="text-[#93939f] mb-8"
          style={{ fontFamily: "var(--font-mono)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.28px" }}
        >
          Built for teams at companies like
        </p>
        <div className="flex flex-wrap justify-center items-center gap-10">
          {["Acme Corp", "TechCo", "Meridian", "Apex Systems", "Lightwave", "Orbis"].map((name) => (
            <span
              key={name}
              className="text-[#93939f] text-sm tracking-wide opacity-60"
              style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* ── QUOTE CALLOUT — deep purple band ── */}
      <div className="mt-24 purple-hero-band py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p
            className="text-white/80 leading-relaxed mb-6"
            style={{ fontFamily: "var(--font-header)", fontSize: "clamp(20px, 2.5vw, 28px)", fontStyle: "italic" }}
          >
            "29% of the Fortune 500 are now live, paying customers of a leading AI startup. The window for first-mover advantage is closing."
          </p>
          <p
            className="text-white/40 text-[13px]"
            style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.28px" }}
          >
            — a16z Enterprise AI Report, April 2026
          </p>
        </div>
      </div>

      {/* ── PRICING SECTION ── */}
      <div className="mt-24 px-6 max-w-4xl mx-auto">
        <p
          className="text-center text-[#93939f] mb-4"
          style={{ fontFamily: "var(--font-mono)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.28px" }}
        >
          Pricing
        </p>
        <h2
          className="text-center mb-14 text-white"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(28px, 3.5vw, 48px)",
            fontWeight: 400,
            lineHeight: 1.2,
            letterSpacing: "-0.48px",
          }}
        >
          Simple, transparent pricing
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1 — Pro */}
          <div className="rounded-[22px] border border-white/10 bg-[#171717] p-10 flex flex-col">
            <div
              className="text-[13px] text-[#93939f] mb-5 uppercase tracking-[0.28px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Pro
            </div>
            <div
              className="text-white mb-1"
              style={{ fontFamily: "var(--font-header)", fontSize: "44px", fontWeight: 400, lineHeight: 1 }}
            >
              $2,000
              <span className="text-[18px] text-[#93939f]" style={{ fontFamily: "var(--font-body)" }}>/month</span>
            </div>
            <div className="text-[13px] text-[#93939f] mb-8">Per workspace · billed monthly</div>
            <div className="space-y-3.5 mb-10 flex-1">
              {["Unlimited AI agents", "Email + Research + Workflows", "15+ Skills playbooks", "Gmail & Slack integrations", "Priority support"].map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <CheckCircle2 size={17} className="text-[#3b82f6] mt-0.5 shrink-0" />
                  <span className="text-[14px] text-white/80">{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/signup"
              className="block w-full py-3 text-center rounded-full border border-white/20 text-[14px] text-white hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
            >
              Start free trial →
            </Link>
          </div>

          {/* Card 2 — Enterprise */}
          <div className="rounded-[22px] border border-white/20 bg-[#171717] text-white p-10 relative flex flex-col">
            <div className="absolute -top-3.5 right-5 text-[11px] bg-white text-black rounded-full px-3 py-1 font-medium tracking-wide uppercase">
              Most Popular
            </div>
            <div
              className="text-[13px] text-white/50 mb-5 uppercase tracking-[0.28px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Enterprise
            </div>
            <div
              className="text-white mb-1"
              style={{ fontFamily: "var(--font-header)", fontSize: "44px", fontWeight: 400, lineHeight: 1 }}
            >
              $5,000+
              <span className="text-[18px] text-white/50" style={{ fontFamily: "var(--font-body)" }}>/month</span>
            </div>
            <div className="text-[13px] text-white/50 mb-8">Custom pricing for large teams</div>
            <div className="space-y-3.5 mb-10 flex-1">
              {["Everything in Pro", "Custom AI personas", "Human-in-the-loop approvals", "Knowledge Base (unlimited docs)", "SSO + SAML", "Dedicated success manager", "SLA + uptime guarantee"].map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <CheckCircle2 size={17} className="text-[#3b82f6] mt-0.5 shrink-0" />
                  <span className="text-[14px] text-white/80">{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/login"
              className="block w-full py-3 text-center rounded-full bg-white text-black text-[14px] hover:opacity-90 transition-opacity"
            >
              Talk to us →
            </Link>
          </div>
        </div>
      </div>

      {/* ── CTA SECTION — purple hero band ── */}
      <div className="mt-24 purple-hero-band py-24 px-6 text-center">
        <h2
          className="text-white mb-4"
          style={{
            fontFamily: "var(--font-header)",
            fontSize: "clamp(32px, 4.5vw, 60px)",
            fontWeight: 400,
            lineHeight: 1.0,
            letterSpacing: "-1.2px",
          }}
        >
          Ready to give your team an AI workforce?
        </h2>
        <p
          className="text-white/60 mb-10 max-w-xl mx-auto"
          style={{ fontSize: "18px", lineHeight: 1.4 }}
        >
          Set up in 5 minutes. Your first agents are running today.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-full bg-white text-black px-10 py-4 text-[15px] hover:opacity-90 transition-all hover:gap-3"
        >
          Get started free <ArrowRight size={16} />
        </Link>
      </div>

      {/* ── FOOTER ── */}
      <footer className="footer-gradient py-10 px-8 text-center">
        <p
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.28px",
            color: "#93939f",
          }}
        >
          © 2026 Inceptive AI · Enterprise AI Operations Platform
        </p>
      </footer>
    </div>
  );
}
