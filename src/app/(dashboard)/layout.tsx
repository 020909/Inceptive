"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/lib/theme-context";
import { PageTransition } from "@/components/ui/page-transition";

function LayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell relative flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto relative">
        <div
          className="pointer-events-none absolute inset-0 dashboard-premium-bg opacity-[0.9] z-0"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-white/60 via-white/20 to-transparent dark:from-black/20 dark:via-black/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-48 bg-gradient-to-t from-[rgba(232,230,220,0.5)] to-transparent dark:from-[rgba(20,20,19,0.18)]"
          aria-hidden
        />
        <div className="relative z-10 min-h-0">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AgentProvider>
          <ChatProvider>
            <SidebarProvider>
              <LayoutInner>{children}</LayoutInner>
            </SidebarProvider>
          </ChatProvider>
        </AgentProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
