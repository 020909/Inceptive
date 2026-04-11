import { AppShell } from "@/components/layout/app-shell";
import { BrowserAgentConsole } from "@/components/browser-agent/browser-agent-console";

export default function BrowserAgentPage() {
  return (
    <AppShell>
      <BrowserAgentConsole />
    </AppShell>
  );
}
