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
import { Mail, Loader2, Send, Trash2, Plus, ArrowRight } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: "sent" | "draft" | "pending";
  created_at: string;
}

export default function EmailPage() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

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
        .from('emails')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !recipient || !accessToken || !user) return;

    setGenerating(true);
    setGeneratedEmailPreview(null);
    try {
      const res = await fetch("/api/agent/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ topic, recipient, tone, user_id: user.id })
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
      // Typically via a real SMTP or Resend API, here we just mark as sent
      const supabase = createClient();
      const { error } = await supabase
        .from('emails')
        .update({ status: 'sent' })
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success("Email sent!");
      setIsComposeModalOpen(false);
      setIsEmailViewModalOpen(false);
      fetchEmails();
    } catch (err) {
      toast.error("Failed to send email");
    }
  };

  const handleDiscardDraft = async (id: string) => {
    if (!accessToken) return;
    try {
      const supabase = createClient();
      await supabase.from('emails').delete().eq('id', id);
      toast.success("Draft discarded");
      setIsComposeModalOpen(false);
      setGeneratedEmailPreview(null);
      fetchEmails();
    } catch (err) {
      toast.error("Failed to discard");
    }
  };

  const openEmail = (email: Email) => {
    setSelectedEmail(email);
    setIsEmailViewModalOpen(true);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'sent') return <div className="h-2 w-2 rounded-full bg-emerald-500" title="Sent" />;
    if (status === 'draft') return <div className="h-2 w-2 rounded-full bg-[#555555]" title="Draft" />;
    if (status === 'pending') return <div className="h-2 w-2 rounded-full bg-yellow-500" title="Pending" />;
    return null;
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Email Autopilot</h1>
            <p className="text-sm text-[#888888]">Emails drafted and sent by your AI</p>
          </div>
          <Button disabled className="bg-white text-black h-10 px-4">
            <Plus className="h-4 w-4 mr-2" /> Compose with AI
          </Button>
        </div>
        <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] overflow-hidden">
          {[1,2,3].map(i => (
             <div key={i} className="h-[72px] border-b border-[#1F1F1F] skeleton" />
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Email Autopilot</h1>
            <p className="text-sm text-[#888888]">Emails drafted and sent by your AI</p>
          </div>
          <Button 
            onClick={() => {
              setTopic("");
              setRecipient("");
              setTone("Professional");
              setGeneratedEmailPreview(null);
              setIsComposeModalOpen(true);
            }} 
            className="bg-white text-black hover:bg-white/90 rounded-lg h-10 px-4 text-sm font-medium transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Compose with AI
          </Button>
        </div>

        {emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center border border-[#1F1F1F] rounded-xl bg-[#0D0D0D]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#111111] border border-[#333333] mb-6">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No emails yet</h3>
            <p className="text-[#888888] mb-6 max-w-sm">
              Inceptive will draft and send emails on your behalf overnight.
            </p>
            <Button 
              onClick={() => setIsComposeModalOpen(true)}
              className="bg-white text-black hover:bg-white/90"
            >
              <Plus className="h-4 w-4 mr-2" /> Compose with AI
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-xs font-semibold text-[#555555] uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Recipient</th>
                    <th className="px-6 py-4 font-medium">Subject</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1F1F]">
                  {emails.map((email) => (
                    <tr 
                      key={email.id}
                      onClick={() => openEmail(email)}
                      className="group cursor-pointer hover:bg-[#111111] transition-colors"
                    >
                      <td className="px-6 py-4 pointer-events-none">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F1F1F] text-sm font-medium text-white group-hover:bg-[#333] transition-colors">
                            {email.recipient.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-white truncate max-w-[200px]">
                            {email.recipient}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 pointer-events-none">
                        <span className="text-sm text-[#888888] truncate max-w-[400px] block group-hover:text-white transition-colors">
                          {email.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4 pointer-events-none">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={email.status} />
                          <span className="text-xs capitalize text-[#888]">{email.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#555555] pointer-events-none whitespace-nowrap">
                        {new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Compose AI Modal */}
      <Dialog open={isComposeModalOpen} onOpenChange={setIsComposeModalOpen}>
        <DialogContent className="bg-[#050505] border-[#1F1F1F] text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Compose Email with AI</DialogTitle>
          </DialogHeader>
          
          {!generatedEmailPreview ? (
            <form onSubmit={handleGenerate} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recipient (Name or Email)</Label>
                  <Input 
                    value={recipient} 
                    onChange={e => setRecipient(e.target.value)} 
                    placeholder="E.g. investors@example.com"
                    className="bg-[#111111] border-[#333333] text-white focus:border-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={(v) => v && setTone(v)}>
                    <SelectTrigger className="bg-[#111111] border-[#333333] text-white focus:border-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0D0D0D] border-[#333333] text-white">
                      <SelectItem value="Professional" className="hover:bg-[#111] focus:bg-[#111]">Professional</SelectItem>
                      <SelectItem value="Friendly" className="hover:bg-[#111] focus:bg-[#111]">Friendly</SelectItem>
                      <SelectItem value="Formal" className="hover:bg-[#111] focus:bg-[#111]">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Topic</Label>
                <Input 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)} 
                  placeholder="What is this email about?"
                  className="bg-[#111111] border-[#333333] text-white focus:border-white"
                  required
                />
              </div>
              
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={generating} className="bg-white text-black hover:bg-white/90 w-full">
                  {generating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating Draft...</>
                  ) : (
                    "Generate Email Outline"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="pt-6 space-y-6">
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl overflow-hidden">
                <div className="border-b border-[#1F1F1F] px-4 py-3 bg-[#111111]">
                  <p className="text-sm text-[#888888] mb-1">
                    <span className="text-[#555]">To:</span> {generatedEmailPreview.recipient}
                  </p>
                  <p className="text-sm text-white font-medium">
                    <span className="text-[#555] font-normal mr-2">Subject:</span>
                    {generatedEmailPreview.subject}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-sm text-[#888888] whitespace-pre-wrap leading-relaxed">
                    {generatedEmailPreview.body}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => handleSendDraft(generatedEmailPreview.id)}
                  className="flex-1 bg-white text-black hover:bg-white/90"
                >
                  <Send className="h-4 w-4 mr-2" /> Send Now
                </Button>
                <Button 
                  onClick={() => handleDiscardDraft(generatedEmailPreview.id)}
                  variant="outline"
                  className="flex-1 bg-transparent border-[#333333] text-[#EF4444] hover:bg-[#111111] hover:text-[#EF4444]"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Discard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Email Modal */}
      <Dialog open={isEmailViewModalOpen} onOpenChange={setIsEmailViewModalOpen}>
        <DialogContent className="bg-[#050505] border-[#1F1F1F] text-white sm:max-w-2xl p-0 overflow-hidden">
          {selectedEmail && (
            <div className="flex flex-col">
              <div className="border-b border-[#1F1F1F] px-8 py-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-white">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#111] rounded-full border border-[#1F1F1F]">
                    <StatusBadge status={selectedEmail.status} />
                    <span className="text-xs uppercase font-medium tracking-wide text-[#888]">{selectedEmail.status}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1F1F] text-white font-medium">
                    {selectedEmail.recipient.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{selectedEmail.recipient}</p>
                    <p className="text-xs text-[#555555]">{formatTimeAgo(new Date(selectedEmail.created_at))} • {new Date(selectedEmail.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <p className="text-sm text-[#888888] whitespace-pre-wrap leading-relaxed">
                  {selectedEmail.body}
                </p>
              </div>

              {selectedEmail.status === 'draft' && (
                <div className="border-t border-[#1F1F1F] p-4 bg-[#0D0D0D] flex justify-end gap-3">
                  <Button 
                    onClick={() => {
                      handleDiscardDraft(selectedEmail.id);
                      setIsEmailViewModalOpen(false);
                    }}
                    variant="outline"
                    className="bg-transparent border-[#333333] text-[#EF4444] hover:bg-[#111111] hover:text-[#EF4444]"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Discard Draft
                  </Button>
                  <Button 
                    onClick={() => handleSendDraft(selectedEmail.id)}
                    className="bg-white text-black hover:bg-white/90"
                  >
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
