/**
 * While Council runs, individual LLM calls can block for many minutes with no SSE
 * traffic. The dashboard treats long idle streams as dead and unlocks the input,
 * which lets a follow-up message start a second request — the model then has no
 * idea a build is still running. Periodic preview pings keep the stream "alive".
 */
const HEARTBEAT_LINES = [
  "Council is still running — some steps take several minutes on free models.",
  "Still generating — the timeline above shows which specialist is active.",
  "Large coding steps can take a while; no need to resend unless you see an error.",
];

export function startCouncilHeartbeat(
  enqueue: (line: string) => void,
  intervalMs = 20_000
): () => void {
  let tick = 0;
  const id = setInterval(() => {
    const label = HEARTBEAT_LINES[tick % HEARTBEAT_LINES.length];
    tick++;
    enqueue(
      `5:${JSON.stringify({
        type: "preview",
        state: "building",
        label,
        source: "council-heartbeat",
      })}\n`
    );
  }, intervalMs);
  return () => clearInterval(id);
}
