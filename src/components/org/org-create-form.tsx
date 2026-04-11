"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { createOrganizationWithAdmin } from "@/lib/supabase/org";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function OrgCreateForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshOrgs } = useOrg();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestedSlug = useMemo(() => slugify(name), [name]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      setError("You need to be signed in to create a workspace.");
      return;
    }

    const normalizedSlug = suggestedSlug;
    if (!name.trim() || !normalizedSlug) {
      setError("Enter your company name to continue.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const organization = await createOrganizationWithAdmin(
        user.id,
        {
          name,
          slug: normalizedSlug,
        },
        createClient()
      );

      await refreshOrgs();
      router.push(`/org/${organization.slug}/dashboard`);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to create workspace.";
      setError(message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="org-name" className="text-[var(--fg-primary)]">
          Company Name
        </Label>
        <Input
          id="org-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Acme Labs"
          className="h-11 rounded-xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-[var(--fg-primary)]"
        />
        <p className="text-xs text-[var(--fg-muted)]">
          We create the workspace URL automatically from the company name.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[rgba(181,51,51,0.18)] bg-[var(--destructive-soft)] px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={saving} className="h-11 rounded-xl px-5">
        {saving ? "Creating..." : "Continue"}
      </Button>
    </form>
  );
}
