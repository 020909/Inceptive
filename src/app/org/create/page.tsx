import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { OrgCreateForm } from "@/components/org/org-create-form";

export default async function CreateOrganizationPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl px-6 py-10">
      <div className="command-surface w-full rounded-[32px] border border-[var(--border-default)] p-8">
        <div className="mb-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">Workspace</p>
          <h1
            className="text-4xl text-[var(--fg-primary)]"
            style={{ fontFamily: "var(--font-header)" }}
          >
            Create a shared workspace
          </h1>
          <p className="max-w-xl text-sm leading-6 text-[var(--fg-secondary)]">
            Enter the company name and continue. Inceptive will create the team workspace automatically and add you as the first admin.
          </p>
        </div>

        <OrgCreateForm />
      </div>
    </section>
  );
}
