"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingTable } from "@/components/ui/loading-skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Email } from "@/types/database";
import { Mail } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: "bg-[#1F1F1F] text-white",
    draft: "bg-[#111111] text-[#888888] border border-[#333333]",
    pending: "bg-[#111111] text-[#888888] border border-[#333333]",
  };

  return (
    <span
      className={`text-[10px] font-medium uppercase px-2.5 py-1 rounded-full ${
        styles[status] || styles.draft
      }`}
    >
      {status}
    </span>
  );
}

function AvatarCircle({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1F1F] text-xs font-medium text-white shrink-0">
      {initials || "??"}
    </div>
  );
}

export default function EmailPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchEmails = async () => {
      const { data } = await supabase
        .from("emails")
        .select("*")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false });

      setEmails((data as Email[]) || []);
      setLoading(false);
    };

    fetchEmails();
  }, [user, supabase]);

  if (loading) {
    return (
      <PageTransition>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Email Autopilot</h1>
          <p className="text-sm text-[#888888] mb-6">
            Emails drafted and sent by your AI overnight
          </p>
          <LoadingTable />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Email Autopilot</h1>
        <p className="text-sm text-[#888888] mb-6">
          Emails drafted and sent by your AI overnight
        </p>

        {emails.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No emails yet"
            description="Your AI agent will draft and send emails here automatically while you sleep."
          />
        ) : (
          <div className="space-y-2">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className="w-full flex items-center gap-4 rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-4 text-left transition-all duration-200 hover:border-[#333333] hover:bg-[#111111]"
              >
                <AvatarCircle name={email.recipient} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {email.recipient}
                  </p>
                  <p className="text-xs text-[#888888] truncate">
                    {email.subject}
                  </p>
                </div>
                <span className="text-xs text-[#555555] shrink-0">
                  {email.sent_at
                    ? new Date(email.sent_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "—"}
                </span>
                <StatusBadge status={email.status} />
              </button>
            ))}
          </div>
        )}

        {/* Email detail modal */}
        <Dialog
          open={!!selectedEmail}
          onOpenChange={() => setSelectedEmail(null)}
        >
          <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F] text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedEmail?.subject}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <AvatarCircle name={selectedEmail?.recipient || ""} />
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedEmail?.recipient}
                  </p>
                  <p className="text-xs text-[#555555]">
                    {selectedEmail?.sent_at
                      ? new Date(selectedEmail.sent_at).toLocaleString()
                      : "Not sent"}
                  </p>
                </div>
                <div className="ml-auto">
                  <StatusBadge status={selectedEmail?.status || "draft"} />
                </div>
              </div>
              <div className="border-t border-[#1F1F1F] pt-4">
                <p className="text-sm text-[#888888] leading-relaxed whitespace-pre-wrap">
                  {selectedEmail?.body}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
