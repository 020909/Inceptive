"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { ThemeProvider } from "@/lib/theme-context";
import { OrgProvider } from "@/lib/org-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { Toaster } from "@/components/ui/sonner";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgent = pathname === "/agent";

  return (
    <SidebarProvider className="dashboard-shell h-screen overflow-hidden bg-[var(--bg-base)]">
      <AppSidebar />
      <SidebarInset className="bg-transparent">
        <main
          className={`relative min-w-0 flex-1 overflow-y-auto ${isAgent ? "overflow-hidden flex flex-col h-full" : ""}`}
        >
          <div className={`relative z-10 min-h-0 ${isAgent ? "h-full" : "pb-6"}`}>
            <PageTransition className={isAgent ? "h-full" : undefined}>{children}</PageTransition>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AgentProvider>
        <ChatProvider>
          <OrgProvider>
            <LayoutInner>{children}</LayoutInner>
            <Toaster />
          </OrgProvider>
        </ChatProvider>
      </AgentProvider>
    </ThemeProvider>
  );
}
