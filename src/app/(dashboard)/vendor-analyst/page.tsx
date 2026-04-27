"use client";

import { Building2 } from "lucide-react";
export default function VendorAnalystPage() {
  return (
    <main className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto text-center">
          <Building2 className="w-16 h-16 mx-auto mb-6 text-[var(--accent)]" />
          <h1 className="text-4xl font-bold mb-4 text-[var(--fg-primary)]">
            Vendor Analyst
          </h1>
          <p className="text-lg text-[var(--fg-muted)] mb-8">
            Reads vendor SOC2 reports and security questionnaires to generate structured risk assessments and approval recommendations.
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
