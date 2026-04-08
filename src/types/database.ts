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

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  template: string;
  status: "active" | "archived" | "deleted";
  github_repo: string | null;
  github_branch: string | null;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
  artifact_count?: number;
  latest_artifact_type?: string | null;
}

export interface ProjectArtifact {
  id: string;
  user_id: string;
  project_id: string;
  type: "website" | "image" | "powerpoint" | "excel" | "pdf" | "report" | "file" | "other";
  title: string;
  source: string;
  status: "draft" | "ready" | "archived";
  summary: string;
  content_text: string | null;
  content_json: Record<string, unknown> | null;
  file_name: string | null;
  mime_type: string | null;
  preview_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
