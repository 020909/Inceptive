"use client";

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function AmlTriagePage() {
  return (
    <main className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto text-center">
          <Shield className="w-16 h-16 mx-auto mb-6 text-[var(--accent)]" />
          <h1 className="text-4xl font-bold mb-4 text-[var(--fg-primary)]">
            AML Triage
          </h1>
          <p className="text-lg text-[var(--fg-muted)] mb-8">
            Pre-investigates AML alerts to identify false positives, assess risk levels, and recommend escalation or closure.
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
