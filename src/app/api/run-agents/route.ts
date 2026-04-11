import { POST as triggerAgentPost } from "@/app/api/trigger-agent/route";

export async function POST(request: Request) {
  return triggerAgentPost(request);
}
