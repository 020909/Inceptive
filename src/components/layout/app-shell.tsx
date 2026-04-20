"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { ThemeProvider } from "@/lib/theme-context";
import { OrgProvider } from "@/lib/org-context";
import { AppSidebar, AppSidebarProvider, AppSidebarTrigger } from "@/components/layout/app-sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { Toaster } from "@/components/ui/sonner";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgent = pathname === "/agent";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Top bar with trigger — placed to the left to align with sidebar */}
        <div className="flex h-16 shrink-0 items-center justify-between px-4 bg-[var(--bg-base)] border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-4">
            <AppSidebarTrigger />
          </div>
          {/* You can add breadcrumbs or other top-bar items here */}
        </div>
        
        {/* Page content — using h-full to fill space, but padding handles the 'gap' */}
        <main
          className={`flex-1 min-w-0 overflow-y-auto scrollbar-hide ${isAgent ? "overflow-hidden flex flex-col" : ""}`}
        >
          <div className={`${isAgent ? "h-full" : "w-full max-w-full"}`}>
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
