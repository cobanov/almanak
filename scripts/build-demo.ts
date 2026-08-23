/**
 * Copy the redacted fixture archive into public/demo/ and write the index the
 * BundledSource reads. This is what a visitor sees before deciding whether to
 * trust the app with their own export.
 */

import { readdirSync, mkdirSync, copyFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const src = join(root, 'fixtures', 'demo')
const out = join(process.cwd(), 'public', 'demo')

// The demo archive is generated, not committed, so a fresh clone has none.
// Building it here rather than failing means `npm run build` works on checkout,
// which is the command the README tells people to run.
if (!existsSync(src)) {
  console.log('fixtures/demo is missing, generating it')
  execFileSync(process.execPath, [join(root, 'scripts', 'make-demo-archive.ts'), src], {
    stdio: 'inherit',
  })
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
