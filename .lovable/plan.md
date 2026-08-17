# QuickBooks connect: `oauth_state_expired_or_reused`

## What the data shows

This is no longer a redirect URI problem — Intuit accepted the authorize request and returned you to our callback. The failure happened on our side, at the one-time state check.

Verified in the project's own records:

- The only OAuth state row that exists was created at **18:57 UTC** and expired at **19:07 UTC** (10-minute lifetime). It is still marked unconsumed.
- The callback ran exactly once, at **20:54:43 UTC**, and logged `oauth_state_expired_or_reused` (correlation `9ca35eba-…`).
- No later state row was ever created, so no fresh "Connect" click reached our start endpoint after 18:57.
- `quickbooks_connections` is empty — no tokens were stored, nothing partially connected.

Meaning: the Intuit consent page you clicked **Connect** on was opened roughly two hours earlier, from the 18:57 attempt. By the time the code came back, the matching state had long expired, so the callback correctly refused it. Intuit's Analytics "1 new connection" reflects Intuit's own grant, not a stored ExitBridge connection.

## The immediate fix (no code required)

Start over in one continuous pass:

1. Close the old `appcenter.intuit.com` tab — its authorize URL carries the dead state.
2. In ExitBridge, go to `/seller/connect` and click **Connect QuickBooks securely** fresh.
3. Complete the Intuit sign-in and consent within 10 minutes without reloading or reusing a back-button page.
4. You should land on `/seller/connect?quickbooks=connected`, and the page should show the sandbox company name and a masked realm ID.

## Code changes worth making (proposed)

The failure was correct behavior but a poor experience. Three small hardening changes:

1. **Extend the state lifetime** from 10 minutes to 30 in the start function. Intuit sign-in plus sandbox selection can genuinely exceed 10 minutes on a first run; 30 minutes stays well within safe one-time-use bounds.
2. **Make the expired case self-healing in the UI.** When `/seller/connect` receives `code=oauth_state_expired_or_reused`, replace the raw reference text with a plain message ("This connection attempt timed out. Start again.") plus a primary **Start over** button that immediately re-invokes the start endpoint. Keep the correlation ID visible but secondary.
3. **Clean up stale state rows.** The start function already invalidates a seller's open states; also stamp expired rows as consumed so the table does not accumulate dangling entries, and keep the row's correlation trail readable during QA.

None of these weaken the one-time-use guarantee: the state is still single-use, hashed, and server-validated.

## Loading sandbox sample data

Once a connection lands, no seeding is needed — the Intuit sandbox company (Sandbox Company_US_1) already contains demo customers, invoices, and reports. The callback stores a `company_info` snapshot immediately; Profit & Loss and Balance Sheet pulls are the natural next step against the same GET-only helper, feeding the valuation inputs.

## Notes

- App ID `e020c101-08ec-42f6-a828-bd3ddda1781b` matches the Development (sandbox) app whose redirect URI you updated, so credentials and environment are aligned.
- The `typecheck` and `lint` failures on the QA Pages report are unrelated to this flow and can be addressed separately.
