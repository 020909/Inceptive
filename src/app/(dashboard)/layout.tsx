"use client";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <div className="animate-fade-in-up flex flex-col">{children}</div>
    </AppShell>
  );
}
