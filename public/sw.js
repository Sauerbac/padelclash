// App-shell service worker (spec "PWA & offline"): instant open via cached
// shell. Reads still want the network — navigations are network-first and the
// cache is only a fallback, so nothing here ever shows stale data when online.
//
// Bump VERSION to invalidate all caches on deploy of a breaking change; the
// build-hashed /_next/static assets never need it.
const VERSION = "v1";
const STATIC_CACHE = `padelclash-static-${VERSION}`;
const PAGE_CACHE = `padelclash-pages-${VERSION}`;

// Never cache: API, admin surfaces, join links (personal tokens in the URL).
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
