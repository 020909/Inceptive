"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { Sidebar, SidebarProvider, useSidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/lib/theme-context";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <Sidebar />
      <main
        className="min-h-screen transition-[margin] duration-200 ease-out"
        style={{ marginLeft: collapsed ? 60 : 240 }}
      >
        {children}
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
