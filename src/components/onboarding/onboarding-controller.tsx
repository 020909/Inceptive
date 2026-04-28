"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startTour } from "@/lib/onboarding/tour";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Command, Mail, Plus, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

const STORAGE_KEY = "inceptive:onboarding:v1";
const KEY_CONNECTED_GMAIL = "inceptive:onboarding:connected_gmail";
const KEY_CREATED_CASE = "inceptive:onboarding:created_case";
const KEY_RAN_WORKFLOW = "inceptive:onboarding:ran_workflow";

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "seen");
  } catch {
    // ignore
  }
}

function hasSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

export function OnboardingController() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const welcomeParam = searchParams.get("welcome") === "true";
  const shouldBlockForAuth = pathname === "/login" || pathname === "/signup";

  const [open, setOpen] = React.useState(false);
  const openedRef = React.useRef(false);

  const [gmailConnected, setGmailConnected] = React.useState(false);
  const [caseCreated, setCaseCreated] = React.useState(false);
  const [workflowRan, setWorkflowRan] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (!user?.id) return;

    // Fast local flags first.
    try {
      setGmailConnected(localStorage.getItem(KEY_CONNECTED_GMAIL) === "true");
      setCaseCreated(localStorage.getItem(KEY_CREATED_CASE) === "true");
      setWorkflowRan(localStorage.getItem(KEY_RAN_WORKFLOW) === "true");
    } catch {
      // ignore
    }

    // If URL indicates a successful connection, persist it.
    const connected = searchParams.get("connected");
    if (connected === "gmail") {
      try {
        localStorage.setItem(KEY_CONNECTED_GMAIL, "true");
      } catch {
        // ignore
      }
      setGmailConnected(true);
    }

    // Source of truth: check Supabase connected_accounts for Gmail.
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("connected_accounts")
        .select("provider")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();

      if (cancelled) return;
      const isConnected = !!data;
      setGmailConnected(isConnected);
      if (isConnected) {
        try {
          localStorage.setItem(KEY_CONNECTED_GMAIL, "true");
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user, searchParams]);

  React.useEffect(() => {
    if (openedRef.current) return;
    if (shouldBlockForAuth) return;
    if (loading) return;
    if (!user) return;

    const firstTime = !hasSeen();
    if (welcomeParam || firstTime) {
      openedRef.current = true;
      setOpen(true);
    }
  }, [loading, user, welcomeParam, shouldBlockForAuth]);

  // Allow manual open from anywhere (Help → Get started).
  React.useEffect(() => {
    const handler = () => {
      openedRef.current = true;
      setOpen(true);
    };
    window.addEventListener("inceptive:onboarding:open", handler as EventListener);
    return () => window.removeEventListener("inceptive:onboarding:open", handler as EventListener);
  }, []);

  if (shouldBlockForAuth) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) markSeen();
      }}
    >
      <DialogContent className="sm:max-w-[860px] p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr]">
          {/* Left: narrative */}
          <div className="bg-[var(--surface-container)] p-6 md:p-8">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-10 w-10 overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                    <Image src="/logo.png" alt="Inceptive" fill sizes="40px" className="object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Inceptive Command Center
                    </div>
                    <DialogTitle className="mt-1 text-[20px] leading-tight">
                      Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}.
                    </DialogTitle>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  New workspace
                </Badge>
              </div>
            </DialogHeader>

            <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">
              Inceptive is built for high-trust operations: clear queues, auditable actions, and fast navigation.
              If you’re new, take the 60‑second product tour and complete the quick setup checklist.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Command className="size-4 text-[var(--muted-foreground)]" />
                  <span>Navigate like a pro</span>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  Press <span className="font-mono">⌘K</span> to search and jump anywhere instantly.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="size-4 text-[var(--muted-foreground)]" />
                  <span>Designed for auditability</span>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  Approvals and workflows leave a clean trail so teams can move fast with confidence.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  markSeen();
                }}
              >
                Skip for now
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={() => {
                  markSeen();
                  setOpen(false);
                  window.setTimeout(() => startTour("product-intro"), 250);
                }}
              >
                Take product tour
              </Button>
              <Button
                onClick={() => {
                  markSeen();
                  setOpen(false);
                }}
              >
                Continue
              </Button>
            </div>
          </div>

          {/* Right: checklist (wired in next step) */}
          <div className="bg-[var(--background)] p-6 md:p-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Get started
            </div>
            <div className="mt-2 text-sm font-semibold">Complete setup in under 2 minutes</div>
            <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
              We’ll use these to personalize workflows and unlock automations.
            </p>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                {gmailConnected ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-[var(--foreground)]" />
                ) : (
                  <Circle className="mt-0.5 size-4 text-[var(--muted-foreground)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Connect Gmail</div>
                    <Mail className="size-4 text-[var(--muted-foreground)]" />
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    Enable email workflows and autopilot.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                {caseCreated ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-[var(--foreground)]" />
                ) : (
                  <Circle className="mt-0.5 size-4 text-[var(--muted-foreground)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Create your first case</div>
                    <Plus className="size-4 text-[var(--muted-foreground)]" />
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    Start a KYB / SAR / AML workflow.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                {workflowRan ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-[var(--foreground)]" />
                ) : (
                  <Circle className="mt-0.5 size-4 text-[var(--muted-foreground)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Run a first workflow</div>
                    <PlayCircle className="size-4 text-[var(--muted-foreground)]" />
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    Upload a UBO document or draft a SAR.
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/settings?section=mail">
                  Open connectors
                  <span className="text-[var(--muted-foreground)]">→</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-between">
                <Link href="/cases">
                  Go to cases
                  <span className="text-[var(--muted-foreground)]">→</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-between">
                <Link href="/ubo">
                  Upload a UBO document
                  <span className="text-[var(--muted-foreground)]">→</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

