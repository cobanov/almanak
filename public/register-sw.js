/*
  Registers the service worker that makes the app work offline.

  A file rather than an inline block, because the site's Content-Security-Policy
  sets `script-src 'self'`. Offline support is a bonus: a failure here leaves a
  working app.
*/
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {})
  })
}
