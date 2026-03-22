import type { ComputerUseConnector } from "./types";

/**
 * Placeholder for Claude Computer Use / VM sandbox — no real desktop control yet.
 */
export const computerUseConnector: ComputerUseConnector = {
  id: "computer_use",
  async describeAction(instruction: string) {
    return {
      sandbox: true,
      plan: [
        "Validate instruction against user allowlist (not implemented).",
        "Launch isolated browser VM or OS container (not implemented).",
        `Would interpret: ${instruction.slice(0, 200)}`,
        "Capture screenshot + DOM snapshot for audit log (not implemented).",
        "Return structured result to orchestrator for reflection step.",
      ],
    };
  },
};
