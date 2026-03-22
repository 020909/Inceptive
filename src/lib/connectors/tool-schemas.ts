/**
 * AI Tool-Calling Schemas for all Inceptive connectors.
 * OpenAI-compatible format for use with the agent's tool calling system.
 *
 * These schemas enable the AI agent to call 6+ tools in parallel per thought step.
 */

export const CONNECTOR_TOOLS = [
  // ── Gmail ──────────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "gmail_send",
      description: "Send an email with full HTML body and optional attachments via Gmail. Inceptive does full read + write + send — not just read like Claude.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          html_body: { type: "string", description: "HTML email body content" },
        },
        required: ["to", "subject", "html_body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gmail_reply",
      description: "Reply to an existing email thread in Gmail",
      parameters: {
        type: "object",
        properties: {
          thread_id: { type: "string", description: "Gmail thread ID to reply to" },
          html_body: { type: "string", description: "HTML reply body" },
        },
        required: ["thread_id", "html_body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gmail_archive",
      description: "Archive an email (remove from inbox) in Gmail",
      parameters: {
        type: "object",
        properties: {
          message_id: { type: "string", description: "Gmail message ID to archive" },
        },
        required: ["message_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gmail_label",
      description: "Add labels to a Gmail message for organization",
      parameters: {
        type: "object",
        properties: {
          message_id: { type: "string", description: "Gmail message ID" },
          label_ids: { type: "array", items: { type: "string" }, description: "Label IDs to add" },
        },
        required: ["message_id", "label_ids"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gmail_draft",
      description: "Create a draft email in Gmail for review before sending",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject" },
          html_body: { type: "string", description: "HTML email body" },
        },
        required: ["to", "subject", "html_body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gmail_list",
      description: "List emails from Gmail inbox, optionally filtered by query",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Gmail search query (e.g. 'from:john subject:meeting')" },
          max_results: { type: "number", description: "Maximum emails to return (default 10)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "calendar_create_event",
      description: "Create a Google Calendar event with optional attendees",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title" },
          start: { type: "string", description: "Start datetime in ISO 8601 format" },
          end: { type: "string", description: "End datetime in ISO 8601 format" },
          attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses" },
        },
        required: ["summary", "start", "end"],
      },
    },
  },

  // ── Twitter / X ────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "twitter_post",
      description: "Post a tweet on X/Twitter",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Tweet text (max 280 characters)" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "twitter_reply",
      description: "Reply to a tweet on X/Twitter",
      parameters: {
        type: "object",
        properties: {
          tweet_id: { type: "string", description: "Tweet ID to reply to" },
          text: { type: "string", description: "Reply text" },
        },
        required: ["tweet_id", "text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "twitter_dm",
      description: "Send a direct message on X/Twitter",
      parameters: {
        type: "object",
        properties: {
          recipient_id: { type: "string", description: "Recipient user ID" },
          text: { type: "string", description: "Message text" },
        },
        required: ["recipient_id", "text"],
      },
    },
  },

  // ── LinkedIn ───────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "linkedin_post",
      description: "Create a post on LinkedIn",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Post content text" },
          media_url: { type: "string", description: "Optional image URL to attach" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "linkedin_share",
      description: "Share an article link on LinkedIn with commentary",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Commentary text" },
          article_url: { type: "string", description: "URL of article to share" },
        },
        required: ["text", "article_url"],
      },
    },
  },

  // ── Instagram ──────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "instagram_post",
      description: "Publish a photo post on Instagram with a caption",
      parameters: {
        type: "object",
        properties: {
          image_url: { type: "string", description: "Public URL of the image to post" },
          caption: { type: "string", description: "Post caption" },
        },
        required: ["image_url", "caption"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "instagram_story",
      description: "Create an Instagram Story from an image",
      parameters: {
        type: "object",
        properties: {
          image_url: { type: "string", description: "Public URL of the image for the story" },
        },
        required: ["image_url"],
      },
    },
  },

  // ── Telegram ───────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "telegram_message",
      description: "Send a message via Telegram bot",
      parameters: {
        type: "object",
        properties: {
          chat_id: { type: "string", description: "Telegram chat ID" },
          text: { type: "string", description: "Message text (HTML supported)" },
        },
        required: ["chat_id", "text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "telegram_photo",
      description: "Send a photo via Telegram bot",
      parameters: {
        type: "object",
        properties: {
          chat_id: { type: "string", description: "Telegram chat ID" },
          photo_url: { type: "string", description: "URL of the photo" },
          caption: { type: "string", description: "Photo caption" },
        },
        required: ["chat_id", "photo_url"],
      },
    },
  },

  // ── WhatsApp Business ──────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "whatsapp_message",
      description: "Send a WhatsApp message via Business API",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient phone number (with country code, e.g. +1234567890)" },
          text: { type: "string", description: "Message text" },
        },
        required: ["to", "text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "whatsapp_template",
      description: "Send a WhatsApp template message",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient phone number" },
          template_name: { type: "string", description: "Template name" },
          params: { type: "object", description: "Template parameters as key-value pairs" },
        },
        required: ["to", "template_name"],
      },
    },
  },
] as const;

export type ConnectorToolName = (typeof CONNECTOR_TOOLS)[number]["function"]["name"];
