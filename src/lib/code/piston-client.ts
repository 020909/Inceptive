export type PistonRunResult = {
  ok: boolean;
  status?: string;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  error?: string;
  details?: unknown;
};

export const PISTON_LANGUAGE_IDS: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  go: "go",
  rust: "rust",
  java: "java",
  "c++": "c++",
  c: "c",
  "c#": "csharp",
  ruby: "ruby",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  bash: "bash",
  shell: "bash",
  r: "r",
  lua: "lua",
  perl: "perl",
  scala: "scala",
  haskell: "haskell",
  elixir: "elixir",
  erlang: "erlang",
  dart: "dart",
  julia: "julia",
  nim: "nim",
  zig: "zig",
};

export const SUPPORTED_LANGUAGES = Object.keys(PISTON_LANGUAGE_IDS);

export const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  go: "Go",
  rust: "Rust",
  java: "Java",
  "c++": "C++",
  c: "C",
  "c#": "C#",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  bash: "Bash",
  shell: "Shell",
  r: "R",
  lua: "Lua",
  perl: "Perl",
  scala: "Scala",
  haskell: "Haskell",
  elixir: "Elixir",
  erlang: "Erlang",
  dart: "Dart",
  julia: "Julia",
  nim: "Nim",
  zig: "Zig",
};

export function isPistonConfigured(): boolean {
  return true; // Piston API is free and public
}

export async function runPistonSubmission(opts: {
  source_code: string;
  language_id: string; // any key from PISTON_LANGUAGE_IDS
  stdin?: string;
}): Promise<PistonRunResult> {
  try {
    const res = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: opts.language_id,
        version: "*", // Auto-resolves to latest available
        files: [{ content: opts.source_code }],
        stdin: opts.stdin || "",
      }),
      signal: AbortSignal.timeout(25000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data?.message || "Piston request failed", details: data };
    }

    if (!data.run) {
      return { ok: false, error: "No run output from Piston", details: data };
    }

    return {
      ok: true,
      status: "Accepted",
      stdout: data.run.stdout || "",
      stderr: data.run.stderr || "",
      compile_output: data.compile?.output || "",
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Code execution failed" };
  }
}
