'use client';

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/lib/sidebar-context";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Bot,
  Mail,
  Search,
  Plug,
  Target,
  FileText,
  Zap,
} from "lucide-react";
import Image from "next/image";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "Email Autopilot", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Connectors", href: "/social", icon: Plug },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 bg-[#262624] border-r border-white/[0.06] flex flex-col z-50"
      style={{ width: collapsed ? "80px" : "256px" }}
    >
      {/* Logo Section */}
      <div className="px-5 py-6 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center shrink-0">
            <span className="text-[#262624] font-bold text-lg leading-none">I</span>
          </div>
          {!collapsed && (
            <span className="text-white font-semibold text-[15px] tracking-tight">
              Inceptive
            </span>
          )}
        </Link>
        {!collapsed && (
          <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 mt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.04]"
                }`}
              >
                <Icon
                  size={18}
                  className={`${isActive ? "text-white" : "text-white/50"} group-hover:text-white transition-colors`}
                  strokeWidth={1.5}
                />
                {!collapsed && (
                  <span
                    className={`text-[14px] tracking-tight transition-colors ${
                      isActive ? "text-white font-medium" : "text-white/50 group-hover:text-white"
                    }`}
                  >
                    {item.label}
                  </span>
                )}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 mt-auto">
        {!collapsed && (
          <div className="space-y-4 px-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-white">
                  <Zap size={10} fill="currentColor" />
                  <span>100 Free</span>
                </div>
                <span className="text-white/30 lowercase italic">resets daily</span>
              </div>
              <div className="h-[1px] w-full bg-white/10 relative">
                <div className="absolute inset-y-0 left-0 w-full bg-white" />
              </div>
            </div>
            <Link href="/upgrade">
              <button className="w-full py-2 px-4 rounded-lg border border-white/20 text-white text-[13px] font-medium hover:bg-white/[0.04] transition-colors">
                Upgrade →
              </button>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
