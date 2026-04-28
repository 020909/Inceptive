"use client";

import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ReconciliationPage() {
  return (
    <main className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto text-center">
          <Scale className="w-16 h-16 mx-auto mb-6 text-[var(--accent)]" />
          <h1 className="text-4xl font-bold mb-4 text-[var(--fg-primary)]">
            Reconciliation Tracer
          </h1>
          <p className="text-lg text-[var(--fg-muted)] mb-8">
            Finds payment variances by comparing data from multiple sources and tracing unmatched transactions.
          </p>
          <Button
            onClick={() => console.log("Notify me when available")}
            size="lg"
            className="px-6"
          >
            Notify me when available
          </Button>
        </div>
      </main>
  );
}
