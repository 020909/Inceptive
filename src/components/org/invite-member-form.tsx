"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { inviteMember } from "@/lib/supabase/org-browser";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteMemberFormProps {
  orgId: string;
  orgSlug: string;
  embedded?: boolean;
  onInvited?: () => void;
}

export function InviteMemberForm({
  orgId,
  orgSlug,
  embedded = false,
  onInvited,
}: InviteMemberFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      setError("You need to be signed in to invite a member.");
      return;
    }

    if (!email.trim()) {
      setError("Enter an email address to send an invite.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await inviteMember(orgId, email, user.id, createClient());
      const normalizedEmail = email.trim().toLowerCase();
      setEmail("");
      setSuccess(`Saved a pending invite for ${normalizedEmail}.`);
      onInvited?.();
      router.refresh();
      if (!embedded) {
        router.replace(`/org/${orgSlug}/invite?success=${encodeURIComponent(normalizedEmail)}`);
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to save invite.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-email" className="text-[var(--fg-primary)]">
          Member Email
        </Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@company.com"
          className="h-11 rounded-xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-[var(--fg-primary)]"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-[rgba(181,51,51,0.18)] bg-[var(--destructive-soft)] px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--fg-secondary)]">
          {success}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={saving} className="h-11 rounded-xl px-5">
          {saving ? "Saving..." : "Save Invite"}
        </Button>
        {!embedded ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 rounded-xl px-5"
            onClick={() => router.push(`/org/${orgSlug}/dashboard`)}
          >
            Back to Workspace
          </Button>
        ) : null}
      </div>
    </form>
  );
}
