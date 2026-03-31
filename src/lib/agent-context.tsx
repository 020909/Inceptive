"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "./auth-context";

export type AgentStatus = "active" | "sleeping" | "paused" | "working" | "error";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  dependencies?: string[];
  output?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "success" | "warning" | "error";
  message: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryItem {
  id: string;
  type: "preference" | "fact" | "task" | "file" | "conversation";
  content: string;
  timestamp: Date;
  confidence: number;
  source?: string;
}

interface AgentContextValue {
  // Status
  status: AgentStatus;
  setStatus: (status: AgentStatus) => void;

  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, "id">) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  getTask: (id: string) => Task | undefined;

  // Pause/Resume control (key differentiator)
  isPaused: boolean;
  pauseAgent: () => void;
  resumeAgent: () => void;
  requiresApproval: boolean;
  setRequiresApproval: (value: boolean) => void;
  approveNextStep: () => void;
  pendingApproval: Task | null;

  // Logs
  logs: LogEntry[];
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;

  // Memory
  memories: MemoryItem[];
  addMemory: (item: Omit<MemoryItem, "id" | "timestamp">) => void;
  searchMemory: (query: string) => MemoryItem[];

  // 24/7 Mode (key differentiator)
  is24_7Mode: boolean;
  toggle24_7Mode: () => void;
  lastActivity: Date;
  sleepAfterMinutes: number;
  setSleepAfterMinutes: (minutes: number) => void;

  // AI Personality Settings
  aiName: string;
  setAiName: (name: string) => void;
  aiPersonality: string;
  setAiPersonality: (personality: string) => void;
  aiTone: string;
  setAiTone: (tone: string) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Status
  const [status, setStatusState] = useState<AgentStatus>("sleeping");
  const [isPaused, setIsPaused] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<Task | null>(null);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Memory
  const [memories, setMemories] = useState<MemoryItem[]>([]);

  // 24/7 Mode
  const [is24_7Mode, setIs24_7Mode] = useState(false);
  const [lastActivity, setLastActivity] = useState(new Date());
  const [sleepAfterMinutes, setSleepAfterMinutes] = useState(5);

  // AI Personality
  const [aiName, setAiName] = useState("Inceptive");
  const [aiPersonality, setAiPersonality] = useState("Professional");
  const [aiTone, setAiTone] = useState("Helpful");

  const fullPrefsRef = useRef<any>({});
  const activityTimeoutRef = useRef<NodeJS.Timeout>(null);

  // Derived status based on state
  const setStatus = useCallback((newStatus: AgentStatus) => {
    if (isPaused && newStatus !== "error") {
      setStatusState("paused");
    } else {
      setStatusState(newStatus);
    }
  }, [isPaused]);

  // Update activity timestamp
  const updateActivity = useCallback(() => {
    setLastActivity(new Date());
    if (status === "sleeping") {
      setStatus("active");
    }
  }, [status, setStatus]);

  // Log management
  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newEntry: LogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setLogs(prev => [...prev.slice(-99), newEntry]); // Keep last 100 logs
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Auto-sleep logic for 24/7 mode
  useEffect(() => {
    if (!is24_7Mode) return;

    const checkSleep = () => {
      const minutesSinceActivity = (Date.now() - lastActivity.getTime()) / 60000;
      if (minutesSinceActivity >= sleepAfterMinutes && status === "active") {
        setStatus("sleeping");
        addLog({
          level: "info",
          message: `Agent entered sleep mode after ${sleepAfterMinutes} minutes of inactivity`,
        });
      }
    };

    const interval = setInterval(checkSleep, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [is24_7Mode, lastActivity, sleepAfterMinutes, status, setStatus, addLog]);

  // Task management
  const addTask = useCallback((task: Omit<Task, "id">) => {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = { ...task, id, startedAt: new Date() };
    setTasks(prev => [...prev, newTask]);

    addLog({
      level: "info",
      message: `Task created: ${task.title}`,
      taskId: id,
    });

    // If requires approval, set as pending
    if (requiresApproval && task.status === "pending") {
      setPendingApproval(newTask);
      setStatus("paused");
    }

    return id;
  }, [requiresApproval, addLog, setStatus]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    );

    if (updates.status === "completed") {
      addLog({
        level: "success",
        message: `Task completed: ${tasks.find(t => t.id === id)?.title}`,
        taskId: id,
      });
    } else if (updates.status === "failed") {
      addLog({
        level: "error",
        message: `Task failed: ${tasks.find(t => t.id === id)?.title}`,
        taskId: id,
      });
    }
  }, [tasks]);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTask = useCallback((id: string) => {
    return tasks.find(t => t.id === id);
  }, [tasks]);

  // Pause/Resume control - KEY DIFFERENTIATOR
  const pauseAgent = useCallback(() => {
    setIsPaused(true);
    setStatus("paused");
    addLog({
      level: "warning",
      message: "Agent paused by user",
    });
  }, [setStatus]);

  const resumeAgent = useCallback(() => {
    setIsPaused(false);
    setPendingApproval(null);
    setStatus("active");
    addLog({
      level: "success",
      message: "Agent resumed",
    });
  }, [setStatus]);

  const approveNextStep = useCallback(() => {
    if (pendingApproval) {
      updateTask(pendingApproval.id, { status: "running" });
      setPendingApproval(null);
      setIsPaused(false);
      setStatus("working");
    }
  }, [pendingApproval, updateTask, setStatus]);

  // Memory management
  const addMemory = useCallback((item: Omit<MemoryItem, "id" | "timestamp">) => {
    const newItem: MemoryItem = {
      ...item,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMemories(prev => [newItem, ...prev]);
  }, []);

  const searchMemory = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return memories.filter(m =>
      m.content.toLowerCase().includes(lowercaseQuery) ||
      m.type.toLowerCase().includes(lowercaseQuery)
    );
  }, [memories]);

  // 24/7 Mode toggle
  const toggle24_7Mode = useCallback(() => {
    setIs24_7Mode(prev => {
      const newValue = !prev;
      addLog({
        level: "info",
        message: newValue ? "24/7 mode enabled" : "24/7 mode disabled",
      });
      return newValue;
    });
  }, [addLog]);

  // Load user preferences from Supabase
  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("agent_preferences")
        .eq("id", user.id)
        .single();

      if (data?.agent_preferences) {
        const prefs = data.agent_preferences;
        fullPrefsRef.current = prefs;
        setIs24_7Mode(prefs.is24_7Mode ?? false);
        setRequiresApproval(prefs.requiresApproval ?? false);
        setSleepAfterMinutes(prefs.sleepAfterMinutes ?? 5);
        if (prefs.aiName) setAiName(prefs.aiName);
        if (prefs.aiPersonality) setAiPersonality(prefs.aiPersonality);
        if (prefs.aiTone) setAiTone(prefs.aiTone);
      }
    };

    loadPreferences();
  }, [user]);

  // Save preferences to Supabase
  useEffect(() => {
    if (!user) return;

    const savePreferences = async () => {
      const supabase = createClient();
      const updatedPrefs = {
        ...fullPrefsRef.current,
        is24_7Mode,
        requiresApproval,
        sleepAfterMinutes,
        aiName,
        aiPersonality,
        aiTone,
      };
      fullPrefsRef.current = updatedPrefs;
      
      await supabase
        .from("users")
        .update({ agent_preferences: updatedPrefs })
        .eq("id", user.id);
    };

    const timeout = setTimeout(savePreferences, 1000);
    return () => clearTimeout(timeout);
  }, [user, is24_7Mode, requiresApproval, sleepAfterMinutes, aiName, aiPersonality, aiTone]);

  const value: AgentContextValue = {
    status,
    setStatus,
    tasks,
    addTask,
    updateTask,
    removeTask,
    getTask,
    isPaused,
    pauseAgent,
    resumeAgent,
    requiresApproval,
    setRequiresApproval,
    approveNextStep,
    pendingApproval,
    logs,
    addLog,
    clearLogs,
    memories,
    addMemory,
    searchMemory,
    is24_7Mode,
    toggle24_7Mode,
    lastActivity,
    sleepAfterMinutes,
    setSleepAfterMinutes,
    aiName,
    setAiName,
    aiPersonality,
    setAiPersonality,
    aiTone,
    setAiTone,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within AgentProvider");
  }
  return context;
}
