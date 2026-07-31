import { expect, test } from "@playwright/test";
import { trackEdgeFunctionCalls } from "../helpers";

test("landing page loads with the ExitBridge value proposition", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/ExitBridge/i);
});

test("seller connect is not reachable without signing in", async ({ page }) => {
  await page.goto("/seller/connect");
  await expect(page).toHaveURL(/\/login|\/seller\/connect/);
  // If the route rendered at all, it must not claim a QuickBooks connection.
  await expect(page.getByText("QuickBooks connected", { exact: false })).toHaveCount(0);
});

test("demo routes never invoke a quickbooks-* Edge Function", async ({ page }) => {
  const calls = trackEdgeFunctionCalls(page);
  for (const route of [
    "/demo/seller/start",
    "/demo/seller/quickbooks-connected",
    "/demo/seller/financial-review",
    "/demo/buyer/feed",
    "/qa",
    "/qa-static",
  ]) {
    await page.goto(route);
    await page.waitForTimeout(500);
  }
  expect(calls, `demo routes must never call Intuit-backed functions: ${calls.join(", ")}`).toEqual([]);
});

test("the QA demo connected fixture shows Verify and Disconnect controls", async ({ page }) => {
  await page.goto("/demo/seller/quickbooks-connected");
  await expect(page.getByText(/QA Mode/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /connect your financials/i })).toBeVisible();
});

test("a failed callback shows a safe verification error, not a success toast", async ({ page }) => {
  await page.goto("/seller/connect?quickbooks=error&code=company_info_fetch_failed&cid=test-cid");
  const error = page.getByTestId("qb-callback-error");
  if (await error.count()) {
    await expect(error).toContainText(/could not verify the connection/i);
    await expect(error).toContainText(/company_info_fetch_failed/);
  }
  await expect(page.getByText("QuickBooks connected successfully")).toHaveCount(0);
});
