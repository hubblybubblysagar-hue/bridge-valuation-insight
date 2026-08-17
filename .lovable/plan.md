# QuickBooks connect: repair `token_exchange_failed`

## Confirmed diagnosis

The previous state-expiry issue is resolved. Three fresh attempts created and consumed one-time state records within 2–3 seconds, so signing out, switching Intuit accounts, or closing tabs will not change this failure.

The latest callback (`a44a1657-fc6a-4af6-9b3d-71549ebc58c9`) reached Intuit's token endpoint and received **HTTP 401**. The authorization request is accepted with this Development Client ID, but the server-to-server Basic authentication fails when exchanging the returned code. The exchange request itself uses Intuit's documented endpoint, form encoding, grant type, redirect URI, and Basic authentication format.

This narrows the issue to the runtime `INTUIT_CLIENT_SECRET`: it is stale, copied incorrectly, or does not belong to the Development Client ID used by the authorization request.

## Security action required first

The Development client secret is visible in the uploaded Keys & Credentials screenshot. Treat it as compromised even if it was previously correct.

1. In Intuit Developer Portal → **Keys & credentials → Development**, click **Rotate secret**.
2. Save the newly issued Development secret into ExitBridge's existing `INTUIT_CLIENT_SECRET` runtime secret using the secure secret form. Do not paste it into chat, GitHub, source code, or a `.env` file.
3. Do not change the Client ID, redirect URI, environment, or Supabase callback URL; those are now demonstrably reaching the correct stages.

## Verification pass

After the secret is replaced:

1. Click **Connect QuickBooks securely** once and approve Sandbox Company_US_1.
2. Confirm the callback redirects to `/seller/connect?quickbooks=connected`.
3. Verify a `quickbooks_connections` row exists with `status = connected`, a Vault secret reference, and no raw OAuth tokens in public tables.
4. Verify one `company_info` snapshot exists and the page shows the sandbox company name plus masked realm ID.
5. Run the QuickBooks sandbox smoke workflow and confirm its sanitized checks pass.

## If a 401 remains after rotation

Compare only non-secret fingerprints server-side: confirm the configured Client ID equals the Development Client ID for App ID `e020c101-08ec-42f6-a828-bd3ddda1781b`, then inspect the callback log by correlation ID. Do not log or return either credential. A post-rotation 400 would indicate a different issue such as redirect mismatch or reused code; a continued 401 still means the Client ID/secret pair is not valid together.

## Scope

No application code or UI change is needed for this repair. Once the connection succeeds, Intuit's pre-populated sandbox data can be retrieved through the existing GET-only integration; CompanyInfo is already the first persisted proof.