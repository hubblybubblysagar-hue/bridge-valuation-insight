import { expect, test } from "@playwright/test";
import {
  QA_SELLER_EMAIL,
  QA_SELLER_PASSWORD,
  hasSellerCreds,
  signIn,
  trackEdgeFunctionCalls,
} from "../helpers";

test.skip(!hasSellerCreds, "QA_SELLER_EMAIL / QA_SELLER_PASSWORD are not configured");

test.beforeEach(async ({ page }) => {
  await signIn(page, QA_SELLER_EMAIL, QA_SELLER_PASSWORD);
});

test("a seller with no connection sees the real disconnected state", async ({ page }) => {
  await page.goto("/seller/connect");
  const connected = page.getByTestId("qb-connected-state");
  if (await connected.count()) {
    test.info().annotations.push({ type: "note", description: "QA seller already connected" });
    await expect(connected.getByRole("button", { name: /verify connection/i })).toBeVisible();
    await expect(connected.getByText(/^\*{4}/)).toBeVisible();
    return;
  }
  await expect(page.getByTestId("qb-disconnected-state")).toBeVisible();
  await expect(page.getByTestId("qb-connect-button")).toHaveText(/Connect QuickBooks securely/);
  await expect(page.getByRole("button", { name: /upload statements/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /enter manually/i })).toBeVisible();
  await expect(page.getByTestId("qb-sample-button")).toHaveText(/sample data for demonstration/i);
});

test("Connect QuickBooks starts real OAuth and inserts no mock financials", async ({ page }) => {
  await page.goto("/seller/connect");
  const button = page.getByTestId("qb-connect-button");
  test.skip((await button.count()) === 0, "seller is already connected");

  const calls = trackEdgeFunctionCalls(page);
  const inserts: string[] = [];
  page.on("request", (req) => {
    if (/\/rest\/v1\/seller_financials/.test(req.url()) && req.method() !== "GET") {
      inserts.push(req.url());
    }
  });
  // Block the redirect to Intuit so the test stays synthetic.
  await page.route("https://appcenter.intuit.com/**", (route) => route.abort());
  await button.click();
  await page.waitForTimeout(2500);

  expect(calls.some((c) => c.includes("quickbooks-auth-start"))).toBeTruthy();
  expect(inserts, "Connect must never write financials").toEqual([]);
  await expect(page.getByText("QuickBooks connected successfully")).toHaveCount(0);
});

test("sample data is labelled as sample and creates no QuickBooks connection", async ({ page }) => {
  await page.goto("/seller/connect");
  const sample = page.getByTestId("qb-sample-button");
  test.skip((await sample.count()) === 0, "seller is already connected");

  const calls = trackEdgeFunctionCalls(page);
  await sample.click();
  await expect(page.getByText("Sample data loaded")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("QuickBooks connected")).toHaveCount(0);
  expect(calls, "sample data must not touch Intuit").toEqual([]);

  await page.goto("/seller/financial-review");
  await expect(page.getByText(/sample data/i).first()).toBeVisible();
  await expect(page.getByText("From QuickBooks")).toHaveCount(0);
});
