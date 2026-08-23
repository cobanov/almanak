/**
 * CLI harness for the parser and store, so M1 can be verified without any UI.
 *
 *   node scripts/harness.ts <archive-path> [search terms...]
 *
 * Reads from the filesystem through the same ArchiveSource interface the
 * browser uses, so the code under test is the shipping code.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArchive } from '../src/archive/parse.ts'
import { MemoryStore } from '../src/store/MemoryStore.ts'
import { emptyFilters } from '../src/store/TweetStore.ts'
import type { ArchiveSource } from '../src/archive/source.ts'
import { assertReadableDataFile, assertReadableMediaPath } from '../src/archive/dm-guard.ts'

class NodeSource implements ArchiveSource {
  readonly kind = 'directory' as const
  readonly label: string
  #root: string
  constructor(root: string) { this.#root = root; this.label = root }

  async list() {
    return readdirSync(join(this.#root, 'data')).filter((f) => f.endsWith('.js'))
  }
  async readData(name: string) {
    assertReadableDataFile(`data/${name}`)
    return new Uint8Array(readFileSync(join(this.#root, 'data', name)))
  }
  async listMedia() {
    const dir = join(this.#root, 'data', 'tweets_media')
    return existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : []
  }
  async readMedia(name: string): Promise<Blob> {
    assertReadableMediaPath(`data/tweets_media/${name}`)
    return new Blob([readFileSync(join(this.#root, 'data', 'tweets_media', name))])
  }
}

const root = process.argv[2]
if (!root) {
  console.error('usage: node scripts/harness.ts <archive-path> [search terms...]')
  process.exit(1)
}
const searchTerms = process.argv.slice(3)

const t0 = performance.now()
const parsed = await parseArchive(new NodeSource(root), (p) => {
  if (p.phase !== 'done') process.stderr.write(`\r  ${p.message}...`.padEnd(40))
})
const parseMs = performance.now() - t0
process.stderr.write('\r'.padEnd(42) + '\r')

const store = new MemoryStore(parsed)
const m = store.meta
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

console.log(`archive      ${m.handle} · generated ${m.generatedAt.slice(0, 10)}`)
console.log(`parsed in    ${parseMs.toFixed(0)} ms`)
console.log(`tweets       ${m.tweetCount.toLocaleString()}`)
console.log(`media        ${m.mediaCount.toLocaleString()}`)
console.log(`span         ${iso(m.firstAt)} → ${iso(m.lastAt)}`)
console.log(`threads      ${store.threads.length} (longest ${store.threads[0]?.length ?? 0})`)
console.log(`DMs          ${m.hadDirectMessages ? 'found and skipped' : 'none'}`)
if (m.absentFiles.length) console.log(`not shipped  ${m.absentFiles.join(', ')}`)
if (m.unverifiedPaths.length) console.log(`unverified   ${m.unverifiedPaths.join(', ')}`)

const kinds = new Map<string, number>()
for (const t of store.tweets) kinds.set(t.kind, (kinds.get(t.kind) ?? 0) + 1)
console.log(`\nkinds        ${[...kinds].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  ')}`)

const revised = store.tweets.filter((t) => t.revisions > 1)
console.log(`edited       ${revised.length} tweets collapsed from ${revised.reduce((s, t) => s + t.revisions, 0)} records`)

const missingMedia = store.tweets.flatMap((t) => t.media).filter((x) => !x.present)
console.log(`media gaps   ${missingMedia.length}`)

// Entity offsets must resolve against the UTF-16 string after conversion.
let good = 0, bad = 0
for (const t of store.tweets) {
  for (const e of t.entities) {
    if (e.start === null || e.end === null) continue
    const slice = t.text.slice(e.start, e.end)
    const want = e.kind === 'mention' ? `@${e.text}` : e.kind === 'hashtag' ? `#${e.text}` : null
    if (want === null) continue
    if (slice === want) good++; else bad++
  }
}
console.log(`entity spans ${good} resolve, ${bad} do not`)

for (const term of searchTerms) {
  const f = { ...emptyFilters(), query: term }
  const t1 = performance.now()
  const hits = store.query(f)
  const ms = performance.now() - t1
  console.log(`\nsearch "${term}"  ${hits.length} hits in ${ms.toFixed(1)} ms`)
  for (const h of hits.slice(0, 3)) {
    console.log(`  ${iso(h.at)} [${h.kind}] ${h.text.replace(/\n/g, ' ').slice(0, 68)}`)
  }
}

for (const g of ['year', 'month'] as const) {
  const b = store.buckets(g)
  console.log(`\nbuckets ${g}: ${b.length}, peak ${Math.max(...b.map((x) => x.total))}`)
}
