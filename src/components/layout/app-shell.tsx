"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { ThemeProvider } from "@/lib/theme-context";
import { OrgProvider } from "@/lib/org-context";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { Toaster } from "@/components/ui/sonner";

function LayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell relative flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 flex justify-end gap-3 px-4 py-4 sm:px-6">
          <GlobalSearch />
          <NotificationBell />
        </div>
        <div className="relative z-10 min-h-0 pb-6">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AgentProvider>
          <ChatProvider>
            <OrgProvider>
              <SidebarProvider>
                <LayoutInner>{children}</LayoutInner>
              </SidebarProvider>
              <Toaster />
            </OrgProvider>
          </ChatProvider>
        </AgentProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
