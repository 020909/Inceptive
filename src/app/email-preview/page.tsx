const previews = [
  {
    title: "Morning Report",
    src: "/api/email-preview/morning-report",
  },
  {
    title: "Team Invite",
    src: "/api/email-preview/team-invite",
  },
  {
    title: "Task Complete",
    src: "/api/email-preview/task-complete",
  },
];

export default function EmailPreviewPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--fg-primary)]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fg-muted)]">Internal preview only</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--fg-primary)]">Transactional email previews</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--fg-secondary)]">
            Review the current browser render for each React Email template before sending production mail through Resend.
          </p>
        </div>

        <div className="space-y-8">
          {previews.map((preview) => (
            <section key={preview.title} className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
              <div className="border-b border-[var(--border-default)] px-6 py-4">
                <h2 className="text-lg font-semibold text-[var(--fg-primary)]">{preview.title}</h2>
              </div>
              <iframe className="h-[920px] w-full bg-[var(--bg-base)]" src={preview.src} title={preview.title} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
