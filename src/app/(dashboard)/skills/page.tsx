"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/lib/chat-context";
import { useAuth } from "@/lib/auth-context";
import { redirectToSignIn } from "@/lib/auth-gate";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Search, Mail, Share2, Target, TrendingUp, Users, FileText, Rocket, Plus, X, Loader2, Sparkles, Globe, GitBranch, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SKILLS = [
  { id: "inbox-intelligence", category: "Email", title: "Inbox Intelligence", description: "Reads your inbox, surfaces the top 5 priorities, and drafts replies to routine emails.", icon: Mail, time: "~2 min", tags: ["Email","Inbox"], prompt: "Read my inbox, identify the top 5 priorities, and draft replies for routine emails. Present the priorities clearly and prepare polished drafts where appropriate." },
  { id: "market-pulse", category: "Research", title: "Market Pulse", description: "Daily scan of competitor news, pricing changes, and industry headlines. Delivered as a structured brief.", icon: Search, time: "~3 min", tags: ["Research","News"], prompt: "Run a daily market pulse scan covering competitor news, pricing changes, and key industry headlines. Return the output as a structured brief with the most important developments first." },
  { id: "weekly-ops-report", category: "Productivity", title: "Weekly Ops Report", description: "Pulls data from your connected tools and generates a full executive summary every Monday.", icon: FileText, time: "~4 min", tags: ["Reports","Operations"], prompt: "Pull data from my connected tools and generate a weekly operations report with an executive summary, key metrics, notable changes, risks, and next actions." },
  { id: "lead-research", category: "Sales", title: "Lead Research", description: "Researches any person or company and returns a contact brief with LinkedIn, funding, recent news.", icon: Globe, time: "~3 min", tags: ["Sales","Research"], prompt: "Research a person or company and return a contact brief including LinkedIn presence, funding background, recent news, company context, and useful outreach insights." },
  { id: "meeting-prep", category: "Productivity", title: "Meeting Prep", description: "Given a meeting in your calendar, auto-researches all attendees and returns a pre-call brief.", icon: Sparkles, time: "~2 min", tags: ["Meetings","Research"], prompt: "Given an upcoming meeting in my calendar, research every attendee and return a pre-call brief with who they are, company background, recent news, and suggested talking points." },
  { id: "content-summarizer", category: "Research", title: "Content Summarizer", description: "Paste a URL, PDF, or YouTube link. Returns a structured 5-point summary with key takeaways.", icon: Search, time: "~2 min", tags: ["Research","Summaries"], prompt: "Summarize the provided URL, PDF, or YouTube link into a structured 5-point summary with key takeaways, important facts, and recommended next actions." },
  { id: "investor-outreach", category: "Sales", title: "Investor Outreach", description: "Research 10 active AI investors, draft personalized cold emails, save as drafts ready to send.", icon: TrendingUp, time: "~3 min", tags: ["Research","Email"], prompt: "Research 10 active investors who fund enterprise AI and B2B SaaS. For each: name, fund, portfolio, contact info. Draft a personalized cold email pitching Inceptive as secure enterprise AI that helps teams ship work faster with governance. Save each as email draft." },
  { id: "competitor-research", category: "Research", title: "Competitor Deep Dive", description: "Analyze 5 top AI agent competitors: features, pricing, weaknesses, and market gaps.", icon: Search, time: "~4 min", tags: ["Research","Strategy"], prompt: "Deep competitive analysis of top 5 enterprise AI assistants and agent platforms (e.g. Microsoft Copilot, comparable B2B agents). For each: key features, pricing, security posture, weaknesses, target customer. Identify 3 biggest market gaps for Inceptive in the enterprise. Save a comprehensive report." },
  { id: "content-calendar", category: "Marketing", title: "30-Day Content Calendar", description: "Full 30-day social media plan with written posts for Twitter, LinkedIn, and Instagram.", icon: Share2, time: "~2 min", tags: ["Social","Marketing"], prompt: "Create a 30-day LinkedIn-first content calendar for Inceptive as an enterprise B2B SaaS brand. Write posts for LinkedIn (3x/week), Twitter/X (2x/week), short video scripts where relevant. Tone: credible, procurement-friendly, outcomes over hype. Schedule the first 5 posts." },
  { id: "lead-gen", category: "Sales", title: "Lead Generation", description: "Find 20 potential customers, research their pain points, draft personalized outreach messages.", icon: Users, time: "~3 min", tags: ["Research","Email","Sales"], prompt: "Find 20 enterprise accounts that fit Inceptive (mid-market and up, teams adopting AI for ops and knowledge work). For each: company, likely buyer persona, pain hypothesis, draft a short personalized outreach email. Save a report with all 20 leads and drafted messages." },
  { id: "morning-brief", category: "Productivity", title: "Morning Intelligence Brief", description: "Latest AI news, competitor moves, and funding rounds - summarized in 2 minutes.", icon: Zap, time: "~2 min", tags: ["Research","News"], prompt: "Create my morning intelligence brief for an enterprise AI buyer. Research: 1) Top 5 enterprise AI / agent platform stories from past 24h, 2) Major vendor moves (cloud + AI platforms), 3) Notable funding or M&A in B2B AI, 4) Regulatory or security headlines that affect deployment. Summarize into a clean 2-minute read. Save as research report titled Morning Brief." },
  { id: "launch-plan", category: "Marketing", title: "Product Launch Plan", description: "Complete launch strategy: viral announcement, Product Hunt copy, press list, 7-day plan.", icon: Rocket, time: "~3 min", tags: ["Marketing","Launch"], prompt: "Create an enterprise GTM launch plan for Inceptive B2B SaaS: 1) Executive one-pager and positioning, 2) LinkedIn announcement post + thread for IT and ops leaders, 3) 10 trade and industry journalists or analysts to brief, 4) 7-day rollout checklist for sales and CS. Save as research report." },
  { id: "email-inbox", category: "Email", title: "Smart Inbox Management", description: "Read Gmail inbox, identify what needs replies, draft smart responses for each.", icon: Mail, time: "~2 min", tags: ["Email","Gmail"], prompt: "Read my Gmail inbox. For each unread email: summarize it, decide if it needs a reply, draft a professional reply if yes. Prioritize customer escalations, security or procurement threads, partnerships, and urgent items. Show me everything you found and all drafted replies ready to send." },
  { id: "goals-sprint", category: "Productivity", title: "Weekly Goals Sprint", description: "Break your top goal into a 7-day sprint with daily tasks and success metrics.", icon: Target, time: "~1 min", tags: ["Goals","Planning"], prompt: "Check my active goals. For the top goal: create a 7-day sprint plan with one concrete daily task, success metrics for each day, identify 3 biggest blockers and solutions, create 2 accountability checkpoints. Create the goal and all tasks in my account." },
  { id: "funding-research", category: "Research", title: "Funding Landscape Report", description: "Research 20 active seed investors, their thesis, portfolio, and check sizes.", icon: FileText, time: "~4 min", tags: ["Research","Funding"], prompt: "Research the B2B SaaS and enterprise AI funding landscape. Find 20 active investors who backed AI workflow, security, or productivity companies in the past 12 months. For each: fund name, partner, check size, portfolio fit for Inceptive-style products, thesis, how to reach them. Save as investor database report." },
  {
    id: "code-reviewer",
    category: "Engineering",
    title: "AI Code Reviewer",
    description: "Paste a PR diff or code block. Get a senior engineer's review with bugs, security risks, and improvements.",
    icon: GitBranch,
    time: "~1 min",
    tags: ["Engineering", "Code"],
    prompt: "Review the following code as a senior software engineer. Identify: 1) Bugs or logic errors, 2) Security vulnerabilities, 3) Performance issues, 4) Code style and best practice violations, 5) Suggested improvements with example rewrites. Be specific and actionable."
  },
  {
    id: "support-ticket-resolver",
    category: "Operations",
    title: "Support Ticket Resolver",
    description: "Paste internal support tickets. AI drafts responses and suggests resolution paths.",
    icon: MessageSquare,
    time: "~2 min",
    tags: ["Support", "Operations"],
    prompt: "You are an expert internal support agent. I will give you a support ticket. Draft a professional, empathetic response that: resolves the issue if possible, explains any steps needed, escalates if necessary, and suggests how to prevent this issue in future. Be concise and direct."
  },
  {
    id: "legal-contract-review",
    category: "Legal",
    title: "Contract Risk Scanner",
    description: "Paste contract text. AI flags risky clauses, missing protections, and negotiation points.",
    icon: FileText,
    time: "~2 min",
    tags: ["Legal", "Risk"],
    prompt: "Review this contract as an expert legal analyst. Flag: 1) High-risk clauses (liability, IP, termination), 2) Missing standard protections, 3) Unusual or one-sided terms, 4) Recommended changes and negotiation points. Present findings clearly with clause references."
  },
  {
    id: "internal-knowledge-search",
    category: "Operations",
    title: "Policy Q&A",
    description: "Ask any question about company policies, procedures, or internal documents.",
    icon: Search,
    time: "~30 sec",
    tags: ["Search", "HR", "Compliance"],
    prompt: "Answer the following question about company policy or procedure. Be accurate, cite relevant policy sections if possible, and if uncertain say so clearly rather than guessing."
  },
  {
    id: "incident-postmortem",
    category: "Engineering",
    title: "Incident Post-Mortem",
    description: "Paste an incident timeline. AI generates a structured post-mortem with root cause and action items.",
    icon: Zap,
    time: "~2 min",
    tags: ["Engineering", "Operations"],
    prompt: "Generate a structured engineering post-mortem from this incident description. Include: Executive Summary, Timeline of Events, Root Cause Analysis, Contributing Factors, Impact Assessment, Immediate Actions Taken, Long-term Preventive Measures, Owners and Deadlines for each action item."
  },
];

const CATS = ["All", "Research", "Sales", "Marketing", "Email", "Productivity", "Engineering", "Legal", "Operations"];

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
  const { user } = useAuth();
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
    if (!user) {
      redirectToSignIn();
      return;
    }
    setRunning(skill.id);
    toast.success("Starting " + skill.title + "...");
    await startNewChat();
    const prefill = encodeURIComponent(skill.prompt);
    router.push(`/dashboard?prefill=${prefill}`);
  };

  return (
    <>
      <div className="page-frame">
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)] mb-3">
                <Sparkles size={12} />
                Agent Library
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)]">Skills & Playbooks</h1>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">One-click agents that run autonomously. Configure once, delegate forever.</p>
            </div>
            <button
              onClick={() => {
                if (!user) {
                  redirectToSignIn();
                  return;
                }
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
          </div>
        </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((skill, i) => {
            const Icon = skill.icon;
            const isRun = running === skill.id;
            return (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-elevated p-6 bg-[var(--bg-surface)] cursor-pointer group animate-fade-in-up flex flex-col h-full"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]">
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-[var(--fg-primary)] mb-1">{skill.title}</h3>
                <p className="text-sm text-[var(--fg-muted)] mb-4 leading-relaxed">{skill.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {skill.tags.map(t => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] text-[var(--fg-tertiary)] border border-[var(--border-subtle)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => runSkill(skill)}
                  disabled={!!running}
                  className={cn(
                    "mt-auto w-full rounded-xl bg-[var(--fg-primary)] py-2 text-sm font-medium text-[var(--bg-base)] hover:opacity-90 transition-opacity",
                    isRun && "opacity-80"
                  )}
                >
                  {isRun ? "Starting..." : "Run Now"}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 border-t border-[var(--border-subtle)] pt-8">
          <h3 className="text-sm font-bold text-[var(--fg-primary)] mb-3">Slash Commands in Dashboard</h3>
          <p className="text-xs mb-4 text-[var(--fg-secondary)]">Type these shortcuts directly in the chat:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[["/inbox","Read Gmail inbox"],[" /research [topic]","Deep research + save"],[" /email [to] [topic]","Compose and send"],[" /post [content]","Schedule social post"],[" /goal [title]","Create a goal"],[" /brief","Morning briefing"]].map(([cmd,desc]) => (
              <div key={cmd} className="flex flex-col gap-1">
                <code className="text-xs font-mono text-[var(--fg-primary)] px-0 py-0.5 rounded-none bg-transparent">{cmd}</code>
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
