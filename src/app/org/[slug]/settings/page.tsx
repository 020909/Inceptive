import { redirect } from "next/navigation";
import { Shield, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";

interface OrgSettingsPageProps {
  params: Promise<{ slug: string }>;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
      <span className="text-sm text-[var(--fg-secondary)]">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium text-[var(--fg-primary)]">
        <span className="inline-block size-2 rounded-full bg-emerald-500" />
        {value}
      </span>
    </div>
  );
}

export default async function OrgSettingsPage({ params }: OrgSettingsPageProps) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organization = await getOrgBySlug(slug, supabase);
  if (!organization) {
    redirect("/dashboard?error=org-access-denied");
  }

  const membership = await getOrgMembershipForUser(organization.id, user.id, supabase);
  if (!membership || membership.role !== "admin") {
    redirect("/dashboard?error=org-access-denied");
  }

  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);

  const { data: rateLimitHits, error } = await createAdminSupabaseClient()
    .from("rate_limits")
    .select("identifier, route, request_count, window_start")
    .gte("window_start", last24Hours.toISOString())
    .order("request_count", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <section className="mx-auto flex min-h-full w-full max-w-6xl px-6 py-10">
      <div className="flex w-full flex-col gap-6">
        <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <Settings size={20} className="text-[var(--fg-primary)]" />
            </span>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Workspace Settings</p>
              <h1 className="text-4xl text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-header)" }}>
                Security for {organization.name}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--fg-secondary)]">
                Current API security posture and recent platform rate-limit activity visible to workspace admins.
              </p>
            </div>
          </div>
        </div>

        <Card className="rounded-[32px]">
          <CardHeader className="border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <Shield className="text-[var(--fg-primary)]" />
              <div>
                <CardTitle>API Security</CardTitle>
                <CardDescription>Built with Next.js proxy protection and Supabase only.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <StatusRow label="Rate limiting" value="Active" />
            <StatusRow label="Security headers" value="Enabled" />
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
              <p className="text-sm font-medium text-[var(--fg-primary)]">Max agent triggers</p>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">5 per hour</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader className="border-b border-[var(--border-subtle)]">
            <CardTitle>Recent Rate Limit Hits</CardTitle>
            <CardDescription>Platform-wide top identifiers by request volume in the last 24 hours.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rateLimitHits && rateLimitHits.length > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {rateLimitHits.map((row) => (
                  <div key={`${row.identifier}-${row.route}-${row.window_start}`} className="grid gap-2 px-6 py-4 md:grid-cols-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Identifier</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">{row.identifier}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Route</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">{row.route}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Request Count</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">{row.request_count}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Window Start</p>
                      <p className="mt-1 text-sm text-[var(--fg-primary)]">
                        {new Date(row.window_start).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-sm text-[var(--fg-muted)]">No recent rate limit hits in the last 24 hours.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
