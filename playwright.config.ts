import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 90_000,
  use: {
    baseURL: process.env.SMOKE_BASE_URL || "https://app.inceptive-ai.com",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});

