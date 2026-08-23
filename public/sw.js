/*
  Offline support.

  The strategy differs by what is being asked for, because getting this wrong
  means shipped updates never reach anyone:

  - index.html is network-first. Vite fingerprints asset filenames, so the
    HTML is the only file whose contents change at a stable URL. Serving it
    cache-first pins a visitor to whichever build they first loaded, forever.
  - Fingerprinted assets are cache-first. Their URL changes when they change,
    so a cached copy is never stale.
  - Demo data is cache-first for the same reason it is small and immutable.

  Only same-origin GETs are touched. This worker must never become a way for
  the app to reach anywhere else.
*/

const CACHE = 'almanak-v4'
const SHELL = './index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/** True for URLs whose contents cannot change without the URL changing. */
function isFingerprinted(pathname) {
  return /\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(pathname)
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (event.request.method !== 'GET') return

  const isDocument =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('index.html')

  if (isDocument) {
    // Network first, so a new build is picked up on the next load.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match(SHELL).then((hit) => hit ?? Response.error())),
    )
    return
  }

  const cacheable = isFingerprinted(url.pathname) || url.pathname.includes('/demo/')

  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit && cacheable) return hit
      return fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic' && cacheable) {
            const copy = response.clone()
            caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {})
          }
          return response
        })
        .catch(() => hit ?? caches.match(SHELL).then((shell) => shell ?? Response.error()))
    }),
  )
})
