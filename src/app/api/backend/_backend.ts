const DEFAULT_BACKEND_URL = "http://localhost:8000";

export function getBackendBaseUrl(): string {
  // Prefer a server-only env var if you add it in Cloudflare dashboard.
  const url =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_BACKEND_URL;

  return url.replace(/\/+$/, "");
}

export function buildBackendUrl(pathname: string): string {
  const base = getBackendBaseUrl();
  const baseUrl = new URL(base);
  return new URL(pathname.replace(/^\/+/, "/"), baseUrl).toString();
}

export function passthroughHeaders(from: Headers): Headers {
  const headers = new Headers();

  // Allowlist common useful headers.
  const allow = new Set([
    "content-type",
    "content-disposition",
    "content-length",
    "etag",
    "last-modified",
    "accept-ranges",
    "cache-control",
    "x-code-file-path",
    "x-success",
    "x-query",
    "x-request-id",
  ]);

  for (const [key, value] of from.entries()) {
    const lower = key.toLowerCase();
    if (allow.has(lower)) headers.set(key, value);
  }

  // Avoid caching dynamic backend responses by default.
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");

  return headers;
}
