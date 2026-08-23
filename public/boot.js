/*
  Applies the stored theme before first paint, so there is no flash of the
  wrong one. It has to run before the bundle, and it has to be a file rather
  than an inline block because the site's Content-Security-Policy sets
  `script-src 'self'`.
*/
try {
  var t = localStorage.getItem('theme')
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t)
} catch (e) {
  // Storage blocked. The media query decides instead, which is a fine default.
}
