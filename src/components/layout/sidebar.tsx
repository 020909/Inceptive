"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
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
  LogOut,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "Email Autopilot", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Social Media", href: "/social", icon: Share2 },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Reports", href: "/reports", icon: FileBarChart },
];

const bottomItems = [
  { label: "Settings", href: "/settings", icon: Settings },
];

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-5 group">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-white/10 shrink-0 transition-all duration-200 group-hover:border-white/20">
        <Image src="/logo.png" alt="Inceptive Logo" fill className="object-cover" />
      </div>
      <span className="text-base font-semibold text-white tracking-tight">Inceptive</span>
    </Link>
  );
}

function UserSection() {
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
    <div className="px-3 pb-4 pt-2 border-t border-[#2C2C2E]">
      <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg group hover:bg-[#242426] transition-colors duration-150 cursor-default">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#007AFF]/20 text-[11px] font-semibold text-[#007AFF] shrink-0">
          {initials}
        </div>
        <span className="text-xs text-[#8E8E93] truncate flex-1">{email}</span>
        <button
          onClick={handleLogout}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded hover:bg-[#38383A] text-[#636366] hover:text-white"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function NavItem({ item, isActive, onClick }: {
  item: typeof navItems[0];
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group"
      style={{
        color: isActive ? "#FFFFFF" : "#8E8E93",
        backgroundColor: isActive ? "#2A2A2C" : "transparent",
      }}
    >
      {/* Active blue bar */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#007AFF]"
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}

      {/* Icon */}
      <Icon
        className="h-[17px] w-[17px] shrink-0 transition-colors duration-150"
        style={{ color: isActive ? "#007AFF" : "#8E8E93" }}
      />

      {/* Label */}
      <span className="transition-colors duration-150 group-hover:text-white">
        {item.label}
      </span>

      {/* Hover bg */}
      {!isActive && (
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-[#242426]" style={{ zIndex: -1 }} />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <div className="flex h-full flex-col" style={{ background: "#141416" }}>
      <Logo />

      {/* Divider */}
      <div className="mx-4 h-px bg-[#2C2C2E] mb-2" />

      {/* Main nav */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Bottom nav (Settings) */}
      <div className="px-2 py-1 space-y-0.5 mb-1">
        {bottomItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </div>

      <UserSection />
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-9 w-9 items-center justify-center rounded-lg bg-[#242426] border border-[#38383A] transition-colors duration-150 hover:bg-[#2C2C2E]"
        aria-label="Toggle navigation"
      >
        <AnimatePresence mode="wait" initial={false}>
          {mobileOpen ? (
            <motion.div
              key="x"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-4 w-4 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
            >
              <Menu className="h-4 w-4 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed inset-y-0 left-0 z-40 w-[260px] md:hidden"
          >
            {navContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[240px] md:flex-col md:fixed md:inset-y-0 border-r border-[#2C2C2E]">
        {navContent}
      </aside>
    </>
  );
}
