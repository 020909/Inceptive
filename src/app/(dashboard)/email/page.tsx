"use client";
import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Loader2, Send, Trash2, Plus, Unlink, Sparkles, X, Search, Filter, Archive, Reply, Star } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface DraftEmail { id: string; recipient: string; subject: string; body: string; status: string; created_at: string; }
interface InboxEmail { id: string; subject: string; from: string; snippet: string; threadId?: string; }
interface ConnectedAccount { provider: string; account_email?: string; }

const CONNECTORS = [
  { id: "gmail", name: "Gmail", description: "Google Mail", oauthPath: "/api/auth/google/connect" },
  { id: "outlook", name: "Outlook", description: "Microsoft 365", oauthPath: "/api/auth/microsoft/connect" },
];

const SUPPORTED_CONNECTOR_IDS = new Set(CONNECTORS.map((connector) => connector.id));
const TONES = ["Professional", "Friendly", "Assertive", "Empathetic"];

function EmailRow({ email, index, onClick }: { email: InboxEmail | DraftEmail; index: number; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const isInbox = 'from' in email;

  return (
    <motion.div
      className="group flex items-center gap-4 px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer transition-all duration-200 hover:bg-[var(--bg-elevated)]"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 100, damping: 20 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <button className="p-1 rounded hover:bg-[var(--bg-elevated)]">
        <Star size={16} className="text-[var(--fg-muted)]" />
      </button>

      <div className="w-32 shrink-0">
        <span className="text-sm text-[var(--fg-tertiary)]">
          {isInbox ? email.from.split("<")[0].trim() : `To: ${email.recipient}`}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--fg-primary)]">
          {email.subject}
        </span>
        <span className="text-sm text-[var(--fg-muted)] ml-2">
          — {(email as any).snippet || (email as any).body?.substring(0, 50) || ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <button className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]" onClick={(e) => e.stopPropagation()}>
            <Archive size={14} className="text-[var(--fg-tertiary)]" />
          </button>
          <button className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]" onClick={(e) => e.stopPropagation()}>
            <Trash2 size={14} className="text-[var(--fg-tertiary)]" />
          </button>
          <button className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]" onClick={(e) => e.stopPropagation()}>
            <Reply size={14} className="text-[var(--fg-tertiary)]" />
          </button>
        </motion.div>
        <span className="text-xs text-[var(--fg-muted)] w-16 text-right">
          {'created_at' in email ? formatTimeAgo(new Date(email.created_at)) : 'now'}
        </span>
      </div>
    </motion.div>
  );
}

export default function EmailPage() {
  const { user, session, refresh: refreshAuth } = useAuth();
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [inbox, setInbox] = useState<InboxEmail[]>([]);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [loading, setLoading] = useState(true);
  const [inboxError, setInboxError] = useState<null | { code?: string; message: string }>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selected, setSelected] = useState<InboxEmail | null>(null);
  const [emailBody, setEmailBody] = useState("");
  const [loadingBody, setLoadingBody] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [composeInput, setComposeInput] = useState("");
  const [selectedTone, setSelectedTone] = useState("Professional");
  const [aiComposing, setAiComposing] = useState(false);
  const [topic, setTopic] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState("Professional");
  const [preview, setPreview] = useState<DraftEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const token = session?.access_token;

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/connectors", { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      setAccounts((d.accounts || []).filter((a: any) => SUPPORTED_CONNECTOR_IDS.has(a.provider)));
    } catch {}
  }, [token]);

  const fetchInbox = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/emails/inbox?unread_only=0&limit=30", { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      if (r.ok) {
        setInbox(d.messages || []);
        setInboxError(null);
      } else {
        const code = d?.code as string | undefined;
        const message = d?.error || d?.message || "Failed to load inbox";
        const reason = typeof d?.reason === "string" ? d.reason : undefined;
        setInboxError({ code, message: reason ? `${message} ${reason}` : message });
        if (code === "NOT_CONNECTED") {
          toast.error("Gmail is not connected. Go to Connectors and click Connect for Gmail.");
        } else {
          toast.error(reason ? `${message} ${reason}` : message);
        }
        setInbox([]);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load inbox");
      setInboxError({ message: e?.message || "Failed to load inbox" });
      setInbox([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    try {
      const sb = createClient();
      const { data } = await sb.from("emails").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setDrafts(data || []);
    } catch {} finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!token || !user) { setLoading(false); return; }
    fetchAccounts(); fetchInbox(); fetchDrafts();
  }, [token, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) {
      toast.success(p.get("connected") + " connected!");
      refreshAuth().then(() => { fetchAccounts(); fetchInbox(); });
      window.history.replaceState({}, "", "/email");
    }
  }, []);

  const openEmail = async (email: InboxEmail) => {
    setSelected(email); setEmailBody(""); setSummary(""); setReply(""); setLoadingBody(true);
    try {
      const r = await fetch("/api/emails/full?id=" + email.id, { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      setEmailBody(d.body || email.snippet);
    } catch { setEmailBody(email.snippet); }
    finally { setLoadingBody(false); }
  };

  const summarizeEmail = async () => {
    if (!selected || !emailBody) return;
    setSummarizing(true); setSummary("");
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ 
          messages: [{ 
            role: "user", 
            content: `Summarize this email in 3 bullet points:\n\nFrom: ${selected.from}\nSubject: ${selected.subject}\n\n${emailBody}` 
          }], 
          stream: false 
        }),
      });
      const d = await r.json();
      setSummary(
        d.choices?.[0]?.message?.content || 
        d.content || 
        "Could not summarize."
      );
    } catch (e: any) {
      console.error("Summarization error:", e);
      setSummary("Summarization failed: " + (e.message || "Unknown error"));
    }
    finally { setSummarizing(false); }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const r = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ to: selected.from, subject: selected.subject, body: reply, thread_id: selected.threadId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Reply sent!"); setReply(""); setSelected(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const generateDraftEmail = async ({
    draftTopic,
    draftRecipient,
    draftTone,
    source,
  }: {
    draftTopic: string;
    draftRecipient: string;
    draftTone: string;
    source: "modal" | "hero";
  }) => {
    if (!draftTopic || !draftRecipient || !token || !user) return;

    if (source === "hero") {
      setAiComposing(true);
    } else {
      setGenerating(true);
    }
    setPreview(null);

    try {
      const r = await fetch("/api/agent/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ topic: draftTopic, recipient: draftRecipient, tone: draftTone, user_id: user.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      setTopic(draftTopic);
      setRecipient(d.email?.recipient || draftRecipient);
      setTone(draftTone);
      setPreview(d.email);
      setDrafts(prev => [d.email, ...prev]);

      if (source === "hero") {
        setComposeOpen(true);
      }

      toast.success("Draft ready");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      if (source === "hero") {
        setAiComposing(false);
      } else {
        setGenerating(false);
      }
    }
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateDraftEmail({
      draftTopic: topic,
      draftRecipient: recipient,
      draftTone: tone,
      source: "modal",
    });
  };

  const handleAiCompose = async () => {
    if (!composeInput.trim()) return;

    await generateDraftEmail({
      draftTopic: composeInput.trim(),
      draftRecipient: recipient.trim() || "there",
      draftTone: selectedTone,
      source: "hero",
    });
  };

  const sendDraft = async (id: string) => {
    if (!token) return; setSending(true);
    try {
      const r = await fetch("/api/actions/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ email_id: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Sent!"); setComposeOpen(false); setPreview(null); fetchDrafts();
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const disconnect = async (id: string) => {
    if (!token) return;
    await fetch("/api/connectors?provider=" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
    setAccounts(prev => prev.filter(a => a.provider !== id));
    toast.success("Disconnected");
  };

  const gmail = accounts.find(a => a.provider === "gmail");
  const hasConnected = accounts.some(a => ["gmail","outlook"].includes(a.provider));

  const filteredInbox = searchQuery 
    ? inbox.filter(e => e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || e.from.toLowerCase().includes(searchQuery.toLowerCase()))
    : inbox;

  const filteredDrafts = searchQuery
    ? drafts.filter(e => e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || e.recipient.toLowerCase().includes(searchQuery.toLowerCase()))
    : drafts;

  if (loading) return (
    <>
      <div className="min-h-screen flex flex-col">
        <div className="h-28 shimmer rounded-[28px] mx-8 mt-8" />
        <div className="flex-1 shimmer rounded-2xl mx-8 mt-4" />
      </div>
    </>
  );

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Content */}
        <div className="flex-1 flex pt-2">
          {/* Sidebar Filters */}
          <div className="w-56 border-r border-[var(--border-subtle)] p-4">
            <div className="space-y-1">
              {(['inbox', 'sent'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTab(filter)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm capitalize
                    transition-all duration-200
                    ${tab === filter
                      ? 'bg-[var(--bg-overlay)] text-[var(--fg-primary)]'
                      : 'text-[var(--fg-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]/80'
                    }
                  `}
                >
                  <span>{filter}</span>
                  {filter === 'inbox' && (
                    <span className="text-xs text-[var(--fg-muted)]">{inbox.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Email Stats */}
            <div className="mt-8 p-4 rounded-2xl bg-[var(--bg-elevated)] card-elevated">
              <p className="text-[var(--fg-muted)] text-xs mb-3">Overview</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--fg-tertiary)]">Inbox</span>
                  <span className="text-[var(--fg-primary)]">{inbox.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--fg-tertiary)]">Drafts</span>
                  <span className="text-[var(--fg-primary)]">{drafts.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--fg-tertiary)]">Connected</span>
                  <span className="text-[var(--fg-primary)]">{accounts.length}</span>
                </div>
              </div>
            </div>

            {/* Connectors */}
            <div className="mt-8 space-y-2">
              <p className="text-[var(--fg-muted)] text-xs mb-2">Connected Accounts</p>
              {accounts.length === 0 ? (
                <div className="px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--fg-muted)]">
                  No connected accounts yet
                </div>
              ) : (
                accounts.map((acc) => (
                  <div key={`${acc.provider}-${acc.account_email || ""}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[var(--fg-primary)]">
                        {acc.provider === "gmail" ? "Gmail" : acc.provider === "outlook" ? "Outlook" : acc.provider}
                      </span>
                      {acc.account_email && <p className="text-[10px] text-[var(--fg-muted)] truncate">{acc.account_email}</p>}
                    </div>
                    <button onClick={() => disconnect(acc.provider)} className="text-[var(--fg-muted)] hover:text-red-400 transition-colors">
                      <Unlink size={12} />
                    </button>
                  </div>
                ))
              )}

              {accounts.length === 0 && (
                <div className="pt-2 space-y-1">
                  {CONNECTORS.filter((c) => c.oauthPath).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { if (!token) return; window.location.href = `${c.oauthPath}?token=${encodeURIComponent(token)}&redirect_to=/email`; }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                    >
                      Connect {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Email List */}
          <div className="flex-1 flex flex-col">
            {tab === "inbox" && inboxError && (
              <div className="px-4 pt-4">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--fg-secondary)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[var(--fg-primary)] font-medium">Inbox isn’t loading</p>
                      <p className="mt-1 text-xs text-[var(--fg-muted)] break-words">{inboxError.message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => fetchInbox()}
                        className="border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:opacity-90"
                      >
                        Retry
                      </Button>
                      <Button
                        type="button"
                        onClick={() => (window.location.href = "/social")}
                        className="border-0 bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90"
                      >
                        Go to Connectors
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 pt-4">
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 mb-6 shadow-[0_18px_36px_rgba(0,0,0,0.18)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Compose with AI</h2>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((toneOption) => {
                        const isSelected = selectedTone === toneOption;
                        return (
                          <button
                            key={toneOption}
                            type="button"
                            onClick={() => setSelectedTone(toneOption)}
                            className={
                              isSelected
                                ? "rounded-full px-3 py-1 text-xs border transition-all border-[var(--fg-primary)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                                : "rounded-full px-3 py-1 text-xs border transition-all border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                            }
                          >
                            {toneOption}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="e.g. 'Happy birthday to Sarah' or 'Follow up on our proposal from last week'"
                    value={composeInput}
                    onChange={(e) => setComposeInput(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--fg-primary)] resize-none outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAiCompose}
                    disabled={aiComposing || !composeInput.trim()}
                    className="w-full mt-4 bg-[var(--accent)] text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {aiComposing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {aiComposing ? "Generating..." : "Generate & Preview"}
                  </button>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-subtle)]">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-sm placeholder:text-[var(--fg-primary)]/30 focus:outline-none focus:border-[var(--border-default)]"
                />
              </div>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--fg-primary)]/60 hover:bg-[var(--bg-elevated)]">
                <Filter size={16} />
                <span className="text-sm">Filter</span>
              </button>
            </div>

            {/* Emails */}
            <div className="flex-1 overflow-auto">
              {tab === "inbox" ? (
                filteredInbox.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24">
                    <Mail size={32} className="text-[var(--fg-primary)]/30 mb-4" />
                    <p className="text-[var(--fg-primary)]/60">{gmail ? "No emails found" : "Gmail not connected"}</p>
                  </div>
                ) : (
                  filteredInbox.map((email, index) => (
                    <EmailRow key={email.id} email={email} index={index} onClick={() => openEmail(email)} />
                  ))
                )
              ) : (
                filteredDrafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24">
                    <Send size={32} className="text-[var(--fg-primary)]/30 mb-4" />
                    <p className="text-[var(--fg-primary)]/60">No emails yet</p>
                  </div>
                ) : (
                  filteredDrafts.map((email, index) => (
                    <EmailRow key={email.id} email={email} index={index} onClick={() => {}} />
                  ))
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
            onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl flex flex-col rounded-2xl border overflow-hidden bg-[var(--bg-surface)] border-[var(--border-subtle)]"
              style={{ maxHeight: "88vh" }}>

              {/* Modal header */}
              <div className="px-6 py-5 border-b flex items-start gap-4 border-[var(--border-subtle)]">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-[var(--fg-primary)] mb-1">{selected.subject}</h2>
                  <p className="text-sm text-[var(--fg-primary)]/60">{selected.from}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={summarizeEmail} disabled={summarizing || loadingBody}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-overlay)] text-[var(--fg-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors">
                    {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Summary
                  </button>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] text-[var(--fg-primary)]/60 hover:bg-[var(--bg-overlay)]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* AI Summary panel */}
              <AnimatePresence>
                {summary && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="px-6 py-4 border-b overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--fg-primary)]" />
                      <span className="text-xs font-medium uppercase tracking-wider text-[var(--fg-primary)]">AI Summary</span>
                    </div>
                    <p className="text-sm text-[var(--fg-primary)]/80 leading-relaxed whitespace-pre-wrap">{summary}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {loadingBody ? (
                  <div className="flex items-center gap-2 text-[var(--fg-primary)]/60">
                    <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading email...</span>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--fg-primary)]/60">{emailBody || selected.snippet}</div>
                )}
              </div>

              {/* Reply box */}
              <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]">
                <div className="flex gap-2">
                  <Input value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && reply.trim()) { e.preventDefault(); sendReply(); } }}
                    placeholder={gmail ? "Write a reply and press Enter..." : "Connect Gmail to reply"}
                    disabled={!gmail}
                    className="flex-1 text-sm bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)]" />
                  <Button onClick={sendReply} disabled={sending || !reply.trim() || !gmail}
                    className="h-10 px-4 rounded-xl border-0 bg-[var(--fg-primary)] text-[var(--bg-base)]">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose modal */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="border text-[var(--fg-primary)] sm:max-w-lg bg-[var(--bg-surface)] border-[var(--border-subtle)]">
          <DialogHeader><DialogTitle className="text-[var(--fg-primary)]">Compose with AI</DialogTitle></DialogHeader>
          {!preview ? (
            <form onSubmit={generate} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs uppercase tracking-wide mb-1.5 block text-[var(--fg-primary)]/60">To</Label>
                <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="recipient@email.com" required className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)]" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide mb-1.5 block text-[var(--fg-primary)]/60">Topic</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What is this email about?" required className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)]" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide mb-1.5 block text-[var(--fg-primary)]/60">Tone</Label>
                <Select value={tone} onValueChange={(v) => { if (v) setTone(v); }}>
                  <SelectTrigger className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)]">
                    {["Professional","Friendly","Formal","Persuasive","Casual"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={generating} className="w-full border-0 rounded-xl font-medium bg-[var(--fg-primary)] text-[var(--bg-base)]">
                {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Writing...</> : "Generate with AI"}
              </Button>
            </form>
          ) : (
            <div className="pt-2 space-y-4">
              <div className="rounded-xl border p-4 bg-[var(--bg-app)] border-[var(--border-subtle)]">
                <p className="text-xs mb-2 text-[var(--fg-primary)]/60">To: <span className="text-[var(--fg-primary)]">{preview.recipient}</span></p>
                <p className="text-sm font-medium text-[var(--fg-primary)] mb-3">{preview.subject}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--fg-primary)]/60">{preview.body}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => sendDraft(preview.id)} disabled={sending} className="flex-1 border-0 font-medium bg-[var(--fg-primary)] text-[var(--bg-base)]">
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {hasConnected ? "Send via Gmail" : "Save Draft"}
                </Button>
                <Button onClick={() => { setPreview(null); setComposeOpen(false); }} variant="outline" className="border bg-transparent border-[var(--border-subtle)] text-red-400">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
