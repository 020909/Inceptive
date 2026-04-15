"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OrganizationGovernanceSettings } from "@/lib/supabase/org-governance";

interface OrgGovernanceSettingsProps {
  orgId: string;
  initialSettings: OrganizationGovernanceSettings;
}

function PolicyToggle({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--fg-primary)]">{title}</p>
        <p className="max-w-2xl text-sm leading-6 text-[var(--fg-muted)]">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex h-9 min-w-[110px] items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors",
          enabled
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--fg-secondary)]"
        )}
        aria-pressed={enabled}
      >
        {enabled ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}

export function OrgGovernanceSettings({
  orgId,
  initialSettings,
}: OrgGovernanceSettingsProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);

  const posture = useMemo(() => {
    if (settings.manual_runs_require_approval && settings.workflow_changes_require_approval) {
      return {
        label: "Tight control",
        description: "Runs and workflow changes are gated behind admin review.",
      };
    }

    if (settings.manual_runs_require_approval || settings.workflow_changes_require_approval) {
      return {
        label: "Balanced",
        description: "High-impact workspace actions are reviewed while routine work stays fast.",
      };
    }

    return {
      label: "Autonomous",
      description: "Workspace actions execute immediately with audit logging only.",
    };
  }, [settings.manual_runs_require_approval, settings.workflow_changes_require_approval]);

  async function saveSettings() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/org/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgId,
          manual_runs_require_approval: settings.manual_runs_require_approval,
          workflow_changes_require_approval: settings.workflow_changes_require_approval,
          notify_admins_on_review_requests: settings.notify_admins_on_review_requests,
          require_rejection_reason: settings.require_rejection_reason,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || "Failed to save workspace governance.");
      }

      setSettings(json.settings as OrganizationGovernanceSettings);
      toast.success("Workspace governance updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save workspace governance.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="rounded-[32px]">
      <CardHeader className="border-b border-[var(--border-subtle)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[var(--fg-primary)]" />
              <CardTitle>Governance Policies</CardTitle>
            </div>
            <CardDescription>
              These controls decide when workspace actions execute immediately and when they must enter the human review queue.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Current posture</p>
            <p className="mt-1 font-medium text-[var(--fg-primary)]">{posture.label}</p>
            <p className="mt-1 max-w-xs text-[var(--fg-muted)]">{posture.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <PolicyToggle
          title="Require approval for manual runs"
          description="When enabled, clicking Run Agent Now creates an approval request instead of starting work immediately."
          enabled={settings.manual_runs_require_approval}
          onToggle={() =>
            setSettings((current) => ({
              ...current,
              manual_runs_require_approval: !current.manual_runs_require_approval,
            }))
          }
        />
        <PolicyToggle
          title="Require approval for workflow changes"
          description="Activating, pausing, and resuming shared workspace workflows will be routed through the review queue."
          enabled={settings.workflow_changes_require_approval}
          onToggle={() =>
            setSettings((current) => ({
              ...current,
              workflow_changes_require_approval: !current.workflow_changes_require_approval,
            }))
          }
        />
        <PolicyToggle
          title="Notify admins when review is needed"
          description="Send in-app notifications to workspace admins whenever a member requests a gated action."
          enabled={settings.notify_admins_on_review_requests}
          onToggle={() =>
            setSettings((current) => ({
              ...current,
              notify_admins_on_review_requests: !current.notify_admins_on_review_requests,
            }))
          }
        />
        <PolicyToggle
          title="Require a reason on rejection"
          description="Force reviewers to leave a short explanation when they reject a queued request."
          enabled={settings.require_rejection_reason}
          onToggle={() =>
            setSettings((current) => ({
              ...current,
              require_rejection_reason: !current.require_rejection_reason,
            }))
          }
        />

        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 text-[var(--fg-muted)]" size={18} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--fg-primary)]">Policy changes apply immediately</p>
              <p className="text-sm text-[var(--fg-muted)]">
                New workspace runs and workflow changes will follow this policy as soon as you save.
              </p>
              <p className="text-xs text-[var(--fg-muted)]">
                Last updated {formatDistanceToNow(new Date(settings.updated_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Button size="lg" className="h-11 rounded-xl px-5" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            {isSaving ? "Saving..." : "Save Governance"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
