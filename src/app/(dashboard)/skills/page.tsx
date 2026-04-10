"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/lib/chat-context";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Search, Mail, Share2, Target, TrendingUp, Users, FileText, Rocket, ChevronRight, Play, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

type UserSkill = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  prompt: string;
  created_at: string;
};

type SkillCard = {
  id: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
  prompt: string;
  icon: any;
  time: string;
};

function iconForCategory(category: string) {
  switch (category) {
    case "Research":
      return Search;
    case "Sales":
      return Users;
    case "Marketing":
      return Share2;
    case "Email":
      return Mail;
    case "Productivity":
      return Zap;
    default:
      return FileText;
  }
}

function normalizeUserSkill(skill: UserSkill): SkillCard {
  return {
    id: skill.id,
    category: skill.category,
    title: skill.title,
    description: skill.description || "",
    tags: Array.isArray(skill.tags) && skill.tags.length > 0 ? skill.tags : [skill.category],
    prompt: skill.prompt,
    icon: iconForCategory(skill.category),
    time: "~Custom",
  };
}

export default function SkillsPage() {
  const router = useRouter();
  const { startNewChat } = useChat();
  const [cat, setCat] = useState("All");
  const [running, setRunning] = useState<string|null>(null);
  const [customSkills, setCustomSkills] = useState<UserSkill[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [skillTitle, setSkillTitle] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillCategory, setSkillCategory] = useState<Exclude<typeof CATS[number], "All">>("Research");
  const [skillTagsText, setSkillTagsText] = useState("");
  const [skillPrompt, setSkillPrompt] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);

  const fetchCustomSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) return;
      const data = await res.json();
      setCustomSkills(data.skills || []);
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => { fetchCustomSkills(); }, [fetchCustomSkills]);

  const allSkills: SkillCard[] = [
    ...(SKILLS as SkillCard[]),
    ...(customSkills.map(normalizeUserSkill)),
  ];

  const filtered = cat === "All"
    ? allSkills
    : allSkills.filter(s => s.category === cat || s.tags.includes(cat));

  const runSkill = async (skill: SkillCard) => {
    setRunning(skill.id);
    toast.success("Starting " + skill.title + "...");
    await startNewChat();
    const prefill = encodeURIComponent(skill.prompt);
    router.push(`/dashboard?prefill=${prefill}`);
  };

  return (
    <>
      <div className="page-frame max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-hero mb-8 flex items-start justify-between gap-3 px-6 py-6"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">Playbooks</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--fg-primary)] mb-1">Skills</h1>
            <p className="text-sm text-[var(--fg-secondary)] mt-2">
              Pick a skill and we will prefill your dashboard prompt for review.
            </p>
          </div>
          <button
            onClick={() => {
              setAddOpen(true);
              setSkillTitle("");
              setSkillDescription("");
              setSkillCategory("Research");
              setSkillTagsText("");
              setSkillPrompt("");
            }}
            className="btn-premium flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--primary-foreground)] border border-[var(--accent)] hover:opacity-90 transition-colors text-xs font-semibold"
          >
            <Plus size={14} />
            Add Skill
          </button>
        </motion.div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {CATS.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-semibold transition-all border",
                cat === c
                  ? "bg-[var(--fg-primary)] text-[var(--bg-base)] border-transparent"
                  : "bg-[var(--bg-elevated)] text-[var(--fg-secondary)] border-[var(--border-subtle)]"
              )}
            >
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
                className="flex flex-col rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-all duration-200 bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]">
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
                      <Icon className="w-4 h-4 text-[var(--fg-primary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg-overlay)] text-[var(--fg-secondary)] border border-[var(--border-subtle)]">{skill.time}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--fg-primary)] mb-1.5">{skill.title}</h3>
                  <p className="text-xs leading-relaxed text-[var(--fg-secondary)]">{skill.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {skill.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-overlay)] text-[var(--fg-tertiary)]">{t}</span>)}
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button onClick={() => runSkill(skill)} disabled={!!running}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                      isRun ? "bg-[var(--bg-overlay)] text-[var(--fg-secondary)]" : "bg-[var(--fg-primary)] text-[var(--bg-base)]"
                    )}>
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

        <div className="mt-10 p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <h3 className="text-sm font-bold text-[var(--fg-primary)] mb-3">Slash Commands in Dashboard</h3>
          <p className="text-xs mb-4 text-[var(--fg-secondary)]">Type these shortcuts directly in the chat:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[["/inbox","Read Gmail inbox"],[" /research [topic]","Deep research + save"],[" /email [to] [topic]","Compose and send"],[" /post [content]","Schedule social post"],[" /goal [title]","Create a goal"],[" /brief","Morning briefing"]].map(([cmd,desc]) => (
              <div key={cmd} className="flex flex-col gap-1">
                <code className="text-xs font-mono text-[var(--fg-primary)] px-2 py-1 rounded-lg bg-[var(--bg-overlay)]">{cmd}</code>
                <span className="text-[10px] text-[var(--fg-tertiary)]">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Add Skill modal */}
        <AnimatePresence>
          {addOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
              onClick={() => setAddOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                transition={{ duration: 0.16 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
              >
                <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[var(--fg-primary)] text-base font-semibold">Add Skill</h2>
                    <p className="text-[var(--fg-muted)] text-xs mt-1">Save a reusable skill prompt for your workflows.</p>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-elevated)] text-[var(--fg-tertiary)]"
                    onClick={() => setAddOpen(false)}
                    type="button"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>

                <form
                  className="px-6 py-5 space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const title = skillTitle.trim();
                    const description = skillDescription.trim();
                    const prompt = skillPrompt.trim();

                    if (!title) {
                      toast.error("Skill title is required");
                      return;
                    }
                    if (!prompt) {
                      toast.error("Prompt is required");
                      return;
                    }

                    const tagsParsed = skillTagsText
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);

                    const tags = tagsParsed.length > 0 ? tagsParsed : [skillCategory];

                    setSavingSkill(true);
                    try {
                      const res = await fetch("/api/skills", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title,
                          description,
                          category: skillCategory,
                          tags,
                          prompt,
                        }),
                      });

                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error || "Failed to create skill");

                      toast.success("Skill saved");
                      await fetchCustomSkills();
                      setAddOpen(false);
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to save skill");
                    } finally {
                      setSavingSkill(false);
                    }
                  }}
                >
                  <div>
                    <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">Title</label>
                    <input
                      value={skillTitle}
                      onChange={(e) => setSkillTitle(e.target.value)}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)]"
                      placeholder="e.g. Deal Analyzer"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">Description</label>
                    <input
                      value={skillDescription}
                      onChange={(e) => setSkillDescription(e.target.value)}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)]"
                      placeholder="What does this skill do?"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">Category</label>
                    <select
                      value={skillCategory}
                      onChange={(e) => setSkillCategory(e.target.value as any)}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)]"
                    >
                      {CATS.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c} className="bg-[var(--bg-surface)] text-[var(--fg-primary)]">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">
                      Tags (comma-separated)
                    </label>
                    <input
                      value={skillTagsText}
                      onChange={(e) => setSkillTagsText(e.target.value)}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)]"
                      placeholder="Research, Investors, Funding"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">Prompt</label>
                    <textarea
                      value={skillPrompt}
                      onChange={(e) => setSkillPrompt(e.target.value)}
                      rows={5}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm outline-none focus:border-[var(--border-strong)] resize-none"
                      placeholder="Describe exactly what the skill should do. Save as prompt."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddOpen(false)}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingSkill}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingSkill ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Save Skill
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
