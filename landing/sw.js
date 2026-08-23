/*
  A tombstone.

  Earlier builds served the app from the root and registered a service worker
  at "/", which took control of every request on the origin. Moving the app to
  /app/ does not remove that registration: a root-scoped worker keeps running,
  and keeps serving its cached copy of a site that no longer exists there.

  So the root still serves a worker — one whose only job is to delete its own
  caches, unregister itself, and reload the pages it controls. New visitors
  never register it; the landing page does not ask for one.
*/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.navigate(client.url)
    }
  })())
})
