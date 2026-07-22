/**
 * Dropping this installation's cached content (spec decision 52).
 *
 * Navigations are cached network-first by public/sw.js, so a member's Feed,
 * Rankings and Player Detail responses sit in the Cache API for offline use.
 * The moment we learn this installation's credential no longer resolves, that
 * cached content is someone else's data on a device that is no longer entitled
 * to it.
 *
 * Two deliberate choices:
 *
 * - **Everything goes, not just the page caches.** Naming the private cache
 *   here would duplicate a constant that lives in public/sw.js — a plain
 *   static file outside the module graph, so it cannot export one. A rename on
 *   either side would silently stop the purge from matching, and the failure
 *   mode is a private-data leak that nothing would catch. What remains is the
 *   static shell: build-hashed chunks, fonts, the logo — all public, all
 *   re-fetchable. Throwing them away costs one cold load and removes the
 *   coupling entirely.
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
    await Promise.all(keys.map((key) => caches.delete(key)));
    return true;
  } catch {
    // Never break the revocation path over this: the server still refuses
    // every read, so a failed purge costs offline staleness, not access. The
    // caller retries.
    return false;
  }
}
