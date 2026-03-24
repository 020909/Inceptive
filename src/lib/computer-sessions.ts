"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "./supabase";

export interface ComputerSession {
  id: string;
  sessionId: string;
  status: "active" | "paused" | "closed";
  currentUrl?: string;
  pageTitle?: string;
  viewport: { width: number; height: number };
  createdAt: Date;
  lastActivity: Date;
}

export interface ComputerAction {
  id: string;
  actionType: string;
  actionData: Record<string, any>;
  screenshotId?: string;
  screenshotUrl?: string;
  visionSummary?: string;
  createdAt: Date;
}

export interface LiveScreenshot {
  id: string;
  url: string;
  visionSummary?: string;
  timestamp: Date;
}

// Hook for managing computer sessions
export function useComputerSessions() {
  const [sessions, setSessions] = useState<ComputerSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ComputerSession | null>(null);
  const [actions, setActions] = useState<ComputerAction[]>([]);
  const [latestScreenshot, setLatestScreenshot] = useState<LiveScreenshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // List user's active sessions
  const listSessions = useCallback(async (): Promise<ComputerSession[]> => {
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const res = await fetch("/api/computer/sessions", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to list sessions");
      }

      const data = await res.json();
      const sessions = data.sessions.map((s: any) => ({
        id: s.id,
        sessionId: s.session_id,
        status: s.status,
        currentUrl: s.current_url,
        pageTitle: s.page_title,
        viewport: s.viewport,
        createdAt: new Date(s.created_at),
        lastActivity: new Date(s.last_activity),
      }));

      setSessions(sessions);
      return sessions;
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  // Get session activity (actions + screenshots)
  const getSessionActivity = useCallback(
    async (sessionId: string = "default", limit: number = 20): Promise<ComputerAction[]> => {
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return [];

        const res = await fetch(
          `/api/computer/activity?session=${sessionId}&limit=${limit}`,
          {
            headers: { Authorization: `Bearer ${session.session.access_token}` },
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to get activity");
        }

        const data = await res.json();
        const actions = data.actions.map((a: any) => ({
          id: a.action_id,
          actionType: a.action_type,
          actionData: a.action_data,
          screenshotId: a.screenshot_id,
          screenshotUrl: a.screenshot_url,
          visionSummary: a.vision_summary,
          createdAt: new Date(a.created_at),
        }));

        setActions(actions);

        // Set latest screenshot if available
        const latestWithScreenshot = actions.find((a: ComputerAction) => a.screenshotUrl);
        if (latestWithScreenshot) {
          setLatestScreenshot({
            id: latestWithScreenshot.screenshotId!,
            url: latestWithScreenshot.screenshotUrl!,
            visionSummary: latestWithScreenshot.visionSummary,
            timestamp: latestWithScreenshot.createdAt,
          });
        }

        return actions;
      } catch (err: any) {
        setError(err.message);
        return [];
      }
    },
    []
  );

  // Start polling for live updates
  const startLiveUpdates = useCallback(
    (sessionId: string = "default", intervalMs: number = 2000) => {
      // Clear existing poll
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }

      // Initial fetch
      getSessionActivity(sessionId);

      // Set up polling
      pollRef.current = setInterval(() => {
        getSessionActivity(sessionId);
      }, intervalMs);
    },
    [getSessionActivity]
  );

  // Stop polling
  const stopLiveUpdates = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Execute computer action
  const executeAction = useCallback(
    async (
      action: string,
      params: Record<string, any>,
      sessionId: string = "default"
    ): Promise<{ success: boolean; screenshot?: string; vision?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) throw new Error("Not authenticated");

        const res = await fetch("/api/computer/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            action,
            params,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Action failed");
        }

        const data = await res.json();

        // Refresh activity
        await getSessionActivity(sessionId);

        return {
          success: true,
          screenshot: data.screenshot,
          vision: data.vision,
        };
      } catch (err: any) {
        setError(err.message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [getSessionActivity]
  );

  // Close session
  const closeSession = useCallback(async (sessionId: string = "default") => {
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return false;

      const res = await fetch(`/api/computer/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to close session");

      setCurrentSession(null);
      setActions([]);
      setLatestScreenshot(null);
      stopLiveUpdates();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [stopLiveUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  return {
    sessions,
    currentSession,
    actions,
    latestScreenshot,
    loading,
    error,
    listSessions,
    getSessionActivity,
    startLiveUpdates,
    stopLiveUpdates,
    executeAction,
    closeSession,
  };
}
