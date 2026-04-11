export const NODE_TYPES_CONFIG = {
  trigger: {
    label: "Schedule Trigger",
    description: "When should this workflow run?",
    icon: "Clock",
    color: "#ffffff",
    options: [
      "Every night at 11pm",
      "Every morning at 6am",
      "Every Monday",
      "When new email arrives",
      "Manual only",
    ],
  },
  email_agent: {
    label: "Email Agent",
    description: "Read, draft, prioritize, and send emails",
    icon: "Mail",
    color: "#ffffff",
    config_fields: ["action", "filter_by", "draft_style"],
  },
  research_agent: {
    label: "Research Agent",
    description: "Search the web and compile intelligence reports",
    icon: "Search",
    color: "#ffffff",
    config_fields: ["topic", "sources", "output_format"],
  },
  lead_agent: {
    label: "Lead Gen Agent",
    description: "Find and qualify potential customers",
    icon: "Users",
    color: "#ffffff",
    config_fields: ["industry", "company_size", "location", "count"],
  },
  browser_agent: {
    label: "Browser Agent",
    description: "Control a browser to automate web tasks",
    icon: "Globe",
    color: "#ffffff",
    config_fields: ["task", "target_url"],
  },
  content_agent: {
    label: "Content Agent",
    description: "Write posts, reports, and marketing copy",
    icon: "PenTool",
    color: "#ffffff",
    config_fields: ["content_type", "platform", "tone", "topic"],
  },
  report_agent: {
    label: "Report Agent",
    description: "Compile results and send a summary report",
    icon: "FileText",
    color: "#ffffff",
    config_fields: ["format", "send_to", "include_sections"],
  },
  condition: {
    label: "Condition",
    description: "Branch the workflow based on a rule",
    icon: "GitBranch",
    color: "#ffffff",
    config_fields: ["condition_type", "value", "operator"],
  },
  wait: {
    label: "Wait",
    description: "Pause before the next step",
    icon: "Timer",
    color: "#ffffff",
    config_fields: ["duration", "unit"],
  },
} as const;

export type WorkflowNodeType = keyof typeof NODE_TYPES_CONFIG;

export type WorkflowNodeData = {
  typeKey: WorkflowNodeType;
  label: string;
  description: string;
  configured: boolean;
  config: Record<string, unknown>;
};

export const NODE_GROUPS: Array<{
  title: string;
  items: WorkflowNodeType[];
}> = [
  { title: "Triggers", items: ["trigger"] },
  {
    title: "Agents",
    items: [
      "email_agent",
      "research_agent",
      "lead_agent",
      "browser_agent",
      "content_agent",
      "report_agent",
    ],
  },
  { title: "Logic", items: ["condition", "wait"] },
];
