"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InviteMemberForm } from "@/components/org/invite-member-form";

interface InviteMemberDialogProps {
  orgId: string;
  orgSlug: string;
  disabled?: boolean;
}

export function InviteMemberDialog({ orgId, orgSlug, disabled = false }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="h-11 rounded-xl px-5" disabled={disabled} />
        }
      >
        Invite Member
      </DialogTrigger>
      <DialogContent className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription className="text-[var(--fg-muted)]">
            Save a pending invitation now. Email delivery can be wired up later.
          </DialogDescription>
        </DialogHeader>
        <InviteMemberForm
          orgId={orgId}
          orgSlug={orgSlug}
          embedded
          onInvited={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
