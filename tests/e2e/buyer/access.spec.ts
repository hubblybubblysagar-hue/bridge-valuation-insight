import { expect, test } from "@playwright/test";
import { QA_BUYER_EMAIL, QA_BUYER_PASSWORD, hasBuyerCreds, signIn, trackEdgeFunctionCalls } from "../helpers";

test.skip(!hasBuyerCreds, "QA_BUYER_EMAIL / QA_BUYER_PASSWORD are not configured");

test("a buyer cannot reach seller QuickBooks pages", async ({ page }) => {
  const calls = trackEdgeFunctionCalls(page);
  await signIn(page, QA_BUYER_EMAIL, QA_BUYER_PASSWORD);

  await page.goto("/seller/connect");
  await page.waitForTimeout(1500);
  await expect(page).not.toHaveURL(/\/seller\/connect$/);
  await expect(page.getByTestId("qb-connected-state")).toHaveCount(0);
  expect(calls.filter((c) => c.includes("quickbooks-"))).toEqual([]);
});

test("the buyer feed exposes no QuickBooks connection metadata", async ({ page }) => {
  await signIn(page, QA_BUYER_EMAIL, QA_BUYER_PASSWORD);
  await page.goto("/buyer");
  await expect(page.getByText(/realm/i)).toHaveCount(0);
  await expect(page.getByText(/token/i)).toHaveCount(0);
});
