const CACHE_NAME = "table-shell-v2";
const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    request.destination === "document" ||
    request.url.endsWith(".html")
  );
}

function isCacheableStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // HTML navigations always hit the network — never served from cache, so a
  // fresh deploy's markup/styling can never be masked by a stale cached page.
  if (isNavigationRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // Only the known static assets (manifest, icons) are cache-first. Everything
  // else — JS/CSS chunks, API/Firebase calls — passes straight through to the
  // network untouched by this service worker.
  if (isCacheableStaticAsset(request)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});
