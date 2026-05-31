const CACHE_NAME = "openresto-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// Page sends this after brand loads; we patch /manifest.json in the cache so the
// PWA install prompt picks up the right name, theme colour, and icon.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "BRAND_UPDATE") return;
  const { name, themeColor, hasIcon } = event.data.brand;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Fetch the canonical manifest directly from the network (SW fetch() calls
      // bypass this SW's own fetch handler, so no circular interception).
      let baseManifest;
      try {
        baseManifest = await fetch("/manifest.json").then((r) => r.json());
      } catch {
        const cached = await cache.match("/manifest.json");
        if (!cached) return;
        baseManifest = await cached.json();
      }

      baseManifest.name = name;
      baseManifest.short_name = name.length > 12 ? name.slice(0, 12) : name;
      baseManifest.theme_color = themeColor;

      if (hasIcon) {
        baseManifest.icons = [
          { src: "/api/brand/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          {
            src: "/api/brand/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ];
      }

      await cache.put(
        "/manifest.json",
        new Response(JSON.stringify(baseManifest), {
          headers: { "Content-Type": "application/manifest+json" },
        })
      );
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Manifest is managed by the BRAND_UPDATE handler above; serve cache-first so
  // the patched version is always used rather than being overwritten by the network.
  if (url.pathname === "/manifest.json") {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }

  // Everything else: network-first, cache as fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
