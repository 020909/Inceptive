"use client";
import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Loader2, Send, Trash2, Plus, Unlink, Inbox, Sparkles, X, ChevronRight } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface DraftEmail { id: string; recipient: string; subject: string; body: string; status: string; created_at: string; }
interface InboxEmail { id: string; subject: string; from: string; snippet: string; threadId?: string; }
interface ConnectedAccount { provider: string; account_email?: string; }

const CONNECTORS = [
  { id: "gmail", name: "Gmail", description: "Google Mail", oauthPath: "/api/auth/google/connect" },
  { id: "outlook", name: "Outlook", description: "Microsoft 365", oauthPath: "/api/auth/microsoft/connect" },
  { id: "icloud", name: "iCloud", description: "Coming soon", oauthPath: null },
];

export default function EmailPage() {
  const { user, session, refresh: refreshAuth } = useAuth();
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [inbox, setInbox] = useState<InboxEmail[]>([]);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [loading, setLoading] = useState(true);
  const [loadingInbox, setLoadingInbox] = useState(false);
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
  const [topic, setTopic] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState("Professional");
  const [preview, setPreview] = useState<DraftEmail | null>(null);

  const token = session?.access_token;

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/connectors", { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      setAccounts((d.accounts || []).filter((a: any) => ["gmail","outlook","icloud"].includes(a.provider)));
    } catch {}
  }, [token]);

  const fetchInbox = useCallback(async () => {
    if (!token) return;
    setLoadingInbox(true);
    try {
      const r = await fetch("/api/emails/inbox", { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      if (r.ok) setInbox(d.messages || []);
    } catch {} finally { setLoadingInbox(false); setLoading(false); }
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
      // Handle different response formats
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

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !recipient || !token || !user) return;
    setGenerating(true); setPreview(null);
    try {
      const r = await fetch("/api/agent/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ topic, recipient, tone, user_id: user.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPreview(d.email); setDrafts(prev => [d.email, ...prev]);
      toast.success("Draft ready");
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
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

  if (loading) return (
    <PageTransition>
      <div className="max-w-5xl mx-auto p-8 space-y-4">
        <div className="h-8 w-48 shimmer rounded-xl" />
        <div className="h-20 shimmer rounded-2xl" />
        <div className="h-64 shimmer rounded-2xl" />
      </div>
    </PageTransition>
  );

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto p-6 md:p-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Email Autopilot</h1>
            <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
              {gmail ? "Connected as " + gmail.account_email : "Connect Gmail to read, reply and send emails with AI"}
            </p>
          </div>
          <Button onClick={() => setComposeOpen(true)} className="h-9 px-4 text-sm font-semibold rounded-xl border-0" style={{ background: "var(--foreground)", color: "var(--background)" }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Compose
          </Button>
        </div>

        {/* Connectors row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {CONNECTORS.map(c => {
            const acc = accounts.find(a => a.provider === c.id);
            const connected = !!acc;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border" style={{ background: "var(--background-elevated)", borderColor: connected ? "rgba(255,255,255,0.15)" : "var(--border)" }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: connected ? "#FFFFFF" : "#333333" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{c.name}</div>
                  <div className="text-xs truncate" style={{ color: "var(--foreground-secondary)" }}>{connected ? acc?.account_email : c.description}</div>
                </div>
                {connected ? (
                  <button onClick={() => disconnect(c.id)} title="Disconnect" className="opacity-30 hover:opacity-80 transition-opacity" style={{ color: "#FF3B30" }}>
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                ) : c.oauthPath ? (
                  <button onClick={() => { if (!token) return; window.location.href = c.oauthPath + "?token=" + encodeURIComponent(token) + "&redirect_to=/email"; }}
                    className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: "var(--foreground)", color: "var(--background)" }}>
                    Connect
                  </button>
                ) : (
                  <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Soon</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 p-1 rounded-xl mb-6" style={{ background: "var(--background-elevated)", width: "fit-content" }}>
          {(["inbox", "sent"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: tab === t ? "var(--background-overlay)" : "transparent", color: tab === t ? "white" : "var(--foreground-secondary)" }}>
              {t === "inbox" ? <Inbox className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {t === "inbox" ? "Live Inbox" : "Sent & Drafts"}
            </button>
          ))}
        </div>

        {/* Inbox */}
        {tab === "inbox" && (loadingInbox ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--foreground-secondary)" }} /></div>
        ) : inbox.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-2xl border text-center" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
            <Mail className="h-8 w-8 mb-3" style={{ color: "var(--foreground-secondary)" }} />
            <p className="text-sm font-semibold text-white mb-1">{gmail ? "Inbox is empty" : "Gmail not connected"}</p>
            <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{gmail ? "No unread messages" : "Connect Gmail above to see your inbox"}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {inbox.map((msg, i) => (
              <motion.button key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                onClick={() => openEmail(msg)} className="w-full text-left px-5 py-4 rounded-xl border group transition-colors"
                style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.background = "var(--background-overlay)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--background-elevated)"; }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--background-overlay)", color: "white" }}>
                    {(msg.from[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-white truncate">{msg.from.split("<")[0].trim()}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] shrink-0" />
                    </div>
                    <p className="text-sm font-medium text-white truncate">{msg.subject}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--foreground-secondary)" }}>{msg.snippet}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--foreground-secondary)" }} />
                </div>
              </motion.button>
            ))}
          </div>
        ))}

        {/* Sent & Drafts */}
        {tab === "sent" && (drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-2xl border text-center" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
            <Send className="h-8 w-8 mb-3" style={{ color: "var(--foreground-secondary)" }} />
            <p className="text-sm font-semibold text-white mb-1">No emails yet</p>
            <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Use Compose to draft and send emails with AI</p>
          </div>
        ) : (
          <div className="space-y-1">
            {drafts.map((email, i) => (
              <motion.div key={email.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 px-5 py-4 rounded-xl border" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--background-overlay)", color: "white" }}>
                  {(email.recipient[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
                  <p className="text-xs truncate" style={{ color: "var(--foreground-secondary)" }}>To: {email.recipient}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: email.status === "sent" ? "#FFFFFF" : "#FFFFFF" }} />
                  <span className="text-xs capitalize" style={{ color: "var(--foreground-secondary)" }}>{email.status}</span>
                  <span className="text-xs" style={{ color: "var(--foreground-tertiary)" }}>{formatTimeAgo(new Date(email.created_at))}</span>
                  {email.status === "draft" && (
                    <button onClick={() => sendDraft(email.id)} disabled={sending}
                      className="text-xs px-3 py-1 rounded-lg font-semibold" style={{ background: "var(--foreground)", color: "var(--background)" }}>
                      Send
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ))}
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
              className="w-full max-w-2xl flex flex-col rounded-2xl border overflow-hidden"
              style={{ background: "var(--background)", borderColor: "var(--border)", maxHeight: "88vh" }}>

              {/* Modal header */}
              <div className="px-6 py-5 border-b flex items-start gap-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-white mb-1">{selected.subject}</h2>
                  <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{selected.from}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={summarizeEmail} disabled={summarizing || loadingBody}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" }}>
                    {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Summary
                  </button>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--background-elevated)", color: "var(--foreground-secondary)" }}>
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
                      <Sparkles className="w-3.5 h-3.5" style={{ color: "#FFFFFF" }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#FFFFFF" }}>AI Summary</span>
                    </div>
                    <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{summary}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {loadingBody ? (
                  <div className="flex items-center gap-2" style={{ color: "var(--foreground-secondary)" }}>
                    <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading email...</span>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground-secondary)" }}>{emailBody || selected.snippet}</div>
                )}
              </div>

              {/* Reply box */}
              <div className="px-6 py-4 border-t" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
                <div className="flex gap-2">
                  <Input value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && reply.trim()) { e.preventDefault(); sendReply(); } }}
                    placeholder={gmail ? "Write a reply and press Enter..." : "Connect Gmail to reply"}
                    disabled={!gmail}
                    className="flex-1 text-sm" style={{ background: "var(--background)", border: "1px solid var(--border)", color: "white" }} />
                  <Button onClick={sendReply} disabled={sending || !reply.trim() || !gmail}
                    className="h-10 px-4 rounded-xl border-0" style={{ background: "var(--foreground)", color: "var(--background)" }}>
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
        <DialogContent className="border text-white sm:max-w-lg" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <DialogHeader><DialogTitle className="text-white">Compose with AI</DialogTitle></DialogHeader>
          {!preview ? (
            <form onSubmit={generate} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: "var(--foreground-secondary)" }}>To</Label>
                <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="recipient@email.com" required style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", color: "white" }} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: "var(--foreground-secondary)" }}>Topic</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What is this email about?" required style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", color: "white" }} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: "var(--foreground-secondary)" }}>Tone</Label>
                <Select value={tone} onValueChange={(v) => { if (v) setTone(v); }}>
                  <SelectTrigger style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", color: "white" }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: "var(--background)", border: "1px solid var(--border)", color: "white" }}>
                    {["Professional","Friendly","Formal","Persuasive","Casual"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={generating} className="w-full border-0 rounded-xl font-semibold" style={{ background: "var(--foreground)", color: "var(--background)" }}>
                {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Writing...</> : "Generate with AI"}
              </Button>
            </form>
          ) : (
            <div className="pt-2 space-y-4">
              <div className="rounded-xl border p-4" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--foreground-secondary)" }}>To: <span className="text-white">{preview.recipient}</span></p>
                <p className="text-sm font-bold text-white mb-3">{preview.subject}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground-secondary)" }}>{preview.body}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => sendDraft(preview.id)} disabled={sending} className="flex-1 border-0 font-semibold" style={{ background: "var(--foreground)", color: "var(--background)" }}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {hasConnected ? "Send via Gmail" : "Save Draft"}
                </Button>
                <Button onClick={() => { setPreview(null); setComposeOpen(false); }} variant="outline" className="border" style={{ background: "transparent", borderColor: "var(--border)", color: "#FF3B30" }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
