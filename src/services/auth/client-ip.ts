import { headers } from "next/headers";

/**
 * The caller's address, for rate-limit keying. Behind Coolify's reverse proxy
 * the socket address is always the proxy, so the forwarded headers are what
 * actually distinguishes callers.
 *
 * These headers are client-supplied and therefore spoofable. That's acceptable
 * for what they gate — throttling scripted abuse, never authorization — and the
 * "unknown" fallback deliberately shares one bucket rather than handing out an
 * unlimited one.
 */
export async function clientIp(): Promise<string> {
  const store = await headers();

  // Left-most entry is the original client; the rest are proxies.
  const forwarded = store.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  return store.get("x-real-ip")?.trim() || "unknown";
}
