/**
 * Archive reconnaissance.
 *
 *   node scripts/inspect-archive.ts <path-to-archive> [--out docs/ARCHIVE-FORMAT.md]
 *
 * Surveys a real X export and writes down what is actually in it: which data
 * files exist, every key that appears across their records with its type and
 * fill rate, redacted samples, and a catalogue of the media folder.
 *
 * X has changed this format repeatedly and quietly. The point of this script
 * is that the format document describes an archive we read, not an archive we
 * remember.
 *
 * Direct-message files are listed but never opened. See src/archive/dm-guard.
 */

import { readFileSync, statSync, readdirSync, existsSync, writeFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { parseArchiveFile, parseManifest, readGlobalName, HEAD_PROBE_BYTES, type ArchiveManifest } from '../src/archive/read.ts'
import { isDirectMessagePath } from '../src/archive/dm-guard.ts'
import { Pseudonyms, redactRecord } from './redact.ts'

// ----------------------------------------------------------------- plumbing

const argv = process.argv.slice(2)
const archivePath = argv.find((a) => !a.startsWith('--'))
const outFlag = argv.indexOf('--out')
const outPath = outFlag >= 0 ? argv[outFlag + 1] : 'docs/ARCHIVE-FORMAT.md'

if (!archivePath) {
  console.error('usage: node scripts/inspect-archive.ts <path-to-archive> [--out FILE]')
  process.exit(1)
}

const dataDir = join(archivePath, 'data')
if (!existsSync(dataDir)) {
  console.error(`No data/ directory under ${archivePath}. Is this an unzipped X export?`)
  process.exit(1)
}

const names = new Pseudonyms()
const out: string[] = []
/** Write a line to the report and echo it, so a run is readable live. */
const say = (line = '') => { out.push(line); console.log(line) }

const bytes = (n: number) => {
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n, u = 0
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v < 10 && u > 0 ? v.toFixed(1) : Math.round(v)} ${units[u]}`
}
const pct = (part: number, total: number) => total === 0 ? '0%' : `${((100 * part) / total).toFixed(1)}%`

/** Read only the first bytes of a file — enough to identify its assignment. */
function readHead(path: string, n = HEAD_PROBE_BYTES): Uint8Array {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(n)
    const read = readSync(fd, buf, 0, n, 0)
    return new Uint8Array(buf.subarray(0, read))
  } finally { closeSync(fd) }
}

// ------------------------------------------------------------- key surveying

interface KeyStat { present: number; nonEmpty: number; types: Set<string>; sample?: unknown }

/** JS type name, distinguishing arrays and nulls from plain objects. */
function typeName(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

/**
 * Walk a record and record every key path seen. Arrays are summarised as
 * `path[]` and descended into once, so `entities.media[].type` appears
 * without one entry per index.
 */
function walk(value: unknown, stats: Map<string, KeyStat>, path = '', depth = 0): void {
  if (depth > 4 || value === null || typeof value !== 'object') return

  if (Array.isArray(value)) {
    if (value.length > 0) walk(value[0], stats, `${path}[]`, depth + 1)
    return
  }

  for (const [k, v] of Object.entries(value)) {
    const p = path ? `${path}.${k}` : k
    let s = stats.get(p)
    if (!s) stats.set(p, (s = { present: 0, nonEmpty: 0, types: new Set() }))
    s.present++
    s.types.add(typeName(v))
    const empty = v === null || v === '' ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)
    if (!empty) {
      s.nonEmpty++
      if (s.sample === undefined && typeof v !== 'object') s.sample = v
    }
    walk(v, stats, p, depth + 1)
  }
}

// -------------------------------------------------------------------- report

const manifestPath = join(dataDir, 'manifest.js')
if (!existsSync(manifestPath)) {
  console.error('No data/manifest.js. Cannot identify this archive.')
  process.exit(1)
}
const manifest: ArchiveManifest = parseManifest(readFileSync(manifestPath))

say(`# Archive format`)
say()
say(`What is actually inside one real X export, read by \`scripts/inspect-archive.ts\`.`)
say(`Every sample below is redacted: letters are substituted within their own`)
say(`alphabet, and handles, ids and URLs carry stable pseudonyms.`)
say()
say(`| | |`)
say(`|---|---|`)
say(`| Generated | ${manifest.archiveInfo.generationDate} |`)
say(`| Declared size | ${bytes(Number(manifest.archiveInfo.sizeBytes))} |`)
say(`| \`isPartialArchive\` | \`${manifest.archiveInfo.isPartialArchive}\` |`)
say(`| Data types declared | ${Object.keys(manifest.dataTypes).length} |`)
say()

// --- files ------------------------------------------------------------------

interface FileEntry {
  fileName: string; globalName: string; declaredCount: number
  path: string; size: number; exists: boolean; isDM: boolean
}

const files: FileEntry[] = []
for (const [, type] of Object.entries(manifest.dataTypes)) {
  for (const f of type.files ?? []) {
    const path = join(archivePath, f.fileName)
    const exists = existsSync(path)
    files.push({
      fileName: f.fileName, globalName: f.globalName, declaredCount: Number(f.count),
      path, exists, size: exists ? statSync(path).size : 0,
      isDM: isDirectMessagePath(f.fileName),
    })
  }
}
files.sort((a, b) => b.size - a.size)

say(`## Files`)
say()
say(`Listed largest first. Direct-message files are listed for completeness and`)
say(`**never opened** — their record counts come from the manifest alone.`)
say()
say(`| File | Global | Records | Size | Read? |`)
say(`|---|---|---:|---:|---|`)
for (const f of files) {
  const read = f.isDM ? 'no — DM' : f.exists ? 'yes' : 'missing'
  say(`| \`${f.fileName}\` | \`${f.globalName}\` | ${f.declaredCount.toLocaleString()} | ${bytes(f.size)} | ${read} |`)
}
say()

// Files X used to ship that this export does not contain.
const EXPECTED_ELSEWHERE = [
  'account.js', 'profile.js', 'like.js', 'follower.js', 'following.js',
  'note-tweet.js', 'community-tweet.js', 'moment.js', 'block.js', 'mute.js',
  'lists-created.js', 'personalization.js',
]
const missing = EXPECTED_ELSEWHERE.filter((n) => !existsSync(join(dataDir, n)))
if (missing.length) {
  say(`### Not present in this export`)
  say()
  say(`Files that older archives shipped and this one does not, despite`)
  say(`\`isPartialArchive: ${manifest.archiveInfo.isPartialArchive}\`:`)
  say()
  for (const m of missing) say(`- \`${m}\``)
  say()
}

// --- key survey -------------------------------------------------------------

const readable = files.filter((f) => f.exists && !f.isDM && f.size > 0).slice(0, 10)

say(`## Fields`)
say()

const parsed = new Map<string, unknown[]>()

for (const f of readable) {
  const raw = readFileSync(f.path)
  const global = readGlobalName(readHead(f.path))
  let records: unknown[]
  try {
    const value = parseArchiveFile(new Uint8Array(raw))
    records = Array.isArray(value) ? value : [value]
  } catch (e) {
    say(`### \`${basename(f.fileName)}\` — could not parse: ${(e as Error).message}`)
    say()
    continue
  }
  parsed.set(basename(f.fileName), records)

  say(`### \`${basename(f.fileName)}\``)
  say()
  say(`\`${global}\` — ${records.length.toLocaleString()} records, ${bytes(f.size)}.`)
  if (records.length !== f.declaredCount) {
    say(`Manifest declares ${f.declaredCount.toLocaleString()}; the file holds ${records.length.toLocaleString()}.`)
  }
  say()

  if (records.length === 0) { say(`Empty.`); say(); continue }

  const stats = new Map<string, KeyStat>()
  for (const r of records) walk(r, stats)

  say(`| Key | Type | Present | Non-empty | Example |`)
  say(`|---|---|---:|---:|---|`)
  const rows = [...stats.entries()].sort((a, b) => b[1].nonEmpty - a[1].nonEmpty || a[0].localeCompare(b[0]))
  for (const [path, s] of rows) {
    // Fill rate is against the containing collection, not the file, for
    // nested array members — those have their own denominators.
    const denom = path.includes('[]') ? s.present : records.length
    // The example column goes through the redactor like everything else. It
    // pulled raw values until a review found a real status URL and a real
    // account id sitting in this table under a heading promising redaction.
    const leaf = path.split('.').pop()?.replace('[]', '') ?? ''
    const example = s.sample === undefined ? '' :
      '`' + String(redactRecord(s.sample, names, leaf, path.split('.')))
        .slice(0, 40).replace(/\|/g, '\\|').replace(/\n/g, ' ') + '`'
    say(`| \`${path}\` | ${[...s.types].sort().join(' \\| ')} | ${pct(s.present, denom)} | ${pct(s.nonEmpty, denom)} | ${example} |`)
  }
  say()

  say(`<details><summary>Three redacted records</summary>`)
  say()
  say('```json')
  const step = Math.max(1, Math.floor(records.length / 3))
  for (let i = 0; i < 3 && i * step < records.length; i++) {
    say(JSON.stringify(redactRecord(records[i * step], names), null, 2))
  }
  say('```')
  say()
  say(`</details>`)
  say()
}

// --- media ------------------------------------------------------------------

say(`## Media`)
say()
const mediaDirs = [...new Set(Object.values(manifest.dataTypes).map((t) => t.mediaDirectory).filter(Boolean) as string[])]
for (const rel of mediaDirs) {
  const dir = join(archivePath, rel)
  const isDM = isDirectMessagePath(rel)
  if (!existsSync(dir)) { say(`- \`${rel}/\` — declared, not present`); continue }
  const entries = readdirSync(dir).filter((n) => !n.startsWith('.'))
  if (isDM) {
    say(`- \`${rel}/\` — ${entries.length.toLocaleString()} files. **Not catalogued: direct-message media.**`)
    continue
  }
  const exts = new Map<string, number>()
  let total = 0
  for (const n of entries) {
    total += statSync(join(dir, n)).size
    const e = n.includes('.') ? n.slice(n.lastIndexOf('.') + 1).toLowerCase() : '(none)'
    exts.set(e, (exts.get(e) ?? 0) + 1)
  }
  say()
  say(`### \`${rel}/\``)
  say()
  say(`${entries.length.toLocaleString()} files, ${bytes(total)}.`)
  say()
  say(`| Extension | Files |`)
  say(`|---|---:|`)
  for (const [e, c] of [...exts].sort((a, b) => b[1] - a[1])) say(`| \`.${e}\` | ${c.toLocaleString()} |`)
  say()
  const pattern = /^(\d+)-(.+)\.([a-z0-9]+)$/i
  const matched = entries.filter((n) => pattern.test(n))
  say(`Filename pattern \`{tweet_id}-{suffix}.{ext}\`: ${matched.length.toLocaleString()} of ${entries.length.toLocaleString()} match (${pct(matched.length, entries.length)}).`)
  const byExt = new Map<string, string>()
  for (const n of entries) { const e = n.slice(n.lastIndexOf('.') + 1).toLowerCase(); if (!byExt.has(e)) byExt.set(e, n) }
  say()
  say(`One example filename per extension, id redacted:`)
  say()
  for (const [e, n] of byExt) {
    const m = n.match(pattern)
    say(`- \`.${e}\` — \`${m ? `${names.id(m[1])}-${m[2]}.${m[3]}` : n}\``)
  }
  say()
}

// --- derived facts about tweets --------------------------------------------

const tweetRecords = parsed.get('tweets.js') ?? parsed.get('tweet.js')
if (tweetRecords) {
  const tw = tweetRecords.map((r) => (r as { tweet: Record<string, any> }).tweet)
  const n = tw.length
  const accountId = manifest.userInfo.accountId

  const dates = tw.map((t) => new Date(t.created_at)).sort((a, b) => +a - +b)
  const counter = <T,>(vals: T[]) => {
    const m = new Map<T, number>()
    for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1])
  }

  const rts = tw.filter((t) => t.full_text.startsWith('RT @')).length
  const replies = tw.filter((t) => t.in_reply_to_user_id_str).length
  const selfReplies = tw.filter((t) => t.in_reply_to_user_id_str === accountId).length
  const quotes = tw.filter((t) => (t.entities?.urls ?? []).some((u: any) => /\/status\/\d+/.test(u.expanded_url ?? ''))).length
  const truncated = tw.filter((t) => t.truncated).length
  const withMedia = tw.filter((t) => (t.extended_entities?.media ?? []).length > 0).length
  const lens = tw.map((t) => (t.full_text as string).length).sort((a, b) => a - b)
  const favs = tw.map((t) => Number(t.favorite_count))

  say(`## What the tweets are`)
  say()
  say(`Derived from \`tweets.js\`, ${n.toLocaleString()} records. These are the facts`)
  say(`that shape the product, not just the parser.`)
  say()
  say(`| Fact | Value |`)
  say(`|---|---|`)
  say(`| Date range | ${dates[0].toISOString().slice(0, 10)} → ${dates[n - 1].toISOString().slice(0, 10)} |`)
  say(`| Replies (to anyone) | ${replies.toLocaleString()} — ${pct(replies, n)} |`)
  say(`| Self-replies (threads) | ${selfReplies.toLocaleString()} — ${pct(selfReplies, n)} |`)
  say(`| Replies to others | ${(replies - selfReplies).toLocaleString()} — ${pct(replies - selfReplies, n)} |`)
  say(`| Retweets (\`RT @\` prefix) | ${rts.toLocaleString()} — ${pct(rts, n)} |`)
  say(`| Quote tweets (status URL) | ${quotes.toLocaleString()} — ${pct(quotes, n)} |`)
  say(`| With media | ${withMedia.toLocaleString()} — ${pct(withMedia, n)} |`)
  say(`| \`truncated: true\` | ${truncated.toLocaleString()} |`)
  say(`| Text length | median ${lens[n >> 1]}, p99 ${lens[Math.floor(n * 0.99)]}, max ${lens[n - 1]} |`)
  say(`| Over 280 chars | ${lens.filter((l) => l > 280).length.toLocaleString()} |`)
  say(`| \`favorite_count\` zero | ${favs.filter((f) => f === 0).length.toLocaleString()} — ${pct(favs.filter((f) => f === 0).length, n)} |`)
  say(`| \`favorite_count\` max | ${Math.max(...favs).toLocaleString()} |`)
  say()

  say(`### Per year`)
  say()
  say(`| Year | Tweets |`)
  say(`|---|---:|`)
  for (const [y, c] of counter(dates.map((d) => d.getUTCFullYear())).sort((a, b) => a[0] - b[0])) {
    say(`| ${y} | ${c.toLocaleString()} |`)
  }
  say()

  say(`### Languages`)
  say()
  say(`X's \`lang\` includes non-languages: \`qme\` and \`zxx\` both mean "media, no text".`)
  say(`A language filter that lists them as languages will look broken.`)
  say()
  say(`| \`lang\` | Tweets |`)
  say(`|---|---:|`)
  for (const [l, c] of counter(tw.map((t) => t.lang as string)).slice(0, 12)) say(`| \`${l}\` | ${c.toLocaleString()} |`)
  say()

  say(`### Clients`)
  say()
  say(`| \`source\` | Tweets |`)
  say(`|---|---:|`)
  for (const [s, c] of counter(tw.map((t) => String(t.source).replace(/<[^>]+>/g, '')))) {
    say(`| ${s || '(empty)'} | ${c.toLocaleString()} |`)
  }
  say()

  // Media join integrity, and thread depth: both load-bearing for M1.
  const mediaDir = join(archivePath, 'data', 'tweets_media')
  if (existsSync(mediaDir)) {
    const onDisk = readdirSync(mediaDir).filter((f) => !f.startsWith('.'))
    const byId = new Map<string, number>()
    for (const f of onDisk) {
      const id = f.slice(0, f.indexOf('-'))
      byId.set(id, (byId.get(id) ?? 0) + 1)
    }
    const ids = new Set(tw.map((t) => t.id_str as string))
    let referenced = 0, unresolved = 0
    for (const t of tw) {
      for (const _ of t.extended_entities?.media ?? []) {
        referenced++
        if (!byId.has(t.id_str)) unresolved++
      }
    }
    const orphans = [...byId].filter(([id]) => !ids.has(id)).reduce((s, [, c]) => s + c, 0)
    say(`### Media join`)
    say()
    say(`Splitting each filename on its first \`-\` and joining to \`tweet.id_str\`:`)
    say()
    say(`- ${referenced.toLocaleString()} media references in \`tweets.js\``)
    say(`- ${onDisk.length.toLocaleString()} files in \`tweets_media/\``)
    say(`- ${unresolved.toLocaleString()} references with no file on disk`)
    say(`- ${orphans.toLocaleString()} files whose tweet id is not in \`tweets.js\``)
    say()
  }

  const byId = new Map(tw.map((t) => [t.id_str as string, t]))
  const depth = new Map<string, number>()
  const depthOf = (id: string): number => {
    const cached = depth.get(id)
    if (cached) return cached
    const t = byId.get(id)
    const parent = t?.in_reply_to_user_id_str === accountId ? (t.in_reply_to_status_id_str as string) : undefined
    const d = parent && byId.has(parent) ? depthOf(parent) + 1 : 1
    depth.set(id, d)
    return d
  }
  for (const id of byId.keys()) depthOf(id)
  const hist = counter([...depth.values()]).sort((a, b) => a[0] - b[0])
  say(`### Threads`)
  say()
  say(`Chains built from \`in_reply_to_status_id_str\` where the parent is also mine`)
  say(`and also present in this archive. Longest chain: ${Math.max(...depth.values())} tweets.`)
  say()
  say(`| Position in chain | Tweets |`)
  say(`|---|---:|`)
  for (const [d, c] of hist) say(`| ${d} | ${c.toLocaleString()} |`)
  say()
}

// --- traps -------------------------------------------------------------------

say(`## Traps`)
say()
say(`Things that are true of the format and easy to get wrong. Each was`)
say(`confirmed against the archive surveyed above.`)
say()
say(`**Data files are JavaScript, not JSON.** Every file opens with an`)
say(`assignment like \`window.YTD.tweets.part0 = \`. Find the value by scanning`)
say(`bytes for the first \`=\`, not by running a regular expression over the`)
say(`file — these reach hundreds of megabytes and the prefix ends at byte ~30.`)
say()
say(`**The manifest is the exception.** It assigns \`window.__THAR_CONFIG\`, not`)
say(`a \`YTD.*\` name, and its shape is an object rather than an array.`)
say()
say(`**Numbers arrive as strings.** \`favorite_count\`, \`retweet_count\`,`)
say(`\`display_text_range\`, \`entities.*.indices\` and \`editsRemaining\` are all`)
say(`JSON strings. Comparing them without coercion sorts 9 above 10.`)
say()
say(`**Every tweet carries \`edit_info\`.** An edited tweet lists several ids in`)
say(`\`edit_info.initial.editTweetIds\`. Deduplicate on \`id_str\` and treat the`)
say(`other ids as aliases, or an edited tweet with media can join twice.`)
say()
say(`**\`lang\` is unreliable and not always a language.** \`qme\`, \`qam\` and`)
say(`\`zxx\` mean "media, no text". X's detector is also poor on short text: in`)
say(`this archive a 21-character Turkish reply is labelled \`it\`. Since most`)
say(`tweets here are short replies, treat \`lang\` as a weak hint, never a fact.`)
say()
say(`**Entity indices are codepoint offsets, not UTF-16 code units.** This was`)
say(`settled empirically: across tweets with an astral character before the`)
say(`entity, the offsets match codepoint slicing 94 times out of 98 and UTF-16`)
say(`slicing 0 times out of 98. JavaScript strings are UTF-16, so`)
say(`\`text.slice(...indices)\` silently returns the wrong span for any tweet`)
say(`containing an emoji before a mention — 1,875 of them in this archive.`)
say(`Slice \`[...text]\` instead, or convert the offsets once at parse time.`)
say()
say(`**An edited tweet is stored once per revision.** Each revision is a separate`)
say(`record with its own \`id_str\`, and \`edit_info\` has two shapes: the original`)
say(`carries \`edit_info.initial.editTweetIds\` listing every revision, while later`)
say(`revisions carry \`edit_info.edit.initialTweetId\` pointing back. Only the last`)
say(`revision holds real engagement — one tweet in this archive appears three`)
say(`times, 31 seconds apart, with favourite counts of 1, 2 and 493. Collapse`)
say(`each edit group to its newest revision or the archive over-reports itself.`)
say()
say(`**Video filenames differ from photo filenames.** Photos are`)
say(`\`{tweet_id}-{media_id}.jpg\`; videos are \`{tweet_id}-{url_hash}.mp4\`,`)
say(`where the suffix comes from the video URL rather than the media id.`)
say(`Splitting on the first \`-\` works for both; matching the suffix to`)
say(`\`media.id_str\` does not.`)
say()
say(`**The other half of a conversation is not in the archive.** A reply`)
say(`carries \`in_reply_to_status_id_str\` and \`in_reply_to_screen_name\`, never`)
say(`the parent's text. Unless the parent is also yours, it cannot be shown.`)
say(`A quote tweet is worse: it is identifiable only by a \`/status/\` link in`)
say(`\`entities.urls\`, and the quoted text is absent entirely.`)
say()
say(`**Retweets are lossy.** They appear as \`full_text\` beginning \`RT @handle: \``)
say(`and are frequently cut off mid-word with an ellipsis. They are a record`)
say(`that you retweeted something, not a copy of what you retweeted.`)
say()
say(`**Direct messages are never opened.** They sit in the same folder tree the`)
say(`app takes a directory handle on, so the boundary is enforced in code —`)
say(`\`src/archive/dm-guard.ts\` — and tested, not merely intended.`)
say()

say(`---`)
say()
say(`Regenerate with \`node scripts/inspect-archive.ts <archive> --out ${outPath}\`.`)

// --- self-check ---------------------------------------------------------
// The report claims every sample in it is redacted. Verify that claim before
// writing rather than asserting it in prose: an earlier version leaked a real
// status URL and a real account id through the "Example" column.

const report = out.join('\n') + '\n'
const mustNotAppear: [string, string][] = [
  ['account id', manifest.userInfo.accountId],
  ['user name', manifest.userInfo.userName],
  ['display name', manifest.userInfo.displayName],
]
const leaked = mustNotAppear.filter(([, value]) => value && report.includes(value))

if (leaked.length > 0) {
  console.error(`\nRefusing to write ${outPath}: it contains unredacted values.`)
  for (const [label, value] of leaked) {
    const line = report.split('\n').findIndex((l) => l.includes(value)) + 1
    console.error(`  ${label} appears at line ${line}`)
  }
  console.error(`\nThis is a redactor bug. Fix scripts/redact.ts, do not bypass this check.`)
  process.exit(1)
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, report)
console.error(`\nWrote ${outPath} — ${mustNotAppear.length} identifier checks passed`)
