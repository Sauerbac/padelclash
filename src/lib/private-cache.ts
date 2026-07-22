/**
 * Dropping legacy cached private pages after revocation.
 *
 * Current workers never cache private navigations. This cleanup remains for
 * installations upgrading from the old worker, whose `padelclash-pages-*`
 * caches may contain Feed, Leaderboard, or Player Detail HTML.
 *
 * Two deliberate choices:
 *
 * - Only the retired `padelclash-pages-*` namespace is private. The generated
 *   `padelclash-shell-*` cache contains the static offline Match-entry shell
 *   and must survive cleanup so an unbound device can still open safely.
 * - **Done from the window, not by messaging the worker.** The Cache API is
 *   available to both, and a purge that depended on a live, actively
 *   controlling service worker would silently no-op in exactly the situations
 *   (worker unregistered, update in flight, registration failed) where it
 *   still has to work.
 *
 * Returns whether the purge completed, so the caller can decline to treat a
 * revocation as handled and retry on the next contact.
 */
export async function dropPrivatePageCaches(): Promise<boolean> {
  if (typeof caches === "undefined") return true;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(isPrivatePageCache).map((key) => caches.delete(key)),
    );
    return true;
  } catch {
    // Never break the revocation path over this: the server still refuses
    // every read, so a failed purge costs offline staleness, not access. The
    // caller retries.
    return false;
  }
}

export function isPrivatePageCache(key: string): boolean {
  return key.startsWith("padelclash-pages-");
}
