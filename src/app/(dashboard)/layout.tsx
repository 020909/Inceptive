"use client";

import { AuthProvider } from "@/lib/auth-context";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen" style={{ background: "#1C1C1E" }}>
        <Sidebar />
        <main className="md:pl-[240px] min-h-screen">
          <div className="p-6 md:p-8 pt-16 md:pt-8 max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
