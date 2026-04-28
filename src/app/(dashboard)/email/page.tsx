"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, ShieldCheck } from "lucide-react";

type ConnectedAccount = {
  provider: string;
  account_email: string | null;
  account_name: string | null;
  updated_at: string | null;
};

function EmailConnectorsPageInner() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [gmail, setGmail] = React.useState<ConnectedAccount | null>(null);
  const [loading, setLoading] = React.useState(true);

  const connectedParam = searchParams.get("connected");
  const errorParam = searchParams.get("error");

  React.useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("connected_accounts")
        .select("provider, account_email, account_name, updated_at")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();

      if (cancelled) return;
      setGmail((data as any) ?? null);
      setLoading(false);

      if (data) {
        try {
          localStorage.setItem("inceptive:onboarding:connected_gmail", "true");
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const connectHref = `/api/auth/google/connect?redirect_to=${encodeURIComponent("/email")}`;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Connectors
          </div>
          <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em]">
            Email
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Connect inboxes to enable email workflows.
          </p>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex">
          OAuth
        </Badge>
      </div>

      {connectedParam ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3 text-sm">
          Connected: <span className="font-mono">{connectedParam}</span>
        </div>
      ) : null}

      {errorParam ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3 text-sm">
          Error: <span className="font-mono">{errorParam}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[var(--border-subtle)] bg-[var(--card)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Mail className="size-4 text-[var(--muted-foreground)]" />
                Gmail
              </span>
              {gmail ? (
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="size-3.5" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-[var(--muted-foreground)]">
              {gmail ? (
                <>
                  Connected as{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {gmail.account_email ?? gmail.account_name ?? "gmail"}
                  </span>
                  .
                </>
              ) : (
                <>Connect Gmail to enable email workflows and autopilot.</>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <a href={connectHref}>Connect Gmail</a>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!appUrl) return;
                  window.location.reload();
                }}
              >
                Refresh
              </Button>
            </div>

            <div className="text-[11px] text-[var(--muted-foreground)] leading-5">
              We store refresh tokens encrypted and use least-privilege OAuth scopes required for workflows.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function EmailConnectorsPage() {
  return (
    <React.Suspense fallback={null}>
      <EmailConnectorsPageInner />
    </React.Suspense>
  );
}

