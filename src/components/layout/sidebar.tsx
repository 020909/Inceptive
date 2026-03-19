"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { useChat } from "@/lib/chat-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Mail, Search, Share2, Target,
  FileBarChart, Settings, Menu, X, LogOut,
  PanelLeftClose, PanelLeftOpen,
  Plus, ChevronDown, Clock, MessageSquare, Zap,
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
  { label: "Upgrade", href: "/upgrade", icon: Zap },
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
    <div className="px-2 pb-3 pt-2 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
      <div className={`flex items-center gap-2.5 px-2 py-2 rounded-lg group transition-colors duration-150 hover:bg-[var(--background-elevated)] ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[var(--foreground)]"
          style={{ background: "rgba(255,255,255,0.15)" }}>
          {initials}
        </div>
        {!collapsed && (
          <span className="text-xs truncate flex-1 min-w-0" style={{ color: "var(--foreground-secondary)" }}>{email}</span>
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
      style={{ color: isActive ? "var(--sidebar-foreground)" : "var(--foreground)", background: isActive ? "var(--background-overlay)" : "transparent", justifyContent: collapsed ? "center" : "flex-start" }}>
      {isActive && (
        <motion.div layoutId="sidebar-active-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[var(--foreground)]"
          transition={{ type: "spring", stiffness: 400, damping: 35 }} />
      )}
      <Icon className="shrink-0 transition-colors duration-150" style={{ width: 17, height: 17, color: "var(--foreground)" }} />
      {!collapsed && (
        <span className="transition-colors duration-150 whitespace-nowrap" style={{ color: "var(--foreground)" }}>{item.label}</span>
      )}
      {!isActive && (
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: "var(--background-elevated)", zIndex: -1 }} />
      )}
    </Link>
  );
}

/* ── Recents dropdown ── */
function RecentsItem({ collapsed, onMobileClose }: { collapsed: boolean; onMobileClose: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { recentChats, recentLoading, loadChat, refreshRecents } = useChat();

  const handleOpen = async () => {
    if (!open) await refreshRecents();
    setOpen((v) => !v);
  };

  const handleLoadChat = (session: typeof recentChats[0]) => {
    loadChat(session);
    router.push("/dashboard");
    setOpen(false);
    onMobileClose();
  };

  if (collapsed) {
    return (
      <button
        title="Recents"
        onClick={handleOpen}
        className="relative flex items-center justify-center w-full px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group"
        style={{ color: "var(--foreground)" }}
      >
        <Clock style={{ width: 17, height: 17, color: "var(--foreground)" }} />
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: "var(--background-elevated)", zIndex: -1 }} />
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleOpen}
        className="relative flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group overflow-hidden"
        style={{ color: "var(--foreground)" }}
      >
        <Clock style={{ width: 17, height: 17, color: "var(--foreground)", flexShrink: 0 }} />
        <span className="flex-1 text-left whitespace-nowrap" style={{ color: "var(--foreground)" }}>Recents</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown style={{ width: 14, height: 14, color: "var(--foreground-secondary)" }} />
        </motion.div>
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: "var(--background-elevated)", zIndex: -1 }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="recents-dropdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="ml-2 mt-0.5 space-y-0.5 pb-1">
              {recentLoading ? (
                <div className="px-2 py-2 space-y-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-6 rounded-md shimmer" />
                  ))}
                </div>
              ) : recentChats.length === 0 ? (
                <div className="px-3 py-2.5 rounded-lg" style={{ background: "var(--background-elevated)" }}>
                  <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>No recent chats yet</p>
                </div>
              ) : (
                recentChats.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleLoadChat(session)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150 group/item"
                    style={{ color: "var(--foreground-secondary)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--background-elevated)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <MessageSquare style={{ width: 13, height: 13, flexShrink: 0, color: "var(--foreground-secondary)" }} />
                    <span className="text-xs truncate flex-1" style={{ color: "var(--foreground)" }}>
                      {session.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── New Task button ── */
function NewTaskButton({ collapsed, onMobileClose }: { collapsed: boolean; onMobileClose: () => void }) {
  const router = useRouter();
  const { startNewChat } = useChat();
  const [loading, setLoading] = useState(false);

  const handleNewTask = async () => {
    setLoading(true);
    await startNewChat();
    router.push("/dashboard");
    onMobileClose();
    setLoading(false);
  };

  if (collapsed) {
    return (
      <button
        onClick={handleNewTask}
        title="New Task"
        disabled={loading}
        className="flex items-center justify-center w-full px-2 py-2 rounded-lg transition-all duration-150 group"
        style={{ background: "var(--foreground)", color: "var(--background)" }}
      >
        <Plus style={{ width: 16, height: 16 }} />
      </button>
    );
  }

  return (
    <button
      onClick={handleNewTask}
      disabled={loading}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-85"
      style={{ background: "var(--foreground)", color: "var(--background)" }}
    >
      <Plus style={{ width: 15, height: 15, flexShrink: 0 }} />
      <span>New Task</span>
    </button>
  );
}

/* ── Credits widget (shown in sidebar when expanded) ── */
function CreditsWidget() {
  const [info, setInfo] = useState<{ remaining: number; total: number; plan: string } | null>(null);

  React.useEffect(() => {
    fetch("/api/credits")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setInfo({ remaining: d.credits?.remaining ?? 0, total: d.credits?.total ?? 100, plan: d.plan ?? "free" });
      })
      .catch(() => {});
  }, []);

  if (!info || info.plan === "basic") return null; // basic = BYOK, no credit tracking

  const pct = info.total > 0 ? Math.round((info.remaining / info.total) * 100) : 0;
  const color = pct > 50 ? "#30D158" : pct > 20 ? "#FF9F0A" : "#FF453A";

  return (
    <Link href="/upgrade" className="block mx-0.5 mb-1 px-3 py-2.5 rounded-xl border group transition-colors duration-150"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border-subtle)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-subtle)"; }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-[var(--foreground-secondary)] font-medium uppercase tracking-wider">Credits</span>
        <span className="text-[10px] font-semibold" style={{ color }}>{info.remaining.toLocaleString()}</span>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--background-overlay)" }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-[9px] text-[var(--foreground-tertiary)] mt-1.5">
        {info.plan === "free" ? "Free · resets daily" : `${info.plan} plan`}
        {" · "}
        <span className="text-[var(--foreground-secondary)] group-hover:text-white transition-colors">Upgrade →</span>
      </p>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col" style={{ background: "var(--sidebar)" }}>
      {/* Logo + collapse toggle */}
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

      {/* New Task button — above Dashboard */}
      <div className="px-4 mb-2">
        <NewTaskButton collapsed={collapsed} onMobileClose={() => setMobileOpen(false)} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item, idx) => (
          <React.Fragment key={item.href}>
            <NavItem
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
              onClick={() => setMobileOpen(false)}
            />
            {/* Insert Recents after Reports (index 5) */}
            {idx === 5 && (
              <RecentsItem collapsed={collapsed} onMobileClose={() => setMobileOpen(false)} />
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Bottom: Upgrade + Settings */}
      <div className="px-2 py-1 space-y-0.5 mb-1">
        {!collapsed && <CreditsWidget />}
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
        className="fixed top-4 left-4 z-50 md:hidden flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-150"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }} aria-label="Toggle navigation">
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
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r z-30"
        style={{ borderColor: "var(--sidebar-border)", overflow: "hidden" }}
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}
