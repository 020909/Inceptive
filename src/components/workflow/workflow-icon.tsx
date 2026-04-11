import {
  Clock,
  FileText,
  GitBranch,
  Globe,
  Mail,
  PenTool,
  Search,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Clock,
  FileText,
  GitBranch,
  Globe,
  Mail,
  PenTool,
  Search,
  Timer,
  Users,
};

export function getWorkflowNodeIcon(iconName: string) {
  return iconMap[iconName] ?? FileText;
}
