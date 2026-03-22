"use client";

/**
 * ChatContext — persists the active chat across navigation.
 *
 * Storage strategy:
 *   • sessionStorage keeps the CURRENT chat alive for the whole browser tab,
 *     so navigating to Goals/Reports and back never loses the conversation.
 *   • When memory is ON  → completed sessions are saved to Supabase.
 *   • When memory is OFF → completed sessions are kept only in sessionStorage
 *     for the tab's lifetime (cleared on tab close).
 *   • "New Task" explicitly archives the current chat and starts fresh.
 *
 * Title generation: first non-empty user message, trimmed to 60 chars.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Session } from "@supabase/supabase-js";

/* ─── types ─── */
export type ToolCall = { toolName: string; args: any; toolCallId: string };
export type ToolResult = { toolName: string; result: any; toolCallId: string };

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
};

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number; // unix ms
};

type ChatContextValue = {
  /* active chat */
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;

  /* session management */
  startNewChat: () => Promise<void>;   // archive current, start fresh
  loadChat: (session: ChatSession) => void;

  /* recent chats */
  recentChats: ChatSession[];
  recentLoading: boolean;
  refreshRecents: () => Promise<void>;

  /* memory setting */
  memoryEnabled: boolean;
  setMemoryEnabled: (v: boolean) => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const SESSION_KEY = "inceptive_current_chat";   // current live chat
const RECENTS_KEY = "inceptive_recent_chats";   // local recents (memory OFF)

/* ─── helpers ─── */
function makeTitle(msgs: Message[]): string {
  const first = msgs.find((m) => m.role === "user" && m.content.trim());
  if (!first) return "New Chat";
  return first.content.trim().slice(0, 60) + (first.content.length > 60 ? "…" : "");
}

function loadFromSession(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Strip ghost assistant messages (empty content from old broken sessions)
    return parsed.filter(
      (m: Message) => m.role === "user" || (m.role === "assistant" && m.content?.trim())
    );
  } catch {
    return [];
  }
}

function saveToSession(msgs: Message[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs));
  } catch {}
}

function loadLocalRecents(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalRecent(session: ChatSession) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadLocalRecents();
    const updated = [session, ...existing.filter((s) => s.id !== session.id)].slice(0, 5);
    sessionStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  } catch {}
}

/* ─── provider ─── */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { session, refresh: refreshAuth } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [recentChats, setRecentChats] = useState<ChatSession[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [memoryEnabled, setMemoryEnabledState] = useState(false);
  const initRef = useRef(false);

  /* ── on mount: restore current chat + fetch memory setting ── */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Restore current chat from sessionStorage
    const saved = loadFromSession();
    if (saved.length > 0) setMessages(saved);

    // Get access token + memory setting from Supabase
    const init = async () => {
      try {
        if (!session?.access_token) return;

        // Fetch memory setting
        const supabase = createClient();
        const { data } = await supabase
          .from("users")
          .select("memory_enabled")
          .eq("id", session.user.id)
          .single();
        const enabled = (data as any)?.memory_enabled ?? false;
        setMemoryEnabledState(enabled);
      } catch {}
    };
    init();
  }, []);

  /* ── persist messages to sessionStorage on every change ── */
  useEffect(() => {
    saveToSession(messages);
  }, [messages]);

  /* ── load recent chats ── */
  const refreshRecents = useCallback(async () => {
    setRecentLoading(true);
    try {
      if (memoryEnabled && session?.access_token) {
        const res = await fetch("/api/chat", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const { sessions } = await res.json();
          setRecentChats(
            (sessions || []).map((s: any) => ({
              id: s.id,
              title: s.title,
              messages: s.messages || [],
              createdAt: new Date(s.created_at).getTime(),
            }))
          );
          return;
        }
      }
      // Fallback: session-only recents
      setRecentChats(loadLocalRecents());
    } catch {
      setRecentChats(loadLocalRecents());
    } finally {
      setRecentLoading(false);
    }
  }, [memoryEnabled, session]);

  /* load recents once auth + memory setting are known */
  useEffect(() => {
    if (session?.access_token) refreshRecents();
  }, [session, memoryEnabled, refreshRecents]);

  /* ── archive current chat and start fresh ── */
  const startNewChat = useCallback(async () => {
    const currentMsgs = messages;
    // Only save if there's at least one user message
    const hasContent = currentMsgs.some((m) => m.role === "user" && m.content.trim());

    if (hasContent) {
      const chatSession: ChatSession = {
        id: `local_${Date.now()}`,
        title: makeTitle(currentMsgs),
        messages: currentMsgs,
        createdAt: Date.now(),
      };

      if (memoryEnabled && session?.access_token) {
        // Save to Supabase
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              title: chatSession.title,
              messages: currentMsgs,
            }),
          });
          if (res.ok) {
            const { id } = await res.json();
            chatSession.id = id;
          }
        } catch {}
      }

      // Always save locally too so Recents is available immediately
      saveLocalRecent(chatSession);
    }

    // Clear current chat
    setMessages([]);
    sessionStorage.removeItem(SESSION_KEY);
    await refreshRecents();
  }, [messages, memoryEnabled, session, refreshRecents]);

  /* ── load a past chat ── */
  const loadChat = useCallback((session: ChatSession) => {
    setMessages(session.messages);
    saveToSession(session.messages);
  }, []);

  /* ── toggle memory setting ── */
  const setMemoryEnabled = useCallback(async (enabled: boolean) => {
    setMemoryEnabledState(enabled);
    if (!session?.access_token) return;
    try {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ memory_enabled: enabled }),
      });
    } catch {}
  }, [session]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        startNewChat,
        loadChat,
        recentChats,
        recentLoading,
        refreshRecents,
        memoryEnabled,
        setMemoryEnabled,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
