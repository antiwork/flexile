import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

process.env.NODE_ENV = "test";
nextEnv.loadEnvConfig(process.cwd());

/*
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? "100%" : undefined,
  reporter: process.env.CI ? [["list"], ["html"]] : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
  },
  expect: { timeout: 30000, toPass: { timeout: 30000 } },
  timeout: process.env.CI ? 30000 : 120000,
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/u,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ["setup"],
    },
  ],
  tsconfig: "./e2e/tsconfig.json",
  webServer: {
    command: "bin/test_server",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
  },
});
