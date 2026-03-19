"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth-context";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { ChatProvider } from "@/lib/chat-context";
import { Sidebar } from "@/components/layout/sidebar";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Sidebar />
      <main
        className="min-h-screen transition-all duration-300 ease-in-out md:[margin-left:var(--sidebar-w)]"
        style={{ "--sidebar-w": collapsed ? "64px" : "240px" } as React.CSSProperties}
      >
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AuthProvider>
        <ChatProvider>
          <LayoutInner>{children}</LayoutInner>
        </ChatProvider>
      </AuthProvider>
    </SidebarProvider>
  );
}
