"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, CheckCircle2, Zap } from "lucide-react";
import type { TaskLog } from "./LiveTaskFeed";

export default function MorningBriefing() {
  const { session, user } = useAuth();
  const [show, setShow] = useState(false);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);

  const checkBriefingVisibility = useCallback(() => {
    // If not authenticated, do not show
    if (!session?.access_token) return false;

    const now = Date.now();
    const lastActiveStr = localStorage.getItem("inceptive_last_active") || "0";
    const lastDismissedStr = localStorage.getItem("inceptive_briefing_dismissed") || "0";
    
    const lastActive = parseInt(lastActiveStr, 10);
    const lastDismissed = parseInt(lastDismissedStr, 10);

    const isOfflineForLongTime = (now - lastActive) > 4 * 60 * 60 * 1000; // >4 hours
    const dismissedRecently = (now - lastDismissed) < 4 * 60 * 60 * 1000; // dismissed within last 4h
    const isActivelyShowing = localStorage.getItem("inceptive_briefing_active") === "true";

    // Show if offline for a long time and not dismissed recently
    // OR if we already decided to show it during this session and haven't dismissed it
    if ((isOfflineForLongTime || isActivelyShowing) && !dismissedRecently) {
      // Mark it active so refreshing keeps it visible until dismissed
      localStorage.setItem("inceptive_briefing_active", "true");
      return true;
    }

    return false;
  }, [session?.access_token]);

  useEffect(() => {
    // Determine visibility
    if (checkBriefingVisibility()) {
      setShow(true);
      fetchBriefingLogs();
    } else {
      setLoading(false);
    }

    // Keep activity tracker updated
    const now = Date.now().toString();
    // Only update last_active if briefing isn't currently showing to prevent 
    // it from immediately failing the check on refresh.
    // Actually, setting last_active is fine because we set briefing_active = true
    localStorage.setItem("inceptive_last_active", now);
    
    const interval = setInterval(() => {
      localStorage.setItem("inceptive_last_active", Date.now().toString());
    }, 60000);

    return () => clearInterval(interval);
  }, [checkBriefingVisibility]);

  const fetchBriefingLogs = async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      const res = await fetch("/api/task-logs?briefing=true", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.error("Briefing logs fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    // Remember we dismissed it to prevent it re-appearing upon refresh
    localStorage.setItem("inceptive_briefing_dismissed", Date.now().toString());
    localStorage.setItem("inceptive_briefing_active", "false");
  };

  if (!show) return null;

  const firstName = user?.email?.split("@")[0] || "there";
  
  // Calculate stats
  // We use only "done" stats for completed tasks in the summary
  const completedTasks = logs.filter(l => l.status === "done").length;
  // Get unique distinct actions to show as bullet points
  const bulletPoints = Array.from(new Set(logs.map(l => l.action))).slice(0, 5);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98, translateY: -10 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full mb-6 relative"
      >
        <div 
          className="rounded-2xl border overflow-hidden p-[1px]"
          style={{
            background: "linear-gradient(135deg, var(--accent-soft) 0%, rgba(255,255,255,0.02) 100%)",
            borderColor: "var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)"
          }}
        >
          <div 
            className="rounded-[15px] p-6 sm:p-7 relative"
            style={{ background: "var(--background-elevated)" }}
          >
            {/* Close Button */}
            <button 
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--foreground-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--background-overlay)] transition-colors"
              title="Dismiss Briefing"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col sm:flex-row gap-6">
              
              {/* Left Column: Avatar & Greeting */}
              <div className="flex flex-col items-center sm:items-start shrink-0">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border overflow-hidden"
                  style={{ background: "var(--background)", borderColor: "var(--border-subtle)" }}
                >
                  <img src="/logo.png" alt="Inceptive Agent" className="w-10 h-10 object-contain" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--fg-primary)] max-w-[200px] leading-tight text-center sm:text-left">
                  Good morning, {firstName}! 
                  <span className="block text-lg text-[var(--foreground-secondary)] mt-1 font-medium">
                    Here&apos;s what I did while you slept 🔥
                  </span>
                </h2>
              </div>

              {/* Right Column: Bullets & Stats */}
              <div className="flex-1 border-t sm:border-t-0 sm:border-l pt-5 sm:pt-0 sm:pl-8" style={{ borderColor: "var(--border-subtle)" }}>
                
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 bg-[var(--card-hover)] rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-[var(--card-hover)] rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-[var(--card-hover)] rounded animate-pulse" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center sm:items-start justify-center h-full space-y-2 py-2">
                    <div className="flex items-center gap-2 text-[var(--foreground-secondary)]">
                      <Zap className="w-4 h-4" />
                      <span className="text-sm font-medium">I was quiet last night — ready for your next goal?</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Bullet Points */}
                    <ul className="space-y-2.5">
                      {bulletPoints.map((action, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--foreground-secondary)]">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 text-[var(--fg-primary)] shrink-0" />
                          <span className="leading-snug">{action}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Simple Stats & Action */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-[var(--fg-primary)]" />
                          <span className="text-sm font-semibold text-[var(--fg-primary)]">
                            {completedTasks} tasks completed
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={handleDismiss} 
                        className="text-[11px] uppercase tracking-wider font-bold text-[var(--foreground-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
