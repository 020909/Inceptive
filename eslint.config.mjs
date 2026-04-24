import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // One-off Node scripts at repo root (CommonJS)
    "diag_v2.js",
    "inspect_ai.js",
    "inspect_events.js",
    "inspect_stream.js",
    "inspect_stream_v2.js",
    "inspect_stream_v3.js",
    "test_maxsteps.js",
    "test_protocol.js",
  ]),
]);

export default eslintConfig;
