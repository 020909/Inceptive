"use client";

import { AuthProvider } from "@/lib/auth-context";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen" style={{ background: "#1C1C1E" }}>
      <Sidebar />
      <main
        className="min-h-screen transition-all duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? "64px" : "240px" }}
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
        <LayoutInner>{children}</LayoutInner>
      </AuthProvider>
    </SidebarProvider>
  );
}
