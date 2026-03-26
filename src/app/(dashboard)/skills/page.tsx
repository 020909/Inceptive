"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/lib/chat-context";
import { PageTransition } from "@/components/ui/page-transition";
import { motion } from "framer-motion";
import { Zap, Search, Mail, Share2, Target, TrendingUp, Users, FileText, Rocket, ChevronRight, Play } from "lucide-react";
import { toast } from "sonner";

const SKILLS = [
  { id: "investor-outreach", category: "Sales", title: "Investor Outreach", description: "Research 10 active AI investors, draft personalized cold emails, save as drafts ready to send.", icon: TrendingUp, time: "~3 min", tags: ["Research","Email"], prompt: "Research 10 active investors who fund AI startups. For each: name, fund, portfolio, contact info. Draft a personalized cold email pitching Inceptive - an AI agent for founders that beats Perplexity Computer at 1/10th the price. Save each as email draft." },
  { id: "competitor-research", category: "Research", title: "Competitor Deep Dive", description: "Analyze 5 top AI agent competitors: features, pricing, weaknesses, and market gaps.", icon: Search, time: "~4 min", tags: ["Research","Strategy"], prompt: "Deep competitive analysis of top 5 AI agents: Perplexity Computer, Manus AI, OpenClaw, Claude Cowork, Microsoft Copilot. For each: key features, pricing, user complaints, weaknesses, target customer. Identify 3 biggest market gaps for Inceptive. Save a comprehensive report." },
  { id: "content-calendar", category: "Marketing", title: "30-Day Content Calendar", description: "Full 30-day social media plan with written posts for Twitter, LinkedIn, and Instagram.", icon: Share2, time: "~2 min", tags: ["Social","Marketing"], prompt: "Create a 30-day social media content calendar for Inceptive AI for founders. Write specific posts for Twitter/X (daily), LinkedIn (3x/week), Instagram (2x/week). Each post ready to copy-paste. Focus on Inceptive works while you sleep angle. Schedule the first 5 posts." },
  { id: "lead-gen", category: "Sales", title: "Lead Generation", description: "Find 20 potential customers, research their pain points, draft personalized outreach messages.", icon: Users, time: "~3 min", tags: ["Research","Email","Sales"], prompt: "Find 20 potential customers for Inceptive AI. Target: solo founders aged 18-35, indie hackers, early startup founders. For each: what they build, pain points, draft a personalized outreach email. Save a report with all 20 leads and drafted messages." },
  { id: "morning-brief", category: "Productivity", title: "Morning Intelligence Brief", description: "Latest AI news, competitor moves, and funding rounds - summarized in 2 minutes.", icon: Zap, time: "~2 min", tags: ["Research","News"], prompt: "Create my morning intelligence brief. Research: 1) Top 5 AI agent news from past 24h, 2) Major moves by Perplexity/Manus/Anthropic/OpenAI, 3) Latest AI funding rounds, 4) Top trending AI topics. Summarize into a clean 2-minute read. Save as research report titled Morning Brief." },
  { id: "launch-plan", category: "Marketing", title: "Product Launch Plan", description: "Complete launch strategy: viral announcement, Product Hunt copy, press list, 7-day plan.", icon: Rocket, time: "~3 min", tags: ["Marketing","Launch"], prompt: "Create a complete launch plan for Inceptive AI: 1) Viral Twitter announcement thread (10 tweets), 2) Product Hunt tagline + description + first comment, 3) 10 tech journalists to pitch with contact info, 4) Day-by-day marketing plan for first 7 days. Save as research report." },
  { id: "email-inbox", category: "Email", title: "Smart Inbox Management", description: "Read Gmail inbox, identify what needs replies, draft smart responses for each.", icon: Mail, time: "~2 min", tags: ["Email","Gmail"], prompt: "Read my Gmail inbox. For each unread email: summarize it, decide if it needs a reply, draft a professional reply if yes. Prioritize investor emails, partnerships, urgent items. Show me everything you found and all drafted replies ready to send." },
  { id: "goals-sprint", category: "Productivity", title: "Weekly Goals Sprint", description: "Break your top goal into a 7-day sprint with daily tasks and success metrics.", icon: Target, time: "~1 min", tags: ["Goals","Planning"], prompt: "Check my active goals. For the top goal: create a 7-day sprint plan with one concrete daily task, success metrics for each day, identify 3 biggest blockers and solutions, create 2 accountability checkpoints. Create the goal and all tasks in my account." },
  { id: "funding-research", category: "Research", title: "Funding Landscape Report", description: "Research 20 active seed investors, their thesis, portfolio, and check sizes.", icon: FileText, time: "~4 min", tags: ["Research","Funding"], prompt: "Research current AI startup funding landscape. Find 20 active seed-stage investors who funded AI/productivity startups in past 12 months. For each: fund name, partner, check size, portfolio, investment thesis, how to reach them. Save as investor database report." },
];

const CATS = ["All","Research","Sales","Marketing","Email","Productivity"];

export default function SkillsPage() {
  const router = useRouter();
  const { startNewChat, setMessages } = useChat();
  const [cat, setCat] = useState("All");
  const [running, setRunning] = useState<string|null>(null);

  const filtered = cat === "All" ? SKILLS : SKILLS.filter(s => s.category === cat || s.tags.includes(cat));

  const runSkill = async (skill: typeof SKILLS[0]) => {
    setRunning(skill.id);
    toast.success("Starting " + skill.title + "...");
    await startNewChat();
    setMessages([{ id: Date.now().toString(), role: "user" as const, content: skill.prompt, toolCalls: [], toolResults: [] }]);
    setTimeout(() => router.push("/dashboard"), 400);
  };

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--fg-primary)] mb-1">Skills</h1>
          <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>One-click agent workflows. Pick a skill, your AI starts working immediately.</p>
        </motion.div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ background: cat === c ? "var(--foreground)" : "var(--background-elevated)", color: cat === c ? "var(--background)" : "var(--foreground-secondary)", border: cat === c ? "none" : "1px solid var(--border)" }}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill, i) => {
            const Icon = skill.icon;
            const isRun = running === skill.id;
            return (
              <motion.div key={skill.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex flex-col rounded-2xl border overflow-hidden transition-all duration-200"
                style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"}>
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }}>
                      <Icon className="w-4 h-4 text-[var(--fg-primary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "var(--background-overlay)", color: "var(--foreground-secondary)", border: "1px solid var(--border)" }}>{skill.time}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--fg-primary)] mb-1.5">{skill.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-secondary)" }}>{skill.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {skill.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: "var(--background-overlay)", color: "var(--foreground-tertiary)" }}>{t}</span>)}
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button onClick={() => runSkill(skill)} disabled={!!running}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: isRun ? "var(--background-overlay)" : "var(--foreground)", color: isRun ? "var(--foreground-secondary)" : "var(--background)" }}>
                    <div className="flex items-center gap-2">
                      {isRun ? <motion.div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} /> : <Play className="w-3.5 h-3.5" />}
                      {isRun ? "Starting..." : "Run Skill"}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 p-5 rounded-2xl border" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-bold text-[var(--fg-primary)] mb-3">Slash Commands in Dashboard</h3>
          <p className="text-xs mb-4" style={{ color: "var(--foreground-secondary)" }}>Type these shortcuts directly in the chat:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[["/inbox","Read Gmail inbox"],[" /research [topic]","Deep research + save"],[" /email [to] [topic]","Compose and send"],[" /post [content]","Schedule social post"],[" /goal [title]","Create a goal"],[" /brief","Morning briefing"]].map(([cmd,desc]) => (
              <div key={cmd} className="flex flex-col gap-1">
                <code className="text-xs font-mono text-[var(--fg-primary)] px-2 py-1 rounded-lg" style={{ background: "var(--background-overlay)" }}>{cmd}</code>
                <span className="text-[10px]" style={{ color: "var(--foreground-tertiary)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
