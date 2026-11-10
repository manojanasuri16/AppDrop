/* AppDrop service worker. Hand-written, plain JS (no bundler).
 * Bump VERSION to invalidate every cache on the next deploy. */
const VERSION = "v2";
const PREFIX = "appdrop-";
const STATIC_CACHE = `${PREFIX}static-${VERSION}`;
const MEDIA_CACHE = `${PREFIX}media-${VERSION}`;
const PAGES_CACHE = `${PREFIX}pages-${VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, MEDIA_CACHE, PAGES_CACHE];

const PRECACHE_URLS = ["/offline", "/icons/192", "/icons/512"];
const MEDIA_MAX_ENTRIES = 150;
const PAGES_MAX_ENTRIES = 30;
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(PREFIX) && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** Requests that must always reach the network, never the cache. */
function isBypassed(url) {
  return /^\/admin(\/|$)/.test(url.pathname) || /^\/api(\/|$)/.test(url.pathname) || /^\/d(\/|$)/.test(url.pathname) || /^\/beta(\/|$)/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypassed(url)) return;
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/media/")) {
    event.respondWith(staleWhileRevalidate(event, request, MEDIA_CACHE, MEDIA_MAX_ENTRIES));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

async function staleWhileRevalidate(event, request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const revalidate = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        await trim(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => null);
  event.waitUntil(revalidate);
  if (cached) return cached;
  return (await revalidate) || Response.error();
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
    if (response.ok) {
      await cache.delete(request.url);
      await cache.put(request.url, response.clone());
      await trim(PAGES_CACHE, PAGES_MAX_ENTRIES);
    }
    return response;
  } catch {
    const cached = await cache.match(request.url);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    return offline || Response.error();
  }
}

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Drop the oldest entries (Cache.keys() returns insertion order) until under the cap. */
async function trim(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

/* ---- Web Push ---- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try { data = { body: event.data.text() }; } catch { data = {}; }
  }
  if (!data || typeof data !== "object") data = {};
  const title = typeof data.title === "string" && data.title ? data.title : "AppDrop";
  const tag = typeof data.tag === "string" && data.tag ? data.tag : undefined;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: typeof data.icon === "string" && data.icon ? data.icon : "/icons/192",
      badge: "/icons/192",
      tag,
      data: { url: typeof data.url === "string" ? data.url : "/" },
      renotify: !!tag,
    }),
  );
});

/** Only same-origin URLs are allowed; anything else falls back to the store home. */
function safeTarget(raw) {
  try {
    const u = new URL(typeof raw === "string" ? raw : "/", self.location.origin);
    if (u.origin !== self.location.origin) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(target); } catch { /* ignore */ }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
