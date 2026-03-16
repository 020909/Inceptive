"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Bot,
  Mail,
  Search,
  Share2,
  Target,
  FileBarChart,
  Settings,
  Menu,
  X,
} from "lucide-react";
import Image from "next/image";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "Email Autopilot", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Social Media", href: "/social", icon: Share2 },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Settings", href: "/settings", icon: Settings },
];

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-6">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-white/20 shrink-0">
        <Image src="/logo.png" alt="Inceptive Logo" fill className="object-cover" />
      </div>
      <span className="text-lg font-bold text-white tracking-tight">Inceptive</span>
    </Link>
  );
}

function UserSection() {
  const { user } = useAuth();
  const email = user?.email || "";
  const initials = email
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 px-4 py-4 border-t border-[#1F1F1F]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F1F1F] text-xs font-medium text-white">
        {initials}
      </div>
      <span className="text-sm text-[#888888] truncate">{email}</span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <div className="flex h-full flex-col bg-[#050505]">
      <Logo />
      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 ease-in-out relative
                ${
                  isActive
                    ? "text-white bg-[#111111]"
                    : "text-[#888888] hover:text-white hover:bg-[#0A0A0A]"
                }
              `}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-white rounded-r" />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <UserSection />
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-[#0D0D0D] border border-[#1F1F1F] transition-colors duration-200"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Menu className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-[260px] transform transition-transform duration-200 ease-in-out md:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 border-r border-[#1F1F1F]">
        {navContent}
      </aside>
    </>
  );
}
