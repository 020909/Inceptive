"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { useChat } from "@/lib/chat-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Mail, Search, Share2, Target,
  FileBarChart, Settings, Menu, X, LogOut,
  PanelLeftClose, PanelLeftOpen, Zap,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════
// BILLION-DOLLAR SIDEBAR - Pure White on Warm Grey
// ═══════════════════════════════════════════════════════════

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agent", href: "/agent", icon: Zap },
  { label: "Email", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Connectors", href: "/social", icon: Share2 },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Reports", href: "/reports", icon: FileBarChart },
];

const bottomItems = [
  { label: "Upgrade", href: "/upgrade", icon: Zap },
  { label: "Settings", href: "/settings", icon: Settings },
];

// ─── Manus-Style Breathing Dot (AI Alive Indicator) ───────
function AliveIndicator() {
  return (
    <motion.div
      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
      style={{ background: "#FFFFFF" }}
      animate={{
        opacity: [0.4, 1, 0.4],
        scale: [1, 1.15, 1],
        boxShadow: [
          "0 0 4px rgba(255, 255, 255, 0.3)",
          "0 0 12px rgba(255, 255, 255, 0.7)",
          "0 0 4px rgba(255, 255, 255, 0.3)",
        ],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// ─── Power Meter (Energy Bar with Pulse) ───────────────────
function PowerMeter() {
  const [credits, setCredits] = useState<{ remaining: number; total: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const r = await fetch("/api/credits");
        if (r.ok) {
          const d = await r.json();
          if (d?.credits) {
            setCredits({ remaining: d.credits.remaining ?? 0, total: d.credits.total ?? 100 });
          }
        }
      } catch {}
    };
    fetchCredits();
    
    const interval = setInterval(fetchCredits, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (credits?.remaining) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [credits?.remaining]);

  if (!credits) return null;

  const pct = credits.total > 0 ? Math.round((credits.remaining / credits.total) * 100) : 0;

  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-end justify-between mb-2.5">
        <div className="space-y-0.5">
          <span className="text-[9px] font-medium uppercase tracking-[0.1em]" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
            System Energy
          </span>
          <div className="text-sm font-semibold tracking-[-0.02em]" style={{ color: "#FFFFFF" }}>
            {credits.remaining.toLocaleString()} <span className="text-[10px] font-normal opacity-40 ml-0.5">/ {credits.total.toLocaleString()}</span>
          </div>
        </div>
        <span className="text-[10px] font-medium opacity-40" style={{ color: "#FFFFFF" }}>
          {pct}%
        </span>
      </div>

      <div className="relative h-[1px] w-full" style={{ background: "rgba(255, 255, 255, 0.08)" }}>
        <motion.div
          className="absolute left-0 top-0 h-full"
          style={{ background: "#FFFFFF" }}
          initial={{ width: 0 }}
          animate={{ 
            width: `${pct}%`,
          }}
          transition={{ duration: 0.8, ease: "circOut" }}
        />
        {/* Pulsing Glow Overlay */}
        <motion.div
          className="absolute left-0 top-0 h-full"
          style={{ background: "#FFFFFF", width: `${pct}%` }}
          animate={{
            opacity: [0, 0.4, 0],
            boxShadow: [
              "0 0 0px rgba(255, 255, 255, 0)",
              "0 0 8px rgba(255, 255, 255, 0.6)",
              "0 0 0px rgba(255, 255, 255, 0)",
            ],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}

// ─── Navigation Item with Active Border ────────────────────
function NavItem({ item, isActive, collapsed, onClick }: {
  item: typeof navItems[0]; isActive: boolean; collapsed: boolean; onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href} onClick={onClick} title={collapsed ? item.label : undefined}>
      <motion.div
        className="relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm cursor-pointer group"
        style={{
          color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
          background: isActive ? "rgba(255, 255, 255, 0.04)" : "transparent",
        }}
        whileHover={{
          background: "rgba(255, 255, 255, 0.06)",
          x: collapsed ? 0 : 2,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 25,
        }}
      >
        {/* Active State - 0.5px Left Border */}
        {isActive && (
          <motion.div
            layoutId="nav-active-border"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[0.5px] h-5"
            style={{ background: "#FFFFFF" }}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              boxShadow: "0 0 8px rgba(255, 255, 255, 0.4)"
            }}
            transition={{ duration: 0.4 }}
          />
        )}

        {/* Icon */}
        <Icon
          className="shrink-0 transition-all duration-300"
          style={{
            width: 17,
            height: 17,
            strokeWidth: isActive ? 1.5 : 1.2,
            color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
          }}
        />

        {/* Label */}
        {!collapsed && (
          <motion.span
            className="whitespace-nowrap font-medium"
            style={{ 
              letterSpacing: "-0.02em",
            }}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {item.label}
          </motion.span>
        )}
      </motion.div>
    </Link>
  );
}

// ─── Upgrade Ghost Button ──────────────────────────────────
function UpgradeButton() {
  return (
    <Link href="/upgrade">
      <motion.div
        className="mx-3 mt-2 flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-semibold cursor-pointer border border-white/10 hover:border-white/20 transition-all"
        style={{
          color: "#FFFFFF",
          background: "rgba(255, 255, 255, 0.02)",
        }}
        whileHover={{
          background: "rgba(255, 255, 255, 0.05)",
          y: -1,
        }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="tracking-[0.05em] uppercase">Upgrade Plan</span>
      </motion.div>
    </Link>
  );
}

// ─── User Profile Section ──────────────────────────────────
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
    <div className="px-3 pb-6 pt-4" style={{ borderTop: "0.5px solid rgba(255, 255, 255, 0.05)" }}>
      <div
        className={`flex items-center gap-3 px-2 py-2 rounded-xl group cursor-pointer transition-all duration-300 hover:bg-[rgba(255,255,255,0.03)] ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
          style={{
            background: "linear-gradient(135deg, #FFFFFF 0%, #E0E0E0 100%)",
            color: "#1A1A1A",
          }}
        >
          {initials}
        </div>

        {!collapsed && (
          <>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-semibold truncate" style={{ color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                {email.split("@")[0]}
              </span>
              <span className="text-[9px] opacity-40 uppercase tracking-widest font-medium">Free Tier</span>
            </div>
            <motion.button
              onClick={handleLogout}
              className="opacity-0 group-hover:opacity-40 transition-all duration-200 p-1.5 hover:opacity-100"
              style={{ color: "#FFFFFF" }}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Sidebar Component ────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAIServiceActive, setIsAIServiceActive] = useState(true);

  const sidebarContent = (
    <div
      className="flex h-full flex-col relative overflow-hidden"
      style={{
        background: "#262624",
        boxShadow: "inset -1px 0 0 rgba(255, 255, 255, 0.03)"
      }}
    >
      {/* Sophisticated Noise Overlay from Reference */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

      {/* Header: Logo + AI Alive Indicator */}
      <div className={`relative flex items-center ${collapsed ? "justify-center py-8" : "justify-between px-6 py-8"}`}>
        <Link href="/dashboard" className="relative group">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shrink-0 transition-transform duration-500 group-hover:scale-105" style={{ background: "#FFFFFF" }}>
            <Image src="/logo.png" alt="Inceptive" fill className="object-cover p-1" />
          </div>
          {isAIServiceActive && <AliveIndicator />}
        </Link>

        {!collapsed && (
          <motion.div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-[-0.03em] uppercase" style={{ color: "#FFFFFF" }}>
              Inceptive
            </span>
            <div className="h-1 w-1 rounded-full bg-white opacity-20" />
            <span className="text-[9px] font-medium opacity-30 uppercase tracking-[0.1em]">v0.1</span>
          </motion.div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto">
        {!collapsed && <PowerMeter />}
        {!collapsed && <UpgradeButton />}
        <div className="px-3 py-2 mt-2">
          <NavItem
            item={bottomItems[1]}
            isActive={pathname === bottomItems[1].href}
            collapsed={collapsed}
          />
        </div>
      </div>

      {/* User Section */}
      <UserSection collapsed={collapsed} />
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <motion.button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px)",
          border: "0.5px solid rgba(255, 255, 255, 0.1)",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {mobileOpen ? (
            <X key="x" className="h-5 w-5 text-white" strokeWidth={1.5} />
          ) : (
            <Menu key="menu" className="h-5 w-5 text-white" strokeWidth={1.5} />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-[260px] md:hidden shadow-2xl"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30"
        animate={{ width: collapsed ? 80 : 240 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 100, damping: 20 }}
        style={{ overflow: "hidden" }}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}
