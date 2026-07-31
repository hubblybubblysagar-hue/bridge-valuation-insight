// Deno unit tests for the shared QuickBooks helpers.
// No test in this file may reach the real Intuit API — fetch is stubbed.
import {
  assert,
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAuthorizationUrl,
  corsHeaders,
  exchangeAuthorizationCode,
  generateOAuthState,
  isOriginAllowed,
  loadConfig,
  maskRealm,
  QB_ERROR,
  QbError,
  quickbooksGet,
  refreshTokenBundle,
  safeError,
  safeLastError,
  sha256Hex,
  toErrorCode,
  type QuickBooksConfig,
} from "../_shared/quickbooks.ts";

const ENV: Record<string, string> = {
  INTUIT_CLIENT_ID: "test-client",
  INTUIT_CLIENT_SECRET: "test-secret",
  INTUIT_REDIRECT_URI: "https://example.test/functions/v1/quickbooks-auth-callback",
  INTUIT_ENVIRONMENT: "sandbox",
  EXITBRIDGE_APP_URL: "https://app.example.test",
  QUICKBOOKS_MINOR_VERSION: "75",
};

function setEnv(extra: Record<string, string> = {}) {
  for (const [k, v] of Object.entries({ ...ENV, ...extra })) Deno.env.set(k, v);
}
function clearEnv(keys: string[]) {
  for (const k of keys) Deno.env.delete(k);
}

const cfg: QuickBooksConfig = {
  clientId: "test-client",
  clientSecret: "test-secret",
  redirectUri: "https://example.test/cb",
  environment: "sandbox",
  appUrl: "https://app.example.test",
  minorVersion: "75",
  enableBackendQa: true,
};

/** Replace globalThis.fetch for the duration of fn. */
async function withFetch(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  fn: (calls: Array<{ url: string; method: string }>) => Promise<void>,
) {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, method: (init?.method ?? "GET").toUpperCase() });
    return handler(input, init);
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

// ---------------------------------------------------------- configuration
Deno.test("loadConfig returns a sandbox config when env is complete", () => {
  setEnv();
  const c = loadConfig();
  assertEquals(c.environment, "sandbox");
  assertEquals(c.appUrl, "https://app.example.test");
  assertEquals(c.minorVersion, "75");
});

Deno.test("loadConfig throws and names every missing variable", () => {
  setEnv();
  clearEnv(["INTUIT_CLIENT_SECRET"]);
  let message = "";
  try {
    loadConfig();
  } catch (e) {
    message = (e as Error).message;
  }
  assertStringIncludes(message, "INTUIT_CLIENT_SECRET");
  setEnv();
});

// -------------------------------------------------------- oauth state/hash
Deno.test("generateOAuthState produces long, URL-safe, non-repeating values", () => {
  const a = generateOAuthState();
  const b = generateOAuthState();
  assert(a.length >= 40, `state too short: ${a.length}`);
  assertMatch(a, /^[A-Za-z0-9_-]+$/);
  assertNotEquals(a, b);
});

Deno.test("sha256Hex matches the known digest for a fixed input", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const h = await sha256Hex(generateOAuthState());
  assertEquals(h.length, 64);
});

// ------------------------------------------------------ authorization URL
Deno.test("buildAuthorizationUrl carries client id, scope, redirect and state", () => {
  const url = new URL(buildAuthorizationUrl(cfg, "state-123"));
  assertEquals(url.origin + url.pathname, "https://appcenter.intuit.com/connect/oauth2");
  assertEquals(url.searchParams.get("client_id"), "test-client");
  assertEquals(url.searchParams.get("response_type"), "code");
  assertEquals(url.searchParams.get("scope"), "com.intuit.quickbooks.accounting");
  assertEquals(url.searchParams.get("redirect_uri"), "https://example.test/cb");
  assertEquals(url.searchParams.get("state"), "state-123");
  assert(!url.searchParams.get("scope")!.includes("payment"));
});

// ------------------------------------------------------- token expiry math
Deno.test("token expiry timestamps are derived from Intuit's TTLs", async () => {
  const before = Date.now();
  await withFetch(
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "at",
            refresh_token: "rt",
            token_type: "bearer",
            expires_in: 3600,
            x_refresh_token_expires_in: 8726400,
          }),
          { status: 200 },
        ),
      ),
    async () => {
      const bundle = await exchangeAuthorizationCode(cfg, "code-1");
      const access = Date.parse(bundle.access_token_expires_at) - before;
      const refresh = Date.parse(bundle.refresh_token_expires_at) - before;
      assert(access >= 3595_000 && access <= 3605_000, `access ttl off: ${access}`);
      assert(refresh > 8_700_000_000 - 60_000, `refresh ttl off: ${refresh}`);
      assertEquals(bundle.access_token, "at");
    },
  );
});

Deno.test("failed token exchange raises the token_exchange_failed code", async () => {
  await withFetch(
    () => Promise.resolve(new Response("nope", { status: 400 })),
    async () => {
      const err = await assertRejects(() => exchangeAuthorizationCode(cfg, "bad"));
      assertEquals(toErrorCode(err, QB_ERROR.companyInfoFetchFailed), QB_ERROR.tokenExchangeFailed);
    },
  );
});

Deno.test("refresh replaces the whole bundle with the newest refresh token", async () => {
  await withFetch(
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "at2",
            refresh_token: "rt2",
            token_type: "bearer",
            expires_in: 3600,
            x_refresh_token_expires_in: 8726400,
          }),
          { status: 200 },
        ),
      ),
    async () => {
      const fresh = await refreshTokenBundle(cfg, "rt1");
      assertEquals(fresh.access_token, "at2");
      assertEquals(fresh.refresh_token, "rt2");
      assertNotEquals(fresh.refresh_token, "rt1");
    },
  );
});

Deno.test("failed refresh raises the token_refresh_failed code", async () => {
  await withFetch(
    () => Promise.resolve(new Response("nope", { status: 401 })),
    async () => {
      const err = await assertRejects(() => refreshTokenBundle(cfg, "rt1"));
      assertEquals(toErrorCode(err, QB_ERROR.companyInfoFetchFailed), QB_ERROR.tokenRefreshFailed);
    },
  );
});

// -------------------------------------------------------- GET-only Data API
Deno.test("quickbooksGet issues a GET with the sandbox host and minorversion", async () => {
  await withFetch(
    () => Promise.resolve(new Response(JSON.stringify({ CompanyInfo: { CompanyName: "X" } }), { status: 200 })),
    async (calls) => {
      const out = await quickbooksGet(cfg, "at", "123456", "/companyinfo/123456") as {
        CompanyInfo: { CompanyName: string };
      };
      assertEquals(out.CompanyInfo.CompanyName, "X");
      assertEquals(calls.length, 1);
      assertEquals(calls[0].method, "GET");
      assertStringIncludes(calls[0].url, "https://sandbox-quickbooks.api.intuit.com/v3/company/123456");
      assertStringIncludes(calls[0].url, "minorversion=75");
    },
  );
});

Deno.test("the shared module exposes no write/mutation helper for the Data API", async () => {
  const src = await Deno.readTextFile(new URL("../_shared/quickbooks.ts", import.meta.url));
  // The only Data API entry point is quickbooksGet.
  for (const forbidden of ["quickbooksPost", "quickbooksPut", "quickbooksDelete", "quickbooksMutate"]) {
    assert(!src.includes(`export async function ${forbidden}`), `unexpected write helper ${forbidden}`);
  }
  // And it never sends a non-GET request to the Data API host.
  assert(!/apiBaseUrl[\s\S]{0,400}method:\s*"POST"/.test(src), "Data API helper must not POST");
});

Deno.test("a non-OK QuickBooks GET normalizes to company_info_fetch_failed", async () => {
  await withFetch(
    () => Promise.resolve(new Response("denied", { status: 403 })),
    async () => {
      const err = await assertRejects(() => quickbooksGet(cfg, "at", "1", "/companyinfo/1"));
      assertEquals(toErrorCode(err, QB_ERROR.tokenRefreshFailed), QB_ERROR.companyInfoFetchFailed);
    },
  );
});

// -------------------------------------------------- error normalization/CORS
Deno.test("safe error normalization never leaks payloads", () => {
  assertEquals(toErrorCode(new QbError(QB_ERROR.oauthStateInvalid), QB_ERROR.noConnection), "oauth_state_invalid");
  assertEquals(toErrorCode(new Error("boom with token abc123"), QB_ERROR.noConnection), "no_connection");
  assertEquals(safeLastError(QB_ERROR.tokenRefreshFailed, "cid-1"), "token_refresh_failed:cid-1");
  assert(safeError(new Error("x".repeat(500))).length <= 200);
});

Deno.test("masked realm never reveals the full realm id", () => {
  assertEquals(maskRealm("9341454759036866"), "****6866");
  assertEquals(maskRealm("12"), "****");
  assertEquals(maskRealm(null), "");
});

Deno.test("CORS is restricted to the app origin and rejects unknown origins", () => {
  setEnv({ APP_ENV: "production" });
  assert(isOriginAllowed("https://app.example.test"));
  assert(!isOriginAllowed("https://evil.example"));
  assert(isOriginAllowed(null), "server-to-server callers have no Origin header");
  const headers = corsHeaders("https://evil.example");
  assertEquals(headers["Access-Control-Allow-Origin"], "https://app.example.test");
  assertNotEquals(headers["Access-Control-Allow-Origin"], "*");
});

Deno.test("localhost origins are allowed only in development", () => {
  setEnv({ APP_ENV: "development" });
  assert(isOriginAllowed("http://localhost:8080"));
  setEnv({ APP_ENV: "production" });
  assert(!isOriginAllowed("http://localhost:8080"));
});

// ------------------------------------------------------ disconnect behavior
Deno.test("disconnect clears credentials without touching seller business data", async () => {
  const src = await Deno.readTextFile(
    new URL("../quickbooks-disconnect/index.ts", import.meta.url),
  );
  assertStringIncludes(src, "deleteTokenSecret");
  assertStringIncludes(src, 'status: "disconnected"');
  assertStringIncludes(src, "token_secret_id: null");
  for (const table of [
    "businesses",
    "seller_financials",
    "valuations",
    "teasers",
    "nda_requests",
    "quickbooks_report_snapshots",
  ]) {
    assert(!src.includes(`.delete()`), "disconnect must never delete rows");
    assert(!new RegExp(`from\\("${table}"\\)[\\s\\S]{0,120}delete`).test(src), `must not delete ${table}`);
  }
});
