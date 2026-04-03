import type { AgentRole, AgentStatus } from "./council-types";

/** User-facing status lines for the live preview panel — tied to real Council events */
export function councilPhaseLabel(
  agentRole: AgentRole,
  agentName: string,
  status: AgentStatus
): string {
  const thinking: Partial<Record<AgentRole, string>> = {
    planner: "Planning scope, requirements, and milestones…",
    architect: "Defining architecture and data flow…",
    "ux-designer": "Designing layout, typography, and high-end UI…",
    coder: "Writing and refining production code…",
    critic: "Reviewing code for bugs, security, and quality…",
    tester: "Stress-testing scenarios and edge cases…",
    "doc-specialist": "Drafting documentation and structure…",
    "visual-polish": "Applying visual polish and micro-interactions…",
    deployer: "Checking deployment and production readiness…",
    orchestrator: "Running final synthesis and merge…",
  };
  if (status === "thinking") {
    return thinking[agentRole] ?? `${agentName} is working…`;
  }
  if (status === "done") {
    return `${agentName} finished — continuing pipeline…`;
  }
  if (status === "error") {
    return `${agentName} encountered an issue — continuing with fallbacks…`;
  }
  /* idle */
  return `${agentName}…`;
}
