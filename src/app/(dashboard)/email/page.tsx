"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Session } from "@supabase/supabase-js";

import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Loader2, Send, Trash2, Plus, Check, Unlink, ExternalLink } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Email {
  id: string; recipient: string; subject: string; body: string;
  status: "sent" | "draft" | "pending"; created_at: string;
}
interface ConnectedAccount {
  provider: string; account_email?: string; account_name?: string; created_at: string;
  decrypted?: boolean;
}

const EMAIL_CONNECTORS = [
  { id: "gmail",      name: "Gmail",       logo: "/logos/email/gmail.png",   description: "Google account",              oauthPath: "/api/auth/google/connect"    },
  { id: "outlook",    name: "Outlook",     logo: "/logos/email/outlook.png", description: "Microsoft 365 & Outlook.com", oauthPath: "/api/auth/microsoft/connect"  },
  { id: "icloud",     name: "iCloud Mail", logo: "/logos/email/icloud.png",  description: "Apple iCloud — coming soon",  oauthPath: null                           },
  { id: "yahoo",      name: "Yahoo Mail",  logo: "/logos/email/yahoo.png",   description: "Yahoo — coming soon",         oauthPath: null                           },
  { id: "protonmail", name: "ProtonMail",  logo: "/logos/email/proton.png",  description: "ProtonMail — coming soon",    oauthPath: null                           },
];

function ConnectorCard({ connector, connected, connectedAccount, session, onDisconnect }: {
  connector: typeof EMAIL_CONNECTORS[0];
  connected: boolean;
  connectedAccount?: ConnectedAccount;
  session: Session | null;
  onDisconnect: (id: string) => void;
}) {
  const handleConnect = () => {
    if (!connector.oauthPath) { toast.info(`${connector.name} — coming soon`); return; }
    if (!session?.access_token) { toast.error("Please sign in first"); return; }
    window.location.href = `${connector.oauthPath}?token=${encodeURIComponent(session.access_token)}&redirect_to=/email`;
  };
  return (
    <motion.div whileHover={{ y: -1 }}
      className="flex items-center gap-4 p-4 rounded-2xl border transition-colors duration-150"
      style={{ background: "var(--background-elevated)", borderColor: connected ? "rgba(255,255,255,0.25)" : "#38383A" }}>
      <img src={connector.logo} alt={connector.name} width={28} height={28} className="object-contain shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{connector.name}</div>
        <div className="text-xs text-[var(--foreground-secondary)] truncate">
          {connected && connectedAccount?.account_email ? connectedAccount.account_email : connector.description}
        </div>
      </div>
      {connected ? (
        <div className="flex items-center gap-2 shrink-0">
          {connectedAccount?.decrypted === false ? (
            <button onClick={handleConnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium animate-pulse"
              style={{ background: "rgba(255,159,10,0.15)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.3)" }}>
              <ExternalLink className="w-3 h-3" />Reconnect
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "#30D15820", color: "#30D158", border: "1px solid #30D15830" }}>
              <Check className="w-3 h-3" />Connected
            </div>
          )}
          <button onClick={() => onDisconnect(connector.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,59,48,0.1)", color: "#FF3B30" }} title="Disconnect">
            <Unlink className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={handleConnect}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-opacity"
          style={{ background: connector.oauthPath ? "var(--foreground)" : "#38383A", color: connector.oauthPath ? "#FFFFFF" : "#8E8E93" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}>
          {connector.oauthPath && <ExternalLink className="w-3 h-3" />}
          {connector.oauthPath ? "Connect" : "Soon"}
        </button>
      )}
    </motion.div>
  );
}

export default function EmailPage() {
  const { user, session, refresh: refreshAuth } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [loading, setLoading] = useState(true);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isEmailViewModalOpen, setIsEmailViewModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [topic, setTopic] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState("Professional");
  const [generatedEmailPreview, setGeneratedEmailPreview] = useState<Email | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("emails").select("*")
        .eq("user_id", user?.id).order("created_at", { ascending: false });
      if (error) throw error;
      setEmails(data || []);
    } catch (err) { console.error(err); }
    finally { if (activeTab === "sent") setLoading(false); }
  }, [user, activeTab]);

  const fetchInbox = useCallback(async (token: string) => {
    setLoadingInbox(true);
    try {
      const res = await fetch("/api/emails/inbox", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setInbox(data.messages || []);
      } else if (data.code === "NOT_CONNECTED") {
        setInbox([]);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingInbox(false); setLoading(false); }
  }, []);

  const fetchConnected = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/connectors", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setConnectedAccounts((data.accounts || []).filter((a: ConnectedAccount) =>
        ["gmail", "outlook", "icloud", "yahoo", "protonmail"].includes(a.provider)));
    } catch (err) { console.error(err); }
  }, []);

  const init = useCallback(async () => {
    if (!session?.access_token) {
      if (loading) setLoading(false);
      return;
    }
    const token = session.access_token;
    if (user) {
      fetchEmails();
      fetchConnected(token);
      fetchInbox(token);
    }
  }, [session, user, fetchEmails, fetchConnected, fetchInbox, loading]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected) {
      toast.success(`${connected} connected successfully!`);
      refreshAuth().then(() => init());
    }
    if (error) {
      if (error === "config_missing") {
        const provider = params.get("provider") || "this provider";
        toast.error(`Configuration missing: Please set ${provider.toUpperCase()}_CLIENT_ID & SECRET in your Vercel env.`, { duration: 6000 });
      } else {
        toast.error(`Connection failed: ${decodeURIComponent(error)}`);
      }
    }
    if (connected || error) window.history.replaceState({}, "", "/email");
  }, [init, refreshAuth]);

  const handleDisconnect = async (id: string) => {
    if (!session?.access_token) return;
    try {
      await fetch(`/api/connectors?provider=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      setConnectedAccounts(prev => prev.filter(a => a.provider !== id));
      toast.success(`${id} disconnected`);
    } catch { toast.error("Failed to disconnect"); }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !recipient || !session?.access_token || !user) return;
    setGenerating(true); setGeneratedEmailPreview(null);
    try {
      const res = await fetch("/api/agent/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ topic, recipient, tone, user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setGeneratedEmailPreview(data.email);
      setEmails(prev => [data.email, ...prev]);
      toast.success("AI draft ready");
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const handleSendDraft = async (id: string) => {
    if (!session?.access_token) return;
    setSending(true);
    try {
      const res = await fetch("/api/actions/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success(data.message || "Email sent!");
      setIsComposeModalOpen(false); setIsEmailViewModalOpen(false);
      fetchEmails();
    } catch (err: any) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const handleDiscardDraft = async (id: string) => {
    if (!session?.access_token) return;
    try {
      const supabase = createClient();
      await supabase.from("emails").delete().eq("id", id);
      toast.success("Draft discarded");
      setIsComposeModalOpen(false); setGeneratedEmailPreview(null); fetchEmails();
    } catch { toast.error("Failed to discard"); }
  };

  const openEmail = (email: Email) => { setSelectedEmail(email); setIsEmailViewModalOpen(true); };
  const hasMailConnected = connectedAccounts.some(a => ["gmail", "outlook"].includes(a.provider));

  const StatusBadge = ({ status }: { status: string }) => {
    const c: Record<string, string> = { sent: "bg-emerald-500", draft: "bg-[#555555]", pending: "bg-yellow-500" };
    return <div className={`h-2 w-2 rounded-full ${c[status] || "bg-[#555555]"}`} />;
  };

  if (loading) return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto p-6">
        <div className="h-7 w-48 shimmer rounded-lg mb-2" />
        <div className="h-4 w-64 shimmer rounded mb-8" />
        <div className="h-[240px] rounded-2xl shimmer" />
      </div>
    </PageTransition>
  );

  return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto p-6 md:p-8">
        {/* Header */}
        <motion.div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Email Autopilot</h1>
            <p className="text-sm text-[var(--foreground-secondary)]">
              {hasMailConnected ? "Emails sent directly from your connected inbox" : "Connect Gmail or Outlook to send emails"}
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="self-start sm:self-auto">
            <Button onClick={() => { setTopic(""); setRecipient(""); setTone("Professional"); setGeneratedEmailPreview(null); setIsComposeModalOpen(true); }}
              className="rounded-lg h-10 px-4 text-sm font-medium border-0" style={{ background: "var(--foreground)", color: "var(--foreground)" }}>
              <Plus className="h-4 w-4 mr-2" />Compose with AI
            </Button>
          </motion.div>
        </motion.div>

        {/* Connectors Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {EMAIL_CONNECTORS.map((connector) => {
            const connectedAccount = connectedAccounts.find(a => a.provider === connector.id);
            return (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                connected={!!connectedAccount}
                connectedAccount={connectedAccount}
                session={session}
                onDisconnect={handleDisconnect}
              />
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 mb-6 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`pb-4 px-2 text-sm font-semibold transition-all relative ${
              activeTab === "inbox" ? "text-white" : "text-[var(--foreground-secondary)] hover:text-white"
            }`}
          >
            Live Inbox
            {activeTab === "inbox" && (
              <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`pb-4 px-2 text-sm font-semibold transition-all relative ${
              activeTab === "sent" ? "text-white" : "text-[var(--foreground-secondary)] hover:text-white"
            }`}
          >
            Sent & Drafts
            {activeTab === "sent" && (
              <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </button>
        </div>

        {/* Email list */}
        {activeTab === "inbox" ? (
          loadingInbox ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#1C1C1E] border border-[var(--border)] rounded-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--foreground-secondary)] mb-4" />
              <p className="text-sm text-[var(--foreground-secondary)]">Syncing with Gmail...</p>
            </div>
          ) : inbox.length === 0 ? (
            <motion.div className="flex flex-col items-center justify-center py-28 text-center border border-[var(--border)] rounded-2xl"
              style={{ background: "var(--background-elevated)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Mail className="h-10 w-10 text-[var(--border-strong)] mb-4" />
              <h3 className="text-base font-semibold text-white mb-1.5">No unread emails</h3>
              <p className="text-sm text-[var(--foreground-secondary)] mb-6 max-w-sm">
                {!connectedAccounts.some(a => a.provider === "gmail")
                  ? "Connect Gmail to see your live messages here."
                  : "You're all caught up! No unread messages in your inbox."}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {inbox.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl border border-[var(--border)] bg-[#242426] hover:bg-[#2C2C2E] transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="text-xs font-bold text-[#0A84FF] uppercase tracking-tighter">New from {msg.from.split("<")[0].trim()}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">{msg.subject}</h3>
                      <p className="text-xs text-[var(--foreground-secondary)] line-clamp-1">{msg.snippet}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <span className="text-[10px] text-[var(--foreground-tertiary)] font-medium">GMAIL LIVE</span>
                       <Button size="sm" className="h-7 text-[10px] bg-[#2C2C2E] text-white hover:bg-white hover:text-black border border-white/5">Reply with AI</Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          emails.length === 0 ? (
            <motion.div className="flex flex-col items-center justify-center py-28 text-center border border-[var(--border)] rounded-2xl"
              style={{ background: "var(--background-elevated)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <Mail className="h-6 w-6 text-[var(--foreground)]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">No emails yet</h3>
              <p className="text-sm text-[var(--foreground-secondary)] mb-6 max-w-sm">Connect Gmail or Outlook, then let AI draft and send emails on your behalf.</p>
              <Button onClick={() => setIsComposeModalOpen(true)} className="rounded-xl px-5 h-10 text-sm font-semibold border-0"
                style={{ background: "var(--foreground)", color: "var(--foreground)" }}>
                <Plus className="h-4 w-4 mr-2" />Compose with AI
              </Button>
            </motion.div>
          ) : (
            <motion.div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider" style={{ borderColor: "var(--border)" }}>
                      <th className="px-6 py-4 font-medium">Recipient</th>
                      <th className="px-6 py-4 font-medium">Subject</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <AnimatePresence>
                      {emails.map((email) => (
                        <tr key={email.id} onClick={() => openEmail(email)} className="group cursor-pointer transition-colors"
                          style={{ background: "transparent" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#2C2C2E"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white"
                                style={{ background: "var(--border)" }}>{email.recipient.charAt(0).toUpperCase()}</div>
                              <span className="text-sm font-medium text-white truncate max-w-[200px]">{email.recipient}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4"><span className="text-sm text-[var(--foreground-secondary)] truncate max-w-[400px] block">{email.subject}</span></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={email.status} />
                              <span className="text-xs capitalize text-[var(--foreground-secondary)]">{email.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[var(--foreground-tertiary)] whitespace-nowrap">{formatTimeAgo(new Date(email.created_at))}</td>
                        </tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </motion.div>
          )
        )}
      </div>

      {/* Compose Modal */}
      <Dialog open={isComposeModalOpen} onOpenChange={setIsComposeModalOpen}>
        <DialogContent className="border text-white sm:max-w-xl" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <DialogHeader><DialogTitle className="text-white">Compose Email with AI</DialogTitle></DialogHeader>
          {!generatedEmailPreview ? (
            <form onSubmit={handleGenerate} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Recipient</Label>
                  <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="investors@example.com"
                    className="text-white placeholder:text-[var(--border-strong)] focus-visible:ring-[var(--foreground)]"
                    style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }} required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Tone</Label>
                  <Select value={tone} onValueChange={(v) => v && setTone(v)}>
                    <SelectTrigger style={{ background: "var(--background-overlay)", border: "1px solid var(--border)", color: "white" }}><SelectValue /></SelectTrigger>
                    <SelectContent style={{ background: "var(--background)", border: "1px solid var(--border)", color: "white" }}>
                      {["Professional", "Friendly", "Formal", "Casual", "Persuasive"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Topic</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What is this email about?"
                  className="text-white placeholder:text-[var(--border-strong)] focus-visible:ring-[var(--foreground)]"
                  style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }} required />
              </div>
              {!hasMailConnected && (
                <div className="px-3 py-2.5 rounded-xl text-xs text-[#FF9F0A]"
                  style={{ background: "rgba(255,159,10,0.08)", border: "1px solid rgba(255,159,10,0.2)" }}>
                  Connect Gmail or Outlook above to send emails from your inbox.
                </div>
              )}
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={generating} className="w-full font-semibold rounded-xl border-0" style={{ background: "var(--foreground)", color: "var(--foreground)" }}>
                  {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : "Generate Email"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="pt-6 space-y-6">
              <div className="rounded-xl overflow-hidden border" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                <div className="border-b px-4 py-3" style={{ background: "var(--background-overlay)", borderColor: "var(--border)" }}>
                  <p className="text-sm text-[var(--foreground-secondary)] mb-1"><span className="text-[var(--foreground-tertiary)]">To:</span> {generatedEmailPreview.recipient}</p>
                  <p className="text-sm text-white font-medium"><span className="text-[var(--foreground-tertiary)] font-normal mr-2">Subject:</span>{generatedEmailPreview.subject}</p>
                </div>
                <div className="p-4"><p className="text-sm text-[var(--foreground-secondary)] whitespace-pre-wrap leading-relaxed">{generatedEmailPreview.body}</p></div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => handleSendDraft(generatedEmailPreview.id)} disabled={sending}
                  className="flex-1 border-0" style={{ background: "var(--foreground)", color: "var(--foreground)" }}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {hasMailConnected ? "Send via Inbox" : "Mark as Sent"}
                </Button>
                <Button onClick={() => handleDiscardDraft(generatedEmailPreview.id)} variant="outline"
                  className="flex-1 border text-red-400 hover:text-red-400" style={{ background: "transparent", borderColor: "var(--border)" }}>
                  <Trash2 className="h-4 w-4 mr-2" />Discard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Email Modal */}
      <Dialog open={isEmailViewModalOpen} onOpenChange={setIsEmailViewModalOpen}>
        <DialogContent className="border text-white sm:max-w-2xl p-0 overflow-hidden" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          {selectedEmail && (
            <div className="flex flex-col">
              <div className="border-b px-8 py-6" style={{ borderColor: "var(--border)" }}>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-white">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full border" style={{ background: "var(--background-overlay)", borderColor: "var(--border)" }}>
                    <StatusBadge status={selectedEmail.status} />
                    <span className="text-xs uppercase font-medium tracking-wide text-[var(--foreground-secondary)]">{selectedEmail.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-white font-medium" style={{ background: "var(--border)" }}>
                    {selectedEmail.recipient.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{selectedEmail.recipient}</p>
                    <p className="text-xs text-[var(--foreground-tertiary)]">{formatTimeAgo(new Date(selectedEmail.created_at))} · {new Date(selectedEmail.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
              <div className="p-8"><p className="text-sm text-[var(--foreground-secondary)] whitespace-pre-wrap leading-relaxed">{selectedEmail.body}</p></div>
              {selectedEmail.status === "draft" && (
                <div className="border-t p-4 flex justify-end gap-3" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                  <Button onClick={() => { handleDiscardDraft(selectedEmail.id); setIsEmailViewModalOpen(false); }}
                    variant="outline" className="border text-red-400" style={{ background: "transparent", borderColor: "var(--border)" }}>
                    <Trash2 className="h-4 w-4 mr-2" />Discard
                  </Button>
                  <Button onClick={() => handleSendDraft(selectedEmail.id)} disabled={sending}
                    className="border-0" style={{ background: "var(--foreground)", color: "var(--foreground)" }}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {hasMailConnected ? "Send via Inbox" : "Mark as Sent"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
