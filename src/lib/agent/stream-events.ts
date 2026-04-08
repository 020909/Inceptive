type TaskLogStatus = "running" | "done" | "error";

export const TOOL_DISPLAY: Record<string, { icon: string; label: (args: any) => string }> = {
  searchWeb:           { icon: "", label: () => "Searching the web..." },
  deepResearch:        { icon: "", label: () => "Running deep research..." },
  browseURL:           { icon: "", label: () => "Reading webpage..." },
  summarizeURL:        { icon: "📋", label: () => "Summarizing URL content..." },
  getWeather:          { icon: "", label: () => "Checking weather..." },
  getStockQuote:       { icon: "", label: () => "Fetching stock price..." },
  getNewsHeadlines:    { icon: "", label: () => "Fetching latest news..." },
  computerUse:         { icon: "", label: () => "Using the browser..." },
  readGmail:           { icon: "", label: () => "Scanning Gmail inbox..." },
  summarizeEmail:      { icon: "", label: () => "Reading email..." },
  sendGmail:           { icon: "", label: () => "Sending email..." },
  draftEmail:          { icon: "", label: () => "Drafting email..." },
  saveResearchReport:  { icon: "", label: () => "Saving report..." },
  scheduleSocialPost:  { icon: "", label: () => "Scheduling social post..." },
  runCode:             { icon: "", label: () => "Executing code..." },
  createGoal:          { icon: "", label: () => "Creating goal..." },
  createTask:          { icon: "", label: () => "Adding task..." },
  updateGoalProgress:  { icon: "", label: () => "Updating goal progress..." },
  analyzeData:         { icon: "", label: () => "Analyzing data..." },
  generateOutline:     { icon: "", label: () => "Generating outline..." },
  generateExcel:       { icon: "", label: () => "Creating Excel spreadsheet..." },
  generatePowerPoint:  { icon: "", label: () => "Creating PowerPoint presentation..." },
  generatePDF:         { icon: "", label: () => "Creating PDF document..." },
  generateImage:       { icon: "🎨", label: () => "Generating AI image..." },
  projectMap:          { icon: "📁", label: () => "Mapping project structure..." },
  codeGrep:            { icon: "🔍", label: (args: any) => `Searching for "${args.query}"...` },
  readProjectFile:     { icon: "📄", label: (args: any) => `Reading ${args.path.split('/').pop()}...` },
  multiAgentDebate:    { icon: "🧠", label: () => "Running Council…" },
  writeSandboxFiles:   { icon: "📦", label: (args: any) => `Writing ${args?.files?.length ?? "?"} sandbox file(s)...` },
  upgradeSiteToNextjs: { icon: "⚛️", label: () => "Scaffolding Next.js (App Router) in sandbox…" },
  saveStylePreference: { icon: "🎨", label: () => "Saving style preference..." },
  createProject:       { icon: "📁", label: () => "Creating new project..." },
  fetchUrl:            { icon: "🌐", label: (args: any) => `Fetching ${args.url?.slice(0, 40)}...` },
};

export function buildTaskLogStreamLine(logEntry: Record<string, unknown>) {
  return `4:${JSON.stringify(logEntry)}\n`;
}

export async function logTaskEvent(opts: {
  admin: any;
  userId: string;
  action: string;
  status: TaskLogStatus;
  icon: string;
  agentMode: string | undefined;
  details?: Record<string, unknown>;
  existingLogId?: string;
}) {
  const id = opts.existingLogId || crypto.randomUUID();
  const now = new Date().toISOString();
  const details = opts.details || {};
  const logEntry = {
    id,
    action: opts.action,
    status: opts.status,
    icon: opts.icon,
    agent_mode: opts.agentMode || null,
    details,
    created_at: now,
    updated_at: now,
  };
  const streamLine = buildTaskLogStreamLine(logEntry);

  if (opts.existingLogId) {
    Promise.resolve(
      opts.admin.from("task_logs").update({ status: opts.status, details, updated_at: now }).eq("id", opts.existingLogId)
    ).catch(() => {});
  } else {
    Promise.resolve(opts.admin.from("task_logs").insert({ ...logEntry, user_id: opts.userId })).catch(() => {});
  }

  return { id, streamLine };
}
