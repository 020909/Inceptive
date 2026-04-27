"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { ThemeProvider } from "@/lib/theme-context";
import { OrgProvider } from "@/lib/org-context";
import { AppSidebar, AppSidebarProvider } from "@/components/layout/app-sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { Toaster } from "@/components/ui/sonner";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgent = pathname === "/agent";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-deep)]">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 relative min-h-0">
        <main
          className={`flex-1 min-w-0 overflow-y-auto scrollbar-hide ${isAgent ? "overflow-hidden flex flex-col" : ""}`}
        >
          <div
            className={
              isAgent ? "h-full" : "w-full max-w-full min-h-0 p-6"
            }
          >
            <PageTransition className={isAgent ? "h-full" : undefined}>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AgentProvider>
        <ChatProvider>
          <OrgProvider>
            <AppSidebarProvider>
              <LayoutInner>{children}</LayoutInner>
              <Toaster />
            </AppSidebarProvider>
          </OrgProvider>
        </ChatProvider>
      </AgentProvider>
    </ThemeProvider>
  );
}
