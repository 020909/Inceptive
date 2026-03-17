"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Mail, Search, Share2, Target,
  FileBarChart, Settings, Menu, X, LogOut,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Email Autopilot", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Social Media", href: "/social", icon: Share2 },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Reports", href: "/reports", icon: FileBarChart },
];

const bottomItems = [
  { label: "Settings", href: "/settings", icon: Settings },
];

function UserSection({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const email = user?.email || "";
  const initials = email.split("@")[0].slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="px-2 pb-3 pt-2 border-t border-[#2C2C2E]">
      <div className={`flex items-center gap-2.5 px-2 py-2 rounded-lg group hover:bg-[#242426] transition-colors duration-150 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[#007AFF]"
          style={{ background: "rgba(0,122,255,0.15)" }}>
          {initials}
        </div>
        {!collapsed && (
          <span className="text-xs text-[#8E8E93] truncate flex-1 min-w-0">{email}</span>
        )}
        <button onClick={handleLogout}
          className={`transition-all duration-150 p-1 rounded hover:bg-[#38383A] text-[#636366] hover:text-white ${collapsed ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          title="Sign out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function NavItem({ item, isActive, collapsed, onClick }: {
  item: typeof navItems[0]; isActive: boolean; collapsed: boolean; onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClick} title={collapsed ? item.label : undefined}
      className="relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group overflow-hidden"
      style={{ color: isActive ? "#FFFFFF" : "#8E8E93", background: isActive ? "#2A2A2C" : "transparent", justifyContent: collapsed ? "center" : "flex-start" }}>
      {isActive && (
        <motion.div layoutId="sidebar-active-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#007AFF]"
          transition={{ type: "spring", stiffness: 400, damping: 35 }} />
      )}
      <Icon className="shrink-0 transition-colors duration-150" style={{ width: 17, height: 17, color: isActive ? "#007AFF" : "#8E8E93" }} />
      {!collapsed && (
        <span className="transition-colors duration-150 group-hover:text-white whitespace-nowrap">{item.label}</span>
      )}
      {!isActive && (
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-[#242426]" style={{ zIndex: -1 }} />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col" style={{ background: "#141416" }}>
      <div className={`flex items-center ${collapsed ? "justify-center px-2 py-[18px]" : "justify-between px-3 py-4"}`}>
        {collapsed ? (
          <Link href="/dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden border border-white/10 shrink-0">
            <Image src="/logo.png" alt="Inceptive" width={28} height={28} className="object-cover" />
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden border border-white/10 shrink-0">
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">Inceptive</span>
          </Link>
        )}
        <button onClick={toggle}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-[#636366] hover:text-white hover:bg-[#242426] transition-all duration-150"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="mx-2 h-px bg-[#2C2C2E] mb-1.5" />

      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.href} item={item} isActive={pathname === item.href} collapsed={collapsed} onClick={() => setMobileOpen(false)} />
        ))}
      </nav>

      <div className="px-2 py-1 space-y-0.5 mb-1">
        {bottomItems.map((item) => (
          <NavItem key={item.href} item={item} isActive={pathname === item.href} collapsed={collapsed} onClick={() => setMobileOpen(false)} />
        ))}
      </div>

      <UserSection collapsed={collapsed} />
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[#38383A] transition-colors duration-150 hover:bg-[#2C2C2E]"
        style={{ background: "#242426" }} aria-label="Toggle navigation">
        <AnimatePresence mode="wait" initial={false}>
          {mobileOpen
            ? <motion.div key="x" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}><X className="h-4 w-4 text-white" /></motion.div>
            : <motion.div key="menu" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: 0.15 }}><Menu className="h-4 w-4 text-white" /></motion.div>
          }
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.aside key="mobile-sidebar" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed inset-y-0 left-0 z-40 w-[240px] md:hidden">
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      <motion.aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r border-[#2C2C2E] z-30"
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ overflow: "hidden" }}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}
