import type { AgentContribution } from "./council-types";

/** Stream payload for `7:` — client adds "Something else" and focuses the chat input. */
export type CouncilClarificationPayload = {
  type: "clarification";
  headline: string;
  /** 2–4 fixed choices (server); UI appends "Something else" */
  choices: string[];
};

/** Stream payload for `8:` — client sends back on the next message to continue Council. */
export type CouncilResumePayload = {
  type: "council_resume";
  task: string;
  accumulatedContext: string;
  contributions: AgentContribution[];
};

export function defaultAfterPlannerClarification(): Pick<CouncilClarificationPayload, "headline" | "choices"> {
  return {
    headline: "Before design & code — theme preference",
    choices: ["Light mode", "Dark mode only", "Match system theme", "Editorial dark (warm neutrals)"],
  };
}
