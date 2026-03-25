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
      className="absolute top-2 right-2 w-2 h-2 rounded-full"
      style={{ background: "#FFFFFF" }}
      animate={{
        opacity: [0.6, 1, 0.6],
        scale: [1, 1.2, 1],
        boxShadow: [
          "0 0 8px rgba(255, 255, 255, 0.4)",
          "0 0 16px rgba(255, 255, 255, 0.8)",
          "0 0 8px rgba(255, 255, 255, 0.4)",
        ],
      }}
      transition={{
        duration: 2,
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
    
    // Poll for credit changes
    const interval = setInterval(fetchCredits, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (credits?.remaining) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [credits?.remaining]);

  if (!credits) return null;

  const pct = credits.total > 0 ? Math.round((credits.remaining / credits.total) * 100) : 0;

  return (
    <div className="w-full px-4 py-4">
      {/* Credits Display */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            Energy
          </span>
          <div className="text-lg font-semibold" style={{ color: "#FFFFFF" }}>
            {credits.remaining.toLocaleString()}
          </div>
        </div>
        <span className="text-xs" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
          {pct}%
        </span>
      </div>

      {/* Energy Bar */}
      <div className="relative h-0.5 w-full" style={{ background: "rgba(255, 255, 255, 0.1)" }}>
        <motion.div
          className="absolute left-0 top-0 h-full"
          style={{ background: "#FFFFFF" }}
          initial={{ width: 0 }}
          animate={{ 
            width: `${pct}%`,
            boxShadow: isAnimating 
              ? ["0 0 8px rgba(255, 255, 255, 0.4)", "0 0 16px rgba(255, 255, 255, 0.8)", "0 0 8px rgba(255, 255, 255, 0.4)"]
              : "none"
          }}
          transition={{ 
            width: { duration: 0.5, ease: "easeOut" },
            boxShadow: { duration: 1.5, repeat: isAnimating ? Infinity : 0 }
          }}
        />
      </div>

      {/* Reset Info */}
      <p className="text-[9px] mt-2" style={{ color: "rgba(255, 255, 255, 0.3)" }}>
        resets daily
      </p>
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
        className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
        style={{
          color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)",
          background: isActive ? "rgba(255, 255, 255, 0.08)" : "transparent",
        }}
        whileHover={{
          background: "rgba(255, 255, 255, 0.06)",
          scale: collapsed ? 1 : 1.005,
          x: collapsed ? 0 : 2,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20,
        }}
      >
        {/* Active State - Left Border with Flow Animation */}
        {isActive && (
          <>
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6"
              style={{ background: "#FFFFFF" }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ 
                opacity: 1, 
                height: 24,
                boxShadow: "0 0 12px rgba(255, 255, 255, 0.6)"
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            {/* Breathing Dot Next to Icon */}
            <motion.div
              className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
              style={{ background: "#FFFFFF" }}
              animate={{
                opacity: [0.6, 1, 0.6],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}

        {/* Icon */}
        <Icon
          className="shrink-0 transition-colors duration-200"
          style={{
            width: 18,
            height: 18,
            color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)",
            strokeWidth: isActive ? 2.5 : 2,
          }}
        />

        {/* Label */}
        {!collapsed && (
          <motion.span
            className="whitespace-nowrap"
            style={{ 
              color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)",
              fontWeight: isActive ? 500 : 400,
              letterSpacing: "-0.02em",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
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
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer mb-2"
        style={{
          color: "#FFFFFF",
          background: "transparent",
          border: "0.5px solid rgba(255, 255, 255, 0.2)",
        }}
        whileHover={{
          background: "rgba(255, 255, 255, 0.04)",
          borderColor: "rgba(255, 255, 255, 0.3)",
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20,
        }}
      >
        <span style={{ letterSpacing: "-0.02em" }}>Upgrade</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
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
    <div className="px-3 pb-3 pt-3" style={{ borderTop: "0.5px solid rgba(255, 255, 255, 0.08)" }}>
      <div
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg group cursor-pointer transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)] ${
          collapsed ? "justify-center" : ""
        }`}
      >
        {/* Avatar */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{
            background: "#FFFFFF",
            color: "#1A1A1A",
          }}
        >
          {initials}
        </div>

        {!collapsed && (
          <>
            <span className="text-xs truncate flex-1 min-w-0 font-medium" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
              {email.split("@")[0]}
            </span>
            <motion.button
              onClick={handleLogout}
              className="opacity-0 group-hover:opacity-100 transition-all duration-150 p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)]"
              title="Sign out"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="h-3.5 w-3.5" />
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
  const [isAIServiceActive, setIsAIServiceActive] = useState(false);

  // Simulate AI service activity (replace with real WebSocket/event later)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAIServiceActive(Math.random() > 0.7);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const sidebarContent = (
    <div
      className="flex h-full flex-col"
      style={{
        // Warm Grey Background with subtle gradient
        background: "linear-gradient(180deg, #1C1C1C 0%, #1A1A1A 100%)",
        borderRight: "0.5px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Logo + AI Alive Indicator + Collapse Toggle */}
      <div className={`relative flex items-center ${collapsed ? "justify-center px-2 py-5" : "justify-between px-4 py-5"}`}>
        {collapsed ? (
          <Link href="/dashboard" className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shrink-0" style={{ background: "#FFFFFF" }}>
            <Image src="/logo.png" alt="Inceptive" width={22} height={22} className="object-cover" />
            {isAIServiceActive && <AliveIndicator />}
          </Link>
        ) : (
          <Link href="/dashboard" className="relative flex items-center gap-3 px-1">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shrink-0" style={{ background: "#FFFFFF" }}>
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
              {isAIServiceActive && <AliveIndicator />}
            </div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              Inceptive
            </span>
          </Link>
        )}

        {/* Collapse Toggle */}
        {!collapsed && (
          <motion.button
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
            whileHover={{ background: "rgba(255, 255, 255, 0.06)", color: "#FFFFFF" }}
            whileTap={{ scale: 0.95 }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <PanelLeftClose className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bottom Section: Power Meter + Upgrade + Settings */}
      <div className="px-2 pb-2">
        {!collapsed && <PowerMeter />}
        {!collapsed && <UpgradeButton />}
        <NavItem
          item={bottomItems[1]}
          isActive={pathname === bottomItems[1].href}
          collapsed={collapsed}
        />
      </div>

      {/* User Profile */}
      <UserSection collapsed={collapsed} />
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <motion.button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderColor: "rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(20px)",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
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
              <X className="h-5 w-5" style={{ color: "#1A1A1A" }} />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
            >
              <Menu className="h-5 w-5" style={{ color: "#1A1A1A" }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(8px)" }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            className="fixed inset-y-0 left-0 z-40 w-[280px] md:hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30"
        style={{ overflow: "hidden" }}
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 100, damping: 20 }}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}
