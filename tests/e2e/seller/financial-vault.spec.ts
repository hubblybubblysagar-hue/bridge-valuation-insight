import { expect, test } from "@playwright/test";
import {
  QA_BUYER_EMAIL,
  QA_BUYER_PASSWORD,
  QA_SELLER_EMAIL,
  QA_SELLER_PASSWORD,
  hasBuyerCreds,
  hasSellerCreds,
  signIn,
} from "../helpers";

// Demo routes need no credentials: sample mode must never impersonate
// QuickBooks-sourced data.
test("demo financial review is labelled SAMPLE DATA and never 'From QuickBooks'", async ({
  page,
}) => {
  await page.goto("/demo/seller/financial-review");
  await expect(page.getByTestId("source-banner-sample")).toBeVisible();
  await expect(page.getByText(/sample data/i).first()).toBeVisible();
  await expect(page.getByText("From QuickBooks")).toHaveCount(0);
  // The SDE bridge labels base figures as sample and add-backs as seller adjustments.
  await expect(page.getByTestId("sde-bridge")).toBeVisible();
  await expect(page.getByText("Seller adjustment").first()).toBeVisible();
});

test("seller vault renders with sync action and never leaks buyer surfaces", async ({ page }) => {
  test.skip(!hasSellerCreds, "QA_SELLER_EMAIL / QA_SELLER_PASSWORD are not configured");
  await signIn(page, QA_SELLER_EMAIL, QA_SELLER_PASSWORD);
  await page.goto("/seller/financial-vault");

  await expect(
    page.getByRole("heading", { name: "Financial Vault" }),
  ).toBeVisible({ timeout: 20_000 });

  // Connected sellers get the sync CTA; disconnected sellers get the connect CTA.
  const syncButton = page.getByTestId("vault-sync-button");
  const empty = page.getByTestId("vault-empty");
  await expect(syncButton.or(empty)).toBeVisible({ timeout: 20_000 });

  if (await syncButton.count()) {
    await expect(page.getByTestId("vault-source")).toBeVisible();
    // If reports exist, cards link to the detail viewer with provenance.
    const cards = page.getByTestId("vault-report-card");
    if ((await cards.count()) > 0) {
      await cards.first().click();
      await expect(page.getByTestId("report-provenance")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("inspect-source")).toBeVisible();
      await expect(page.getByText("From QuickBooks").first()).toBeVisible();
    }
  }
});

test("buyers cannot read any vault data", async ({ page }) => {
  test.skip(!hasBuyerCreds, "QA_BUYER_EMAIL / QA_BUYER_PASSWORD are not configured");
  await signIn(page, QA_BUYER_EMAIL, QA_BUYER_PASSWORD);
  await page.goto("/seller/financial-vault");
  // RLS returns nothing for buyers: no cards, no runs, no snapshot data.
  await expect(page.getByTestId("vault-report-card")).toHaveCount(0);
  await expect(page.getByTestId("vault-run-row")).toHaveCount(0);
  await expect(page.getByTestId("report-provenance")).toHaveCount(0);
});
