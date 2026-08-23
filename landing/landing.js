/*
  The landing page's behaviour.

  This lives in a file rather than inline because the site ships a strict
  Content-Security-Policy with `script-src 'self'`, which refuses inline
  script. An inline block still appears in the DOM when it is refused, so the
  failure is silent: the page looks right and simply does nothing.
*/
// Hand interaction to the embedded app only once it is asked for, so the
  // page stays scrollable past it.
  var frame = document.querySelector('.gate-frame')
  var veil = document.querySelector('.gate-veil')
  if (frame && veil) {
    veil.addEventListener('click', function () {
      // Below 768 the frame is a preview: dragging a scrubber inside a phone
      // -width iframe is not something anyone can do, so the demo opens on its
      // own instead of becoming interactive in place.
      if (window.matchMedia('(max-width: 767px)').matches) {
        location.href = './app/?demo=1'
        return
      }
      frame.classList.add('live')
      var f = frame.querySelector('iframe')
      if (f) f.focus()
    })
  }

  /*
    Dropping an archive here starts it immediately.

    A File cannot travel in a URL, so it is parked in IndexedDB and collected by
    the app on the other side of the navigation. Both pages are the same origin,
    so they share the database. Nothing is uploaded: this is the browser handing
    a file to itself.
  */
  (function () {
    var drop = document.getElementById('drop')
    var picker = document.getElementById('dropFile')
    if (!drop) return

    var label = drop.querySelector('.drop-text strong')
    var hint = drop.querySelector('.drop-text small')
    var defaultLabel = label.textContent
    var defaultHint = hint.textContent

    function say(text, detail, state) {
      label.textContent = text
      hint.textContent = detail
      drop.classList.remove('over', 'error', 'busy')
      if (state) drop.classList.add(state)
    }

    function reset() {
      setTimeout(function () { say(defaultLabel, defaultHint) }, 3200)
    }

    function park(value) {
      return new Promise(function (resolve, reject) {
        var open = indexedDB.open('almanak-handoff', 1)
        open.onupgradeneeded = function () {
          if (!open.result.objectStoreNames.contains('pending')) {
            open.result.createObjectStore('pending')
          }
        }
        open.onerror = function () { reject(open.error) }
        open.onsuccess = function () {
          var db = open.result
          var tx = db.transaction('pending', 'readwrite')
          tx.objectStore('pending').put(value, 'archive')
          tx.oncomplete = function () { db.close(); resolve() }
          tx.onerror = function () { db.close(); reject(tx.error) }
        }
      })
    }

    function start(value, name) {
      say('Opening ' + name, 'reading it in your browser', 'busy')
      park(value).then(function () {
        location.href = './app/?handoff=1'
      }).catch(function () {
        // Storage blocked, private window, or quota. The app can still take a
        // drop directly, so send them there rather than dead-ending.
        say('Could not hand it over', 'opening the app so you can drop it there', 'error')
        setTimeout(function () { location.href = './app/' }, 1200)
      })
    }

    drop.addEventListener('click', function () {
      if (window.showDirectoryPicker) {
        window.showDirectoryPicker({ mode: 'read' }).then(function (handle) {
          start({ kind: 'directory', handle: handle, label: handle.name }, handle.name)
        }).catch(function () { /* the picker was dismissed */ })
      } else {
        picker.click()
      }
    })

    picker.addEventListener('change', function () {
      var file = picker.files && picker.files[0]
      if (file) start({ kind: 'zip', file: file }, file.name)
    })

    ;['dragenter', 'dragover'].forEach(function (type) {
      drop.addEventListener(type, function (e) {
        e.preventDefault()
        drop.classList.add('over')
      })
    })
    ;['dragleave', 'dragend'].forEach(function (type) {
      drop.addEventListener(type, function () { drop.classList.remove('over') })
    })

    drop.addEventListener('drop', function (e) {
      e.preventDefault()
      drop.classList.remove('over')

      var items = e.dataTransfer && e.dataTransfer.items
      // A dropped folder arrives as a handle; a dropped export as a ZIP file.
      if (items && items.length && items[0].getAsFileSystemHandle) {
        items[0].getAsFileSystemHandle().then(function (handle) {
          if (handle && handle.kind === 'directory') {
            start({ kind: 'directory', handle: handle, label: handle.name }, handle.name)
            return
          }
          takeFile(e)
        }).catch(function () { takeFile(e) })
        return
      }
      takeFile(e)
    })

    function takeFile(e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (!file) {
        say('That did not carry a file', 'drop the ZIP, or the unzipped folder', 'error')
        reset()
        return
      }
      if (!/\.zip$/i.test(file.name)) {
        say('That is not an X export', 'drop the ZIP from X, or its unzipped folder', 'error')
        reset()
        return
      }
      start({ kind: 'zip', file: file }, file.name)
    }

    // A file dropped anywhere else would otherwise be opened by the browser,
    // which looks like the page crashed.
    ;['dragover', 'drop'].forEach(function (type) {
      window.addEventListener(type, function (e) {
        if (!drop.contains(e.target)) e.preventDefault()
      })
    })
  })()
