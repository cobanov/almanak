/*
  The language, decided before the first word is painted.

  This runs synchronously in <head> rather than with the rest of the page's
  behaviour, so nobody sees English flash and then turn into Turkish. It sits
  in a file rather than inline because the site ships `script-src 'self'`,
  which refuses inline script silently.

  English is the default everywhere. The browser's own language is never
  consulted: Turkish is a choice the reader makes by pressing the button, not
  something inferred from where they happen to be.
*/
;(function () {
  var lang = 'en'
  try {
    lang = localStorage.getItem('lang') === 'tr' ? 'tr' : 'en'
  } catch (e) {
    // Private window, or storage refused. English is the right answer anyway.
  }
  document.documentElement.setAttribute('data-lang', lang)
  document.documentElement.lang = lang
})()
