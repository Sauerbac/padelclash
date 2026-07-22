// App-shell service worker (spec "PWA & offline"): instant open via cached
// shell. Reads still want the network — navigations are network-first and the
// cache is only a fallback, so nothing here ever shows stale data when online.
//
// Bump VERSION to invalidate all caches on deploy of a breaking change; the
// build-hashed /_next/static assets never need it.
//
// ── What this worker must not undermine ──────────────────────────────────────
//
// Navigations are cached, and a cached Feed is private circle data. Two rules
// keep that from becoming a hole in the read gate:
//
//   1. Online, the network answer always wins. A revoked installation asks the
//      server, the server renders "Not joined", and that is what the user sees
//      — and what then replaces the private page in the cache. The cache is
//      only ever consulted after fetch() throws.
//   2. On revocation, the window purges the Cache API wholesale (see
//      src/lib/private-cache.ts). That is what stops previously-cached private
//      pages from being served offline *after* access was taken away. It
//      deliberately does not single out this file's cache names — nothing
//      here needs to stay in step with it.
//
// The limitation neither rule can fix: an installation that is offline when
// Admin revokes it keeps whatever it already downloaded until it next reaches
// the network. Nothing in a service worker can reach a device that isn't
// listening. Revocation is therefore authoritative for everything *new*, not a
// remote wipe of what was already handed over — and the window closes on the
// device's next contact, which SessionWatch makes as early as app open.
const VERSION = "v1";
const STATIC_CACHE = `padelclash-static-${VERSION}`;
const PAGE_CACHE = `padelclash-pages-${VERSION}`;

// Never cache, at any staleness, for any client: the session/health API,
// the Admin surfaces, and join links — whose URL *is* the invitation secret,
// which must not outlive its use in a cache a later visitor could read.
const NEVER_CACHE = [/^\/api\//, /^\/admin/, /^\/join\//];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  // Build-hashed chunks, generated icons and the logo are effectively
  // immutable per deploy (a changed logo warrants a VERSION bump anyway).
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon/") ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/logo-tile.svg"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort for a never-visited page while offline.
    const shell = await caches.match("/");
    if (shell) return shell;
    return new Response(
      "<h1>Offline</h1><p>PadelClash needs a connection for this page.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
