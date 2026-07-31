import { type Page, expect } from "@playwright/test";

export const QA_SELLER_EMAIL = process.env.QA_SELLER_EMAIL ?? "";
export const QA_SELLER_PASSWORD = process.env.QA_SELLER_PASSWORD ?? "";
export const QA_BUYER_EMAIL = process.env.QA_BUYER_EMAIL ?? "";
export const QA_BUYER_PASSWORD = process.env.QA_BUYER_PASSWORD ?? "";

export const hasSellerCreds = Boolean(QA_SELLER_EMAIL && QA_SELLER_PASSWORD);
export const hasBuyerCreds = Boolean(QA_BUYER_EMAIL && QA_BUYER_PASSWORD);

/** Sign in through the app's own login form using a synthetic QA account. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** Record every quickbooks-* / qa-quickbooks-* Edge Function call made by the page. */
export function trackEdgeFunctionCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (/\/functions\/v1\/(quickbooks|qa-quickbooks)-/.test(url)) calls.push(url);
  });
  return calls;
}
