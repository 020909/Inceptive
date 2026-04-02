"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { Sidebar, SidebarProvider, useSidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/lib/theme-context";
import { PageTransition } from "@/components/ui/page-transition";

function LayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-app)]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <PageTransition>{children}</PageTransition>
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
