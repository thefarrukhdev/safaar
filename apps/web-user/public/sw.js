// Safaar service worker.
//
// Root cause of the "unsupported MIME type" console warning this file
// fixes: components/pwa/ServiceWorkerRegister.tsx (rendered from the root
// layout, production-only) has always called
// navigator.serviceWorker.register("/sw.js"), but this file never
// existed. Next.js's catch-all [lang] route served the app's HTML shell
// for that request instead (200, text/html) -- the browser rejects that
// as a script. Since this file now exists under public/, Next.js serves
// it as a real static asset with a correct JS content-type, and
// registration succeeds.
//
// This isn't just a stub to silence that warning: the app already ships
// real functionality that depends on an actual, working service worker
// -- an offline fallback page (app/[lang]/(main)/offline, whose own
// comment says "service worker tarmoq yo'q paytda shu sahifani
// ko'rsatadi") and web push notifications
// (components/features/pwa/PushSubscriptionManager.tsx, which awaits
// navigator.serviceWorker.ready and calls pushManager.subscribe() --
// that promise never resolved without a registered worker, and there
// was no `push` listener to ever display anything it received). Both
// are implemented below.

const CACHE_VERSION = "safaar-sw-v1";
const SUPPORTED_LOCALES = ["uz", "ru", "en"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        SUPPORTED_LOCALES.map((locale) =>
          fetch(`/${locale}/offline`, { cache: "reload" })
            .then((response) => (response.ok ? cache.put(`/${locale}/offline`, response) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function localeFromPath(pathname) {
  const match = pathname.match(/^\/(uz|ru|en)(?:\/|$)/);
  return match ? match[1] : "uz";
}

// Network-first for page navigations; on failure, fall back to the
// locale-appropriate cached offline page (pre-cached above, and
// refreshed opportunistically here on every successful visit to it).
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  const url = new URL(event.request.url);
  const offlinePath = `/${localeFromPath(url.pathname)}/offline`;

  if (url.pathname === offlinePath) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(offlinePath, copy));
          }
          return response;
        })
        .catch(() => caches.match(offlinePath)),
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(
      () => caches.match(offlinePath).then((cached) => cached || fetch(offlinePath)),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Safaar", body: "" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Safaar", {
      body: payload.body || "",
      icon: payload.icon || "/safaar.uz-favicon.png",
      badge: payload.badge || "/safaar.uz-favicon.png",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
