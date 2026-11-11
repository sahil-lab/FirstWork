import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".local/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["junit", { outputFile: ".local/reports/e2e.xml" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:18108",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
