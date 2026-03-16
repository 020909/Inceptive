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
      <div className="min-h-screen bg-black">
        <Sidebar />
        <main className="md:pl-[260px]">
          <div className="p-6 md:p-8 pt-16 md:pt-8">{children}</div>
        </main>
      </div>
    </AuthProvider>
  );
}
