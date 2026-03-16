export interface User {
  id: string;
  email: string;
  created_at: string;
  wake_time: string | null;
  timezone: string | null;
  api_key_encrypted: string | null;
  api_provider: "claude" | "openai" | "gemini" | null;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "paused";
  progress_percent: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  completed_at: string | null;
  type: "research" | "email" | "social" | "browser" | "general";
  notes: string | null;
}

export interface Email {
  id: string;
  user_id: string;
  recipient: string;
  subject: string;
  body: string;
  sent_at: string | null;
  status: "sent" | "draft" | "pending";
}

export interface ResearchReport {
  id: string;
  user_id: string;
  topic: string;
  content: string;
  sources_count: number;
  created_at: string;
}

export interface SocialPost {
  id: string;
  user_id: string;
  platform: "x" | "linkedin" | "instagram";
  content: string;
  scheduled_at: string | null;
  published_at: string | null;
  status: "scheduled" | "published" | "draft";
}

export interface WeeklyReport {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  hours_worked: number;
  tasks_completed: number;
  emails_sent: number;
  goals_active: number;
  report_json: Record<string, unknown>;
}
