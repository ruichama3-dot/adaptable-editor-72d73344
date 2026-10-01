// Retire the previous app cache without touching other services on this origin.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.filter((name) => name.startsWith("ruje-ia-")).map((name) => caches.delete(name)));
      await self.clients.claim();
    } finally {
      await self.registration.unregister();
    }
  })()),
);
