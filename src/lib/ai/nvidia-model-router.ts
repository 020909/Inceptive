/**
 * Pick an NVIDIA NIM chat model id for integrate.api.nvidia.com based on the user message.
 * Override via env if a model id is unavailable on your account:
 *   NVIDIA_MODEL_CODE, NVIDIA_MODEL_REASONING, NVIDIA_MODEL_DESIGN, NVIDIA_MODEL_DEFAULT
 */

export type NvidiaTaskKind = "reasoning" | "code" | "design" | "default";

export function classifyNvidiaTask(text: string): NvidiaTaskKind {
  const t = (text || "").toLowerCase();
  if (
    /\b(code|typescript|javascript|python|react|next\.js|nextjs|debug|refactor|implement|api|sql|function|bug|compile|npm|endpoint|schema|prisma)\b/.test(
      t
    ) ||
    /```/.test(t)
  ) {
    return "code";
  }
  if (
    /\b(ui|ux|design|layout|css|tailwind|brand|figma|visual|animation|hero|landing|palette|typography)\b/.test(t)
  ) {
    return "design";
  }
  if (
    /\b(research|reason|why|analyze|compare|prove|logic|math|strategy|citation|sources|investigate)\b/.test(t)
  ) {
    return "reasoning";
  }
  return "default";
}

export function nvidiaModelForTask(userMessage: string): { model: string; reason: string } {
  const kind = classifyNvidiaTask(userMessage);
  const code = process.env.NVIDIA_MODEL_CODE?.trim();
  const reasoning = process.env.NVIDIA_MODEL_REASONING?.trim();
  const design = process.env.NVIDIA_MODEL_DESIGN?.trim();
  const fallback = process.env.NVIDIA_MODEL_DEFAULT?.trim();

  const nemotron = fallback || "nvidia/nemotron-4-340b-instruct";

  switch (kind) {
    case "code":
      return {
        model: code || "meta/llama-3.3-70b-instruct",
        reason:
          "NVIDIA NIM: coding / implementation → Llama 3.3 70B (override with NVIDIA_MODEL_CODE)",
      };
    case "design":
      return {
        model: design || nemotron,
        reason: "NVIDIA NIM: UI/design copy → Nemotron (override with NVIDIA_MODEL_DESIGN)",
      };
    case "reasoning":
      return {
        model: reasoning || nemotron,
        reason: "NVIDIA NIM: reasoning / research → Nemotron 340B (override with NVIDIA_MODEL_REASONING)",
      };
    default:
      return {
        model: nemotron,
        reason: "NVIDIA NIM: general → Nemotron 340B (override with NVIDIA_MODEL_DEFAULT)",
      };
  }
}
