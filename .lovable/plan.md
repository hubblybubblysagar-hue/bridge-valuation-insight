# QuickBooks sandbox connection: diagnosis and fix path

## What the Intuit error actually means

The screenshot error is not an app bug:

> The redirect_uri query parameter value is invalid. Make sure it is listed in the Redirect URIs section on your app's keys tab and matches it exactly.

Intuit rejected the authorize request before any sign-in completed, because the `redirect_uri` ExitBridge sent does not byte-for-byte match a Redirect URI registered on the Intuit app's keys tab. Our code sends whatever is stored in the `INTUIT_REDIRECT_URI` secret, verbatim, into the authorize URL. So exactly one of two things is off:

1. The value in `INTUIT_REDIRECT_URI` is not registered in the Intuit dashboard (or differs by trailing slash, http vs https, or path).
2. The value is registered under the *other* key set — Intuit apps have separate Development (sandbox) and Production keys, each with their own Client ID, Client Secret, and Redirect URI list. Mixing a production Client ID with a sandbox-registered redirect produces this exact error.

Item 2 also explains "sometimes redirected to one of two different pages": sandbox vs production authorize flows show different company pickers.

## The value that must match

The callback lives in a Supabase Edge Function with JWT verification disabled, so the only correct redirect URI is:

```text
https://lrpfwqqusuhwtumoqmwy.supabase.co/functions/v1/quickbooks-auth-callback
```

No trailing slash. This exact string must appear in the Intuit app's Redirect URIs list **on the same key tab (Development keys for sandbox)** whose Client ID is stored in `INTUIT_CLIENT_ID`.

## Steps to resolve (no code changes)

1. Intuit Developer Portal, your app, **Keys & credentials, Development tab**: add the URL above to Redirect URIs and save. Copy that tab's Client ID and Client Secret.
2. Confirm the ExitBridge secrets match that tab:
   - `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` = Development keys
   - `INTUIT_REDIRECT_URI` = the exact URL above
   - `INTUIT_ENVIRONMENT` = `sandbox`
   - `EXITBRIDGE_APP_URL` = the app origin you actually browse from (preview or published), no trailing slash — otherwise the callback bounce and CORS reject the browser call
3. Intuit Developer Portal, **Sandboxes**: confirm at least one sandbox company exists under the same developer account you sign in with during the flow. The "dummy account" must be the sandbox company user, not a personal QuickBooks account — signing in with a non-sandbox account against Development keys is the second common cause of the block screen.
4. Retry Connect QuickBooks and, if it still fails, read the failure by correlation ID in the Edge Function logs for `quickbooks-auth-start` and `quickbooks-auth-callback`; the codes are stable (`oauth_state_invalid`, `token_exchange_failed`, etc.).

## Loading sample data

Once the connection succeeds, sample data comes from the Intuit sandbox company itself — Intuit pre-populates sandboxes with a demo company (customers, invoices, P&L). Nothing needs seeding on our side: `quickbooks-company-info` already stores a `company_info` snapshot, and the P&L / Balance Sheet report pulls are the natural next step against the same GET-only helper.

If you want a sandbox with richer figures, create a fresh sandbox company from the Sandboxes page and reconnect; each new sandbox gets its own realm ID and the connection row will be replaced for that seller.

## Notes on the GitHub screenshots

The Pages QA report is deploying fine; the red annotations are `typecheck` and `lint` failures inside the collect step, which are unrelated to the Intuit error. Worth fixing separately — say the word and I will plan that.

## What I need from you

- Confirm whether the Intuit app is using Development or Production keys today.
- Confirm whether you have created a sandbox company under the Sandboxes tab, and whether you sign in with that sandbox company's credentials.

No build changes are proposed in this plan.
