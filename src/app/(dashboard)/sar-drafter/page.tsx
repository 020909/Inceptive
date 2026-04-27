"use client";

import { FileText } from "lucide-react";
export default function SarDrafterPage() {
  return (
    <main className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto text-center">
          <FileText className="w-16 h-16 mx-auto mb-6 text-[var(--accent)]" />
          <h1 className="text-4xl font-bold mb-4 text-[var(--fg-primary)]">
            SAR Drafter
          </h1>
          <p className="text-lg text-[var(--fg-muted)] mb-8">
            Automatically drafts Suspicious Activity Report narratives in FinCEN format from alert data and transaction logs.
          </p>
          <button
            onClick={() => console.log("Notify me when available")}
            className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Notify me when available
          </button>
        </div>
      </main>
  );
}
