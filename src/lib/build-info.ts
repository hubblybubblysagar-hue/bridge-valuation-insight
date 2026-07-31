/** Build/version identifiers injected at build time by vite.config.ts.
 *  Internal QA surfaces only — not for customer-facing pages. */
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;
declare const __APP_ENV__: string;

function safe(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export const BUILD_INFO = {
  commit: safe(typeof __BUILD_COMMIT__ !== "undefined" ? __BUILD_COMMIT__ : undefined, "unknown"),
  builtAt: safe(typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : undefined, "unknown"),
  environment: safe(typeof __APP_ENV__ !== "undefined" ? __APP_ENV__ : undefined, "development"),
};
