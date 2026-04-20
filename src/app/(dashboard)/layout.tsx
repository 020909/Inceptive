"use client";
import { AppShell } from "@/components/layout/app-shell";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return <AppShell><div className={`animate-fade-in-up flex flex-col ${pathname === "/agent" ? "h-full" : ""}`}>{children}</div></AppShell>;
}
