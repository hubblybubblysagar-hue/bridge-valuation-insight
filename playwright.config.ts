import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.QA_BASE_URL ?? "http://localhost:8080";

/**
 * Synthetic-only browser tests. Seller/buyer projects run against dedicated QA
 * accounts (QA_SELLER_EMAIL / QA_BUYER_EMAIL) and are skipped when those
 * secrets are absent. Real seller data is never used.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["list"],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "public", testMatch: /public\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "seller", testMatch: /seller\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "buyer", testMatch: /buyer\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.QA_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
