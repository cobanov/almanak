/**
 * Assemble the landing page into dist/.
 *
 * The app builds to dist/app/, so the root is free for the page that
 * introduces it. Same origin, one deploy, and the demo in the hero is the
 * real application in an iframe rather than a recording of it.
 *
 * Fonts are copied out of node_modules under stable names, because the page is
 * plain HTML with no bundler to fingerprint them for it.
 */

import { copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist')

if (!existsSync(join(dist, 'app'))) {
  console.error('dist/app is missing. The app has to build before the landing.')
  process.exit(1)
}

// --- fonts ------------------------------------------------------------------
const fontDir = join(dist, 'fonts')
mkdirSync(fontDir, { recursive: true })

const wanted: [string, string][] = [
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-400-normal.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-500-normal.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-600-normal.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-ext-400-normal.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-ext-600-normal.woff2'],
  ['@fontsource/ibm-plex-mono/files', 'ibm-plex-mono-latin-400-normal.woff2'],
]

let copied = 0
for (const [pkg, file] of wanted) {
  const from = join(root, 'node_modules', pkg, file)
  if (!existsSync(from)) {
    console.error(`  missing font: ${file}`)
    continue
  }
  copyFileSync(from, join(fontDir, file))
  copied++
}

// --- page and assets --------------------------------------------------------
copyFileSync(join(root, 'landing', 'index.html'), join(dist, 'index.html'))
// The page's behaviour lives in a file, because the CSP refuses inline script.
copyFileSync(join(root, 'landing', 'landing.js'), join(dist, 'landing.js'))
// The language has to be settled before the first paint, so this one is loaded
// synchronously from <head> rather than deferred with the rest.
copyFileSync(join(root, 'landing', 'lang-boot.js'), join(dist, 'lang-boot.js'))

// The SIL Open Font License requires the licence to travel with the fonts, and
// we serve the woff2 files ourselves.
copyFileSync(join(root, 'licenses', 'IBM-Plex-OFL.txt'), join(fontDir, 'LICENSE.txt'))

// A root-scoped worker from an earlier layout would otherwise keep serving a
// cached copy of a site that has moved. This one deletes itself.
copyFileSync(join(root, 'landing', 'sw.js'), join(dist, 'sw.js'))

const assets = join(root, 'landing', 'assets')
if (existsSync(assets)) {
  cpSync(assets, join(dist, 'assets'), { recursive: true })
}

// Cloudflare Pages reads _headers and _redirects from the output root; the
// crawler files belong there too.
for (const f of ['_headers', '_redirects', 'robots.txt', 'sitemap.xml']) {
  const from = join(root, 'landing', f)
  if (existsSync(from)) copyFileSync(from, join(dist, f))
}

console.log(`landing: index.html + ${copied} fonts -> dist/`)
console.log(`  app at /app/, demo embedded from /app/?demo=1&embed=1`)
void readdirSync
