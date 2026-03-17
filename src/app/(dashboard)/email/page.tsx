"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Loader2, Send, Trash2, Plus, Check } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Image from "next/image";

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: "sent" | "draft" | "pending";
  created_at: string;
}

const EMAIL_CONNECTORS = [
  { id: "gmail",      name: "Gmail",       logo: "/logos/email/gmail.png",   description: "Connect your Google account",  lightBg: true  },
  { id: "outlook",    name: "Outlook",     logo: "/logos/email/outlook.png", description: "Microsoft 365 & Outlook.com",  lightBg: true  },
  { id: "icloud",     name: "iCloud Mail", logo: "/logos/email/icloud.png",  description: "Apple iCloud email",           lightBg: false },
  { id: "yahoo",      name: "Yahoo Mail",  logo: "/logos/email/yahoo.png",   description: "Yahoo email account",          lightBg: false },
  { id: "protonmail", name: "ProtonMail",  logo: "/logos/email/proton.png",  description: "End-to-end encrypted mail",    lightBg: false },
];

function ConnectorCard({ connector, connected, onConnect }: {
  connector: typeof EMAIL_CONNECTORS[0];
  connected: boolean;
  onConnect: (id: string) => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="flex items-center gap-4 p-4 rounded-2xl border transition-colors duration-150"
      style={{ background: "#242426", borderColor: connected ? "#007AFF40" : "#38383A" }}
    >
      <img
        src={connector.logo}
        alt={connector.name}
        width={28}
        height={28}
        className="object-contain shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{connector.name}</div>
        <div className="text-xs text-[#8E8E93]">{connector.description}</div>
      </div>
      {connected ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
          style={{ background: "#30D15820", color: "#30D158", border: "1px solid #30D15830" }}>
          <Check className="w-3 h-3" />
          Connected
        </div>
      ) : (
        <button
          onClick={() => onConnect(connector.id)}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150"
          style={{ background: "#007AFF", color: "#FFFFFF" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          Connect
        </button>
      )}
    </motion.div>
  );
}

export default function EmailPage() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isEmailViewModalOpen, setIsEmailViewModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState("Professional");

  const [generatedEmailPreview, setGeneratedEmailPreview] = useState<Email | null>(null);

  const fetchEmails = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEmails(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAccessToken(session.access_token);
        if (user) fetchEmails();
      } else {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const handleConnect = (id: string) => {
    toast.info("Email OAuth coming soon — connector UI is ready.");
    setConnectedProviders(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !recipient || !accessToken || !user) return;
    setGenerating(true);
    setGeneratedEmailPreview(null);
    try {
      const res = await fetch("/api/agent/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ topic, recipient, tone, user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setGeneratedEmailPreview(data.email);
      setEmails([data.email, ...emails]);
      toast.success("AI draft generated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendDraft = async (id: string) => {
    if (!accessToken) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("emails").update({ status: "sent" }).eq("id", id);
      if (error) throw error;
      toast.success("Email sent!");
      setIsComposeModalOpen(false);
      setIsEmailViewModalOpen(false);
      fetchEmails();
    } catch {
      toast.error("Failed to send email");
    }
  };

  const handleDiscardDraft = async (id: string) => {
    if (!accessToken) return;
    try {
      const supabase = createClient();
      await supabase.from("emails").delete().eq("id", id);
      toast.success("Draft discarded");
      setIsComposeModalOpen(false);
      setGeneratedEmailPreview(null);
      fetchEmails();
    } catch {
      toast.error("Failed to discard");
    }
  };

  const openEmail = (email: Email) => {
    setSelectedEmail(email);
    setIsEmailViewModalOpen(true);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === "sent") return <div className="h-2 w-2 rounded-full bg-emerald-500" title="Sent" />;
    if (status === "draft") return <div className="h-2 w-2 rounded-full bg-[#555555]" title="Draft" />;
    if (status === "pending") return <div className="h-2 w-2 rounded-full bg-yellow-500" title="Pending" />;
    return null;
  };

  if (loading) {
    return (
      <PageTransition>
        <div>
          <div className="h-7 w-48 shimmer rounded-lg mb-2" />
          <div className="h-4 w-64 shimmer rounded mb-8" />
          <div className="h-[240px] rounded-2xl shimmer" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Email Autopilot</h1>
            <p className="text-sm text-[#8E8E93]">Emails drafted and sent by your AI</p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => {
                setTopic(""); setRecipient(""); setTone("Professional");
                setGeneratedEmailPreview(null); setIsComposeModalOpen(true);
              }}
              className="rounded-lg h-10 px-4 text-sm font-medium border-0"
              style={{ background: "#007AFF", color: "#FFFFFF" }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Compose with AI
            </Button>
          </motion.div>
        </motion.div>

        {/* Email Connectors */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl border p-5 mb-8"
          style={{ background: "#1C1C1E", borderColor: "#38383A" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Connect Email Accounts</h2>
              <p className="text-xs text-[#8E8E93] mt-0.5">Link your inbox so Inceptive can send on your behalf</p>
            </div>
            {connectedProviders.length > 0 && (
              <span className="text-xs text-[#30D158] font-medium">{connectedProviders.length} connected</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EMAIL_CONNECTORS.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <ConnectorCard
                  connector={c}
                  connected={connectedProviders.includes(c.id)}
                  onConnect={handleConnect}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Email list */}
        {emails.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-28 text-center border border-[#38383A] rounded-2xl"
            style={{ background: "#242426" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
              style={{ background: "#007AFF15", border: "1px solid #007AFF30" }}>
              <Mail className="h-6 w-6 text-[#007AFF]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">No emails yet</h3>
            <p className="text-sm text-[#8E8E93] mb-6 max-w-sm">
              Inceptive will draft and send emails on your behalf.
            </p>
            <Button
              onClick={() => setIsComposeModalOpen(true)}
              className="rounded-xl px-5 h-10 text-sm font-semibold border-0"
              style={{ background: "#007AFF", color: "#FFFFFF" }}
            >
              <Plus className="h-4 w-4 mr-2" /> Compose with AI
            </Button>
          </motion.div>
        ) : (
          <motion.div
            className="rounded-2xl border overflow-hidden"
            style={{ background: "#242426", borderColor: "#38383A" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-xs font-semibold text-[#8E8E93] uppercase tracking-wider" style={{ borderColor: "#38383A" }}>
                    <th className="px-6 py-4 font-medium">Recipient</th>
                    <th className="px-6 py-4 font-medium">Subject</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#38383A]">
                  {emails.map((email) => (
                    <tr
                      key={email.id}
                      onClick={() => openEmail(email)}
                      className="group cursor-pointer transition-colors"
                      style={{ background: "transparent" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#2C2C2E"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white"
                            style={{ background: "#38383A" }}>
                            {email.recipient.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-white truncate max-w-[200px]">{email.recipient}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#8E8E93] truncate max-w-[400px] block">{email.subject}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={email.status} />
                          <span className="text-xs capitalize text-[#8E8E93]">{email.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#636366] whitespace-nowrap">
                        {new Date(email.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Compose AI Modal */}
      <Dialog open={isComposeModalOpen} onOpenChange={setIsComposeModalOpen}>
        <DialogContent className="border text-white sm:max-w-xl" style={{ background: "#1C1C1E", borderColor: "#38383A" }}>
          <DialogHeader>
            <DialogTitle className="text-white">Compose Email with AI</DialogTitle>
          </DialogHeader>
          {!generatedEmailPreview ? (
            <form onSubmit={handleGenerate} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8E8E93] text-xs uppercase tracking-wide">Recipient</Label>
                  <Input value={recipient} onChange={e => setRecipient(e.target.value)}
                    placeholder="investors@example.com"
                    className="text-white placeholder:text-[#48484A] focus-visible:ring-[#007AFF]"
                    style={{ background: "#2A2A2C", border: "1px solid #38383A" }} required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8E8E93] text-xs uppercase tracking-wide">Tone</Label>
                  <Select value={tone} onValueChange={(v) => v && setTone(v)}>
                    <SelectTrigger style={{ background: "#2A2A2C", border: "1px solid #38383A", color: "white" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: "#1C1C1E", border: "1px solid #38383A", color: "white" }}>
                      <SelectItem value="Professional">Professional</SelectItem>
                      <SelectItem value="Friendly">Friendly</SelectItem>
                      <SelectItem value="Formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8E8E93] text-xs uppercase tracking-wide">Topic</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="What is this email about?"
                  className="text-white placeholder:text-[#48484A] focus-visible:ring-[#007AFF]"
                  style={{ background: "#2A2A2C", border: "1px solid #38383A" }} required />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={generating}
                  className="w-full font-semibold rounded-xl border-0"
                  style={{ background: "#007AFF", color: "#FFFFFF" }}>
                  {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating Draft…</> : "Generate Email"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="pt-6 space-y-6">
              <div className="rounded-xl overflow-hidden border" style={{ background: "#242426", borderColor: "#38383A" }}>
                <div className="border-b px-4 py-3" style={{ background: "#2A2A2C", borderColor: "#38383A" }}>
                  <p className="text-sm text-[#8E8E93] mb-1"><span className="text-[#636366]">To:</span> {generatedEmailPreview.recipient}</p>
                  <p className="text-sm text-white font-medium"><span className="text-[#636366] font-normal mr-2">Subject:</span>{generatedEmailPreview.subject}</p>
                </div>
                <div className="p-4">
                  <p className="text-sm text-[#8E8E93] whitespace-pre-wrap leading-relaxed">{generatedEmailPreview.body}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => handleSendDraft(generatedEmailPreview.id)}
                  className="flex-1 border-0" style={{ background: "#007AFF", color: "#FFFFFF" }}>
                  <Send className="h-4 w-4 mr-2" /> Send Now
                </Button>
                <Button onClick={() => handleDiscardDraft(generatedEmailPreview.id)} variant="outline"
                  className="flex-1 border text-red-400 hover:text-red-400"
                  style={{ background: "transparent", borderColor: "#38383A" }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Discard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Email Modal */}
      <Dialog open={isEmailViewModalOpen} onOpenChange={setIsEmailViewModalOpen}>
        <DialogContent className="border text-white sm:max-w-2xl p-0 overflow-hidden" style={{ background: "#1C1C1E", borderColor: "#38383A" }}>
          {selectedEmail && (
            <div className="flex flex-col">
              <div className="border-b px-8 py-6" style={{ borderColor: "#38383A" }}>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-white">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full border" style={{ background: "#2A2A2C", borderColor: "#38383A" }}>
                    <StatusBadge status={selectedEmail.status} />
                    <span className="text-xs uppercase font-medium tracking-wide text-[#8E8E93]">{selectedEmail.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-white font-medium" style={{ background: "#38383A" }}>
                    {selectedEmail.recipient.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{selectedEmail.recipient}</p>
                    <p className="text-xs text-[#636366]">{formatTimeAgo(new Date(selectedEmail.created_at))} · {new Date(selectedEmail.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
              <div className="p-8">
                <p className="text-sm text-[#8E8E93] whitespace-pre-wrap leading-relaxed">{selectedEmail.body}</p>
              </div>
              {selectedEmail.status === "draft" && (
                <div className="border-t p-4 flex justify-end gap-3" style={{ background: "#242426", borderColor: "#38383A" }}>
                  <Button onClick={() => { handleDiscardDraft(selectedEmail.id); setIsEmailViewModalOpen(false); }}
                    variant="outline" className="border text-red-400"
                    style={{ background: "transparent", borderColor: "#38383A" }}>
                    <Trash2 className="h-4 w-4 mr-2" /> Discard
                  </Button>
                  <Button onClick={() => handleSendDraft(selectedEmail.id)}
                    className="border-0" style={{ background: "#007AFF", color: "#FFFFFF" }}>
                    <Send className="h-4 w-4 mr-2" /> Send Email
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
