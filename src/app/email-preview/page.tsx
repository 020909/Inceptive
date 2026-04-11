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
    <main className="min-h-screen bg-neutral-100 px-6 py-10 text-neutral-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-neutral-300 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Internal preview only</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">Transactional email previews</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Review the current browser render for each React Email template before sending production mail through Resend.
          </p>
        </div>

        <div className="space-y-8">
          {previews.map((preview) => (
            <section key={preview.title} className="overflow-hidden rounded-3xl border border-neutral-300 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-950">{preview.title}</h2>
              </div>
              <iframe className="h-[920px] w-full bg-neutral-50" src={preview.src} title={preview.title} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
