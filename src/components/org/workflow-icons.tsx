import {
  CalendarDays,
  FileBarChart,
  GitBranch,
  Inbox,
  Newspaper,
  Radar,
  Search,
  type LucideIcon,
} from "lucide-react";

const workflowIcons: Record<string, LucideIcon> = {
  CalendarDays,
  FileBarChart,
  GitBranch,
  Inbox,
  Newspaper,
  Radar,
  Search,
};

export function getWorkflowIcon(iconName: string): LucideIcon {
  return workflowIcons[iconName] ?? GitBranch;
}
