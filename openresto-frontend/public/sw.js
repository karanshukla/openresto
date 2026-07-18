const CACHE_NAME = "openresto-v5";
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

// Page sends this after brand loads; patch name and theme_color in the cached
// manifest so the PWA install prompt reflects the current brand.
// The branded icon (/api/brand/pwa-icon.svg) is already in the static manifest
// so Chrome fetches it directly — no icon patching needed here.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "BRAND_UPDATE") return;
  const { name, themeColor } = event.data.brand;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

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

      await cache.put(
        "/manifest.json",
        new Response(JSON.stringify(baseManifest), {
          headers: { "Content-Type": "application/manifest+json" },
        })
      );
    })()
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/api/brand/pwa-icon-192.png",
      badge: "/api/brand/pwa-icon-192.png",
      tag: data.bookingId ? `booking-${data.bookingId}` : `capacity-${data.restaurantId}`,
      data: { url: "/admin/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
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
