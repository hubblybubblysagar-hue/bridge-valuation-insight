# QuickBooks sandbox connection: diagnosis and fix path

## What the Intuit error actually means

The screenshot error is not an app bug:

> The redirect_uri query parameter value is invalid. Make sure it is listed in the Redirect URIs section on your app's keys tab and matches it exactly.

Intuit rejected the authorize request before any sign-in completed, because the `redirect_uri` ExitBridge sent does not match a Redirect URI registered on the Intuit app's keys tab. Our code sends whatever is stored in the `INTUIT_REDIRECT_URI` secret, verbatim, into the authorize URL.

**Your Developer Portal screenshot confirms this.** Settings, Redirect URIs, Development tab contains exactly one entry:

```text
https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl
```

That is the OAuth Playground URL, not ExitBridge's callback. Nothing in that list can receive our flow, so every Connect attempt fails at the authorize step regardless of which account you sign in with. The "sometimes two different pages" behavior is just Intuit showing the account chooser before the error on some attempts.


## The value that must match

The callback lives in a Supabase Edge Function with JWT verification disabled, so the only correct redirect URI is:

```text
https://lrpfwqqusuhwtumoqmwy.supabase.co/functions/v1/quickbooks-auth-callback
```

No trailing slash. This exact string must appear in the Intuit app's Redirect URIs list **on the same key tab (Development keys for sandbox)** whose Client ID is stored in `INTUIT_CLIENT_ID`.

## Status: redirect URI fixed, consent screen reached

The authorize screen now reads "Connecting Exit Bridge Dev to Sandbox Company_US_1", which confirms the redirect URI is registered, the Development (sandbox) keys are in use, and a sandbox company exists. Steps 1-3 below are done.

## Steps to resolve (no code changes)

1. ~~Add the callback URL to Settings, Redirect URIs, Development tab.~~ Done.
2. ~~Confirm secrets match the Development key tab.~~ Effectively confirmed by the working authorize request:

   - `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` = Development keys
   - `INTUIT_REDIRECT_URI` = the exact URL above
   - `INTUIT_ENVIRONMENT` = `sandbox`
   - `EXITBRIDGE_APP_URL` = the app origin you actually browse from (preview or published), no trailing slash — this is the one still worth double-checking, since it controls where the callback sends you back to
3. ~~Confirm a sandbox company exists.~~ Done — Sandbox Company_US_1.
4. Click **Connect**. Expected outcome: Intuit redirects to our callback, which exchanges the code, stores tokens in Vault, fetches CompanyInfo, and returns you to `/seller/connect?quickbooks=connected`. The page should then show "QuickBooks connected", the Sandbox badge, company name, and a masked realm ID.

   If instead you land on `/seller/connect?quickbooks=error&code=...`, tell me the `code` and `cid` values — they map to stable error codes (`token_exchange_failed`, `company_info_fetch_failed`, `oauth_state_expired_or_reused`) and pinpoint which step failed. If the redirect lands somewhere unexpected, `EXITBRIDGE_APP_URL` is pointing at a different origin than the one you are browsing.


## Loading sample data

Once the connection succeeds, sample data comes from the Intuit sandbox company itself — Intuit pre-populates sandboxes with a demo company (customers, invoices, P&L). Nothing needs seeding on our side: `quickbooks-company-info` already stores a `company_info` snapshot, and the P&L / Balance Sheet report pulls are the natural next step against the same GET-only helper.

If you want a sandbox with richer figures, create a fresh sandbox company from the Sandboxes page and reconnect; each new sandbox gets its own realm ID and the connection row will be replaced for that seller.

## Notes on the GitHub screenshots

The Pages QA report is deploying fine; the red annotations are `typecheck` and `lint` failures inside the collect step, which are unrelated to the Intuit error. Worth fixing separately — say the word and I will plan that.

## What I need from you

- Confirm whether the Intuit app is using Development or Production keys today.
- Confirm whether you have created a sandbox company under the Sandboxes tab, and whether you sign in with that sandbox company's credentials.

No build changes are proposed in this plan.
