"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { ThemeProvider } from "@/lib/theme-context";
import { OrgProvider } from "@/lib/org-context";
import { AppSidebar } from "@/components/blocks/app-sidebar";
import { SiteHeader } from "@/components/blocks/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingController } from "@/components/onboarding/onboarding-controller";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgent = pathname === "/agent";

  return (
    <SidebarProvider
      className="h-screen overflow-hidden bg-[var(--surface-deep)]"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main
          className={isAgent ? "flex-1 min-w-0 overflow-hidden flex flex-col" : "flex-1 min-w-0 overflow-y-auto scrollbar-hide"}
        >
          <div className={isAgent ? "h-full" : "w-full max-w-full min-h-0"}>
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
            <React.Suspense fallback={null}>
              <OnboardingController />
            </React.Suspense>
          </OrgProvider>
        </ChatProvider>
      </AgentProvider>
    </ThemeProvider>
  );
}
