/**
 * Connector contracts for Inceptive — full read + write + send on every platform.
 * OAuth-backed connectors read tokens from `connected_accounts` in route handlers / workers.
 */

export type ConnectorId =
  | "browser"
  | "gmail"
  | "gmail_full"
  | "slack"
  | "computer_use"
  | "twitter"
  | "linkedin"
  | "instagram"
  | "telegram"
  | "whatsapp";

export interface ConnectorContext {
  userId: string;
  accessToken?: string; // OAuth access token from connected_accounts
}

export interface ConnectorHealth {
  ok: boolean;
  detail?: string;
}

// ── Browser ──────────────────────────────────────────────────

export interface BrowserConnector {
  id: "browser";
  search: (query: string) => Promise<string>;
  fetchPage: (url: string) => Promise<string>;
}

// ── Gmail (basic link check — legacy) ────────────────────────

export interface GmailConnector {
  id: "gmail";
  isLinked: (ctx: ConnectorContext) => Promise<boolean>;
}

// ── Gmail Full (read + write + send + calendar) ──────────────

export interface GmailFullConnector {
  id: "gmail_full";
  sendEmail: (ctx: ConnectorContext, to: string, subject: string, htmlBody: string, attachments?: Buffer[]) => Promise<{ messageId: string }>;
  replyToEmail: (ctx: ConnectorContext, threadId: string, htmlBody: string) => Promise<{ messageId: string }>;
  archiveEmail: (ctx: ConnectorContext, messageId: string) => Promise<{ success: boolean }>;
  labelEmail: (ctx: ConnectorContext, messageId: string, labelIds: string[]) => Promise<{ success: boolean }>;
  draftEmail: (ctx: ConnectorContext, to: string, subject: string, htmlBody: string) => Promise<{ draftId: string }>;
  createCalendarEvent: (ctx: ConnectorContext, summary: string, start: string, end: string, attendees?: string[]) => Promise<{ eventId: string }>;
  listEmails: (ctx: ConnectorContext, query?: string, maxResults?: number) => Promise<{ emails: Array<{ id: string; subject: string; from: string; snippet: string; date: string }> }>;
}

// ── Slack ─────────────────────────────────────────────────────

export interface SlackConnector {
  id: "slack";
  postMessage: (text: string) => Promise<{ ok: boolean; error?: string }>;
}

// ── Computer Use ──────────────────────────────────────────────

export interface ComputerUseConnector {
  id: "computer_use";
  describeAction: (instruction: string) => Promise<{ plan: string[]; sandbox: boolean }>;
}

// ── Twitter / X ──────────────────────────────────────────────

export interface TwitterConnector {
  id: "twitter";
  postTweet: (ctx: ConnectorContext, text: string, mediaUrls?: string[]) => Promise<{ tweetId: string }>;
  replyToTweet: (ctx: ConnectorContext, tweetId: string, text: string) => Promise<{ tweetId: string }>;
  sendDM: (ctx: ConnectorContext, recipientId: string, text: string) => Promise<{ success: boolean }>;
  getTimeline: (ctx: ConnectorContext, maxResults?: number) => Promise<{ tweets: Array<{ id: string; text: string; author: string }> }>;
}

// ── LinkedIn ──────────────────────────────────────────────────

export interface LinkedInConnector {
  id: "linkedin";
  createPost: (ctx: ConnectorContext, text: string, mediaUrl?: string) => Promise<{ postId: string }>;
  shareUpdate: (ctx: ConnectorContext, text: string, articleUrl?: string) => Promise<{ shareId: string }>;
  getProfile: (ctx: ConnectorContext) => Promise<{ name: string; headline: string; profileUrl: string }>;
}

// ── Instagram ────────────────────────────────────────────────

export interface InstagramConnector {
  id: "instagram";
  publishPost: (ctx: ConnectorContext, imageUrl: string, caption: string) => Promise<{ postId: string }>;
  createStory: (ctx: ConnectorContext, imageUrl: string) => Promise<{ storyId: string }>;
  getInsights: (ctx: ConnectorContext) => Promise<{ followers: number; engagement: number }>;
}

// ── Telegram ──────────────────────────────────────────────────

export interface TelegramConnector {
  id: "telegram";
  sendMessage: (ctx: ConnectorContext, chatId: string, text: string) => Promise<{ messageId: number }>;
  sendPhoto: (ctx: ConnectorContext, chatId: string, photoUrl: string, caption?: string) => Promise<{ messageId: number }>;
  getUpdates: (ctx: ConnectorContext) => Promise<{ updates: Array<{ id: number; message: string; from: string }> }>;
}

// ── WhatsApp Business ─────────────────────────────────────────

export interface WhatsAppConnector {
  id: "whatsapp";
  sendMessage: (ctx: ConnectorContext, to: string, text: string) => Promise<{ messageId: string }>;
  sendTemplate: (ctx: ConnectorContext, to: string, templateName: string, params: Record<string, string>) => Promise<{ messageId: string }>;
}

// ── Union type ────────────────────────────────────────────────

export type AnyConnector =
  | BrowserConnector
  | GmailConnector
  | GmailFullConnector
  | SlackConnector
  | ComputerUseConnector
  | TwitterConnector
  | LinkedInConnector
  | InstagramConnector
  | TelegramConnector
  | WhatsAppConnector;
