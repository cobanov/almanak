/**
 * Copy the redacted fixture archive into public/demo/ and write the index the
 * BundledSource reads. This is what a visitor sees before deciding whether to
 * trust the app with their own export.
 */

import { readdirSync, mkdirSync, copyFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const src = join(process.cwd(), 'fixtures', 'demo')
const out = join(process.cwd(), 'public', 'demo')

if (!existsSync(src)) {
  console.error('fixtures/demo is missing. Run scripts/make-demo-archive.ts first.')
  process.exit(1)
}

if (existsSync(out)) rmSync(out, { recursive: true })
mkdirSync(join(out, 'data', 'tweets_media'), { recursive: true })

const data = readdirSync(join(src, 'data')).filter((f) => f.endsWith('.js'))
for (const f of data) copyFileSync(join(src, 'data', f), join(out, 'data', f))

const media = readdirSync(join(src, 'data', 'tweets_media')).filter((f) => !f.startsWith('.'))
for (const f of media) {
  copyFileSync(join(src, 'data', 'tweets_media', f), join(out, 'data', 'tweets_media', f))
}

writeFileSync(join(out, 'index.json'), JSON.stringify({ data, media }, null, 2))
console.log(`public/demo: ${data.length} data files, ${media.length} media files`)
