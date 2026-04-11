import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getOrgBySlug, getOrgMembershipForUser } from "@/lib/supabase/org";
import { InviteMemberForm } from "@/components/org/invite-member-form";

interface InvitePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ success?: string }>;
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { slug } = await params;
  const { success } = await searchParams;
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
  if (!membership) {
    redirect("/dashboard?error=org-access-denied");
  }

  const isAdmin = membership.role === "admin";

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl px-6 py-10">
      <div className="command-surface w-full rounded-[32px] border border-[var(--border-default)] p-8">
        <div className="mb-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Invite</p>
          <h1
            className="text-4xl text-[var(--fg-primary)]"
            style={{ fontFamily: "var(--font-header)" }}
          >
            Invite a member to {organization.name}
          </h1>
          <p className="max-w-xl text-sm leading-6 text-[var(--fg-secondary)]">
            Save a pending member invitation now. Email delivery can be added later without changing the data model.
          </p>
        </div>

        {success ? (
          <div className="mb-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--fg-secondary)]">
            Saved a pending invite for {success}.
          </div>
        ) : null}

        {!isAdmin ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[rgba(181,51,51,0.18)] bg-[var(--destructive-soft)] px-4 py-3 text-sm text-[var(--destructive)]">
              Only organization admins can invite members.
            </div>
            <Link
              href={`/org/${organization.slug}/dashboard`}
              className="text-sm text-[var(--fg-secondary)] underline underline-offset-4"
            >
              Back to workspace
            </Link>
          </div>
        ) : (
          <InviteMemberForm orgId={organization.id} orgSlug={organization.slug} />
        )}
      </div>
    </section>
  );
}
