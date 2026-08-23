/**
 * Build the test fixtures from a real archive.
 *
 *   node scripts/fixture-redactor.ts <path-to-archive>
 *
 * Selects records covering every edge case the format presents, redacts them,
 * and writes them out as a complete miniature archive under fixtures/archive/.
 * Because the output has the same directory layout as a real export, M1 tests
 * can run the whole parser against it rather than against hand-fed objects.
 *
 * Media files are regenerated as tiny valid placeholders with the correct
 * names. Nothing from the real media folder is copied.
 *
 * Cases the source archive does not contain are reported, not invented. They
 * are hand-written in fixtures/synthetic/ and labelled as unverified.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArchiveFile, parseManifest } from '../src/archive/read.ts'
import { Pseudonyms, redactRecord } from './redact.ts'

const archivePath = process.argv[2]
if (!archivePath) {
  console.error('usage: node scripts/fixture-redactor.ts <path-to-archive>')
  process.exit(1)
}

type Tweet = Record<string, any>
const dataDir = join(archivePath, 'data')
const manifest = parseManifest(readFileSync(join(dataDir, 'manifest.js')))
const accountId = manifest.userInfo.accountId

const records = parseArchiveFile<{ tweet: Tweet }[]>(readFileSync(join(dataDir, 'tweets.js')))
const tweets = records.map((r) => r.tweet)
const byId = new Map(tweets.map((t) => [t.id_str as string, t]))

const media = (t: Tweet): Tweet[] => t.extended_entities?.media ?? []
const photos = (t: Tweet) => media(t).filter((m) => m.type === 'photo')

// ------------------------------------------------------------------- cases

interface Case {
  name: string
  why: string
  /** How many matching records to take. Chains take their whole chain. */
  take: number
  match: (t: Tweet) => boolean
}

const CASES: Case[] = [
  { name: 'plain', why: 'Original post: no reply, no media, no links.', take: 12,
    match: (t) => !t.in_reply_to_status_id_str && media(t).length === 0 &&
      (t.entities.urls ?? []).length === 0 && !t.full_text.startsWith('RT @') },
  { name: 'reply-to-other', why: 'Reply whose parent is not in the archive — 60% of a real archive.', take: 12,
    match: (t) => !!t.in_reply_to_user_id_str && t.in_reply_to_user_id_str !== accountId },
  { name: 'self-reply', why: 'Thread link: parent is mine and present, so a chain can be built.', take: 10,
    match: (t) => t.in_reply_to_user_id_str === accountId && byId.has(t.in_reply_to_status_id_str) },
  { name: 'retweet', why: 'Stored as "RT @handle: " with no structured marker.', take: 6,
    match: (t) => t.full_text.startsWith('RT @') && !t.full_text.trimEnd().endsWith('…') },
  { name: 'retweet-truncated', why: 'Retweet cut off mid-word: the text is not recoverable.', take: 6,
    match: (t) => t.full_text.startsWith('RT @') && t.full_text.trimEnd().endsWith('…') },
  { name: 'quote', why: 'Detectable only by a /status/ link; quoted text is absent.', take: 8,
    match: (t) => (t.entities.urls ?? []).some((u: Tweet) => /\/status\/\d+/.test(u.expanded_url ?? '')) },
  { name: 'photo-1', why: 'Single photo.', take: 6, match: (t) => photos(t).length === 1 },
  { name: 'photo-2', why: 'Two photos.', take: 4, match: (t) => photos(t).length === 2 },
  { name: 'photo-3', why: 'Three photos — odd grid case.', take: 4, match: (t) => photos(t).length === 3 },
  { name: 'photo-4', why: 'Four photos — maximum.', take: 6, match: (t) => photos(t).length === 4 },
  { name: 'gif', why: 'animated_gif: served as mp4, must not be treated as video.', take: 5,
    match: (t) => media(t).some((m) => m.type === 'animated_gif') },
  { name: 'video', why: 'Video: filename suffix is a URL hash, not a media id.', take: 8,
    match: (t) => media(t).some((m) => m.type === 'video') },
  { name: 'long', why: 'Over 280 characters, stored complete and untruncated.', take: 8,
    match: (t) => t.full_text.length > 280 },
  { name: 'emoji', why: 'Astral-plane characters: indices are UTF-16, not codepoints.', take: 8,
    match: (t) => /[\u{1F000}-\u{1FAFF}]/u.test(t.full_text) },
  { name: 'turkish-i', why: 'Dotted and dotless i — general Unicode casefolding gets these wrong.', take: 10,
    match: (t) => /[İı]/.test(t.full_text) },
  { name: 'multiline', why: 'Newlines in full_text.', take: 6, match: (t) => t.full_text.includes('\n') },
  { name: 'hashtags', why: 'Hashtag entities.', take: 6, match: (t) => (t.entities.hashtags ?? []).length > 0 },
  { name: 'many-mentions', why: 'Several mentions in one tweet.', take: 5,
    match: (t) => (t.entities.user_mentions ?? []).length >= 3 },
  { name: 'external-link', why: 'Link to a domain — the "links to" filter depends on expanded_url.', take: 6,
    match: (t) => (t.entities.urls ?? []).some((u: Tweet) => !/\/status\/\d+/.test(u.expanded_url ?? '')) },
  { name: 'edited', why: 'Edited tweet: one tweet stored as several records. Must dedupe.', take: 9,
    match: (t) => (t.edit_info?.initial?.editTweetIds ?? []).length > 1 ||
      !!t.edit_info?.edit },
  { name: 'lang-not-a-language', why: 'lang is qme/zxx/qam — "media, no text", not a language.', take: 6,
    match: (t) => ['qme', 'zxx', 'qam', 'und'].includes(t.lang) },
  { name: 'zero-engagement', why: 'favorite_count and retweet_count both "0".', take: 4,
    match: (t) => t.favorite_count === '0' && t.retweet_count === '0' },
  { name: 'high-engagement', why: 'Counts as strings — sorting without coercion puts 9 above 10.', take: 6,
    match: (t) => Number(t.favorite_count) > 500 },
]

// -------------------------------------------------------------- selection

const chosen = new Map<string, Tweet>()
const caseIndex: Record<string, string[]> = {}
const notFound: string[] = []
const names = new Pseudonyms()

// Deterministic: sort by id so a rerun picks the same records.
const ordered = [...tweets].sort((a, b) => a.id_str.localeCompare(b.id_str))

for (const c of CASES) {
  const hits = ordered.filter(c.match)
  if (hits.length === 0) { notFound.push(c.name); caseIndex[c.name] = []; continue }
  // Spread the picks across the archive rather than taking the first N.
  const step = Math.max(1, Math.floor(hits.length / c.take))
  const picked: Tweet[] = []
  for (let i = 0; picked.length < c.take && i * step < hits.length; i++) picked.push(hits[i * step])
  caseIndex[c.name] = picked.map((t) => t.id_str)
  for (const t of picked) chosen.set(t.id_str, t)
}

/** Pull in whatever else a case needs to be usable: thread parents, edit siblings. */
function expand(): boolean {
  let grew = false
  for (const t of [...chosen.values()]) {
    const parent = t.in_reply_to_user_id_str === accountId ? t.in_reply_to_status_id_str : null
    if (parent && byId.has(parent) && !chosen.has(parent)) { chosen.set(parent, byId.get(parent)!); grew = true }
    const ids: string[] = t.edit_info?.initial?.editTweetIds ??
      t.edit_info?.edit?.editControlInitial?.editTweetIds ?? []
    for (const id of ids) {
      if (byId.has(id) && !chosen.has(id)) { chosen.set(id, byId.get(id)!); grew = true }
    }
  }
  return grew
}
while (expand()) { /* until closed over parents and edit siblings */ }

// Always include the archive's first and last tweet.
const chrono = [...tweets].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
for (const t of [chrono[0], chrono[chrono.length - 1]]) chosen.set(t.id_str, t)
caseIndex['boundary'] = [chrono[0].id_str, chrono[chrono.length - 1].id_str]

// ----------------------------------------------------------------- output

const outDir = join(process.cwd(), 'fixtures', 'archive')
if (existsSync(outDir)) rmSync(outDir, { recursive: true })
mkdirSync(join(outDir, 'data', 'tweets_media'), { recursive: true })

const selected = [...chosen.values()].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
/**
 * Entity indices are codepoint offsets into full_text — confirmed against the
 * source archive, where they match codepoint slicing 94/98 times and UTF-16
 * slicing 0/98. Redaction changes token lengths (a 12-character handle becomes
 * "user_a"), so the originals no longer point anywhere. Recompute them, or the
 * fixtures assert something false about a field the renderer relies on.
 */
function reindexEntities(tweet: Tweet): number {
  let unresolved = 0
  const chars = [...(tweet.full_text as string)] // codepoints, not UTF-16 units
  const cursor = new Map<string, number>()

  const locate = (needle: string): [string, string] | null => {
    const target = [...needle]
    const from = cursor.get(needle) ?? 0
    for (let i = from; i + target.length <= chars.length; i++) {
      let hit = true
      for (let j = 0; j < target.length; j++) {
        if (chars[i + j] !== target[j]) { hit = false; break }
      }
      if (hit) {
        cursor.set(needle, i + target.length)
        return [String(i), String(i + target.length)]
      }
    }
    return null
  }

  const groups: [string, (e: Tweet) => string][] = [
    ['user_mentions', (e) => `@${e.screen_name}`],
    ['hashtags', (e) => `#${e.text}`],
    ['symbols', (e) => `$${e.text}`],
    ['urls', (e) => e.url],
  ]
  for (const [group, render] of groups) {
    for (const e of tweet.entities?.[group] ?? []) {
      const found = locate(render(e))
      // A truncated retweet can carry an entity whose token is cut off
      // mid-way, so it genuinely is not in the text. Mark it rather than
      // leaving a stale offset pointing at unrelated characters.
      if (found) e.indices = found
      else { e.indices = null; unresolved++ }
    }
  }
  // Every media item on a tweet shares one t.co URL, and entities.media
  // duplicates extended_entities.media. They therefore share one set of
  // offsets: look each distinct URL up once and reuse it, rather than
  // advancing the cursor past the first hit and failing on the rest.
  const mediaOffsets = new Map<string, [string, string] | null>()
  for (const group of [tweet.extended_entities?.media, tweet.entities?.media]) {
    for (const m of group ?? []) {
      if (!mediaOffsets.has(m.url)) mediaOffsets.set(m.url, locate(m.url))
      const found = mediaOffsets.get(m.url) ?? null
      if (found) m.indices = [...found]
      else { m.indices = null; unresolved++ }
    }
  }
  tweet.display_text_range = ['0', String(chars.length)]
  return unresolved
}

let unresolvedEntities = 0
const redacted = selected.map((t) => {
  const record = redactRecord({ tweet: t }, names) as { tweet: Tweet }
  unresolvedEntities += reindexEntities(record.tweet)
  return record
})

const assign = (global: string, value: unknown) =>
  `window.${global} = ${JSON.stringify(value, null, 2)}\n`

writeFileSync(join(outDir, 'data', 'tweets.js'), assign('YTD.tweets.part0', redacted))
writeFileSync(join(outDir, 'data', 'tweet-headers.js'), assign('YTD.tweet_headers.part0',
  redacted.map(({ tweet }) => ({
    tweet: { tweet_id: tweet.id_str, user_id: names.id(accountId), created_at: tweet.created_at },
  }))))

// --- media placeholders -----------------------------------------------------
// Real bytes are never copied. These are the smallest valid files of each type,
// so the loader, the join and the thumbnailer all have something to open.
const PLACEHOLDER: Record<string, Buffer> = {
  jpg: Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64'),
  png: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9' +
    'awAAAABJRU5ErkJggg==', 'base64'),
  mp4: Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQ==', 'base64'),
}

let written = 0
const missingOnPurpose: string[] = []
for (const { tweet } of redacted) {
  const items: Tweet[] = tweet.extended_entities?.media ?? []
  items.forEach((m, i) => {
    const ext = m.type === 'photo'
      ? (m.media_url_https?.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase()
      : 'mp4'
    const suffix = m.id_str ?? `v${i}`
    const name = `${tweet.id_str}-${suffix}.${ext === 'jpeg' ? 'jpg' : ext}`
    // One deliberate gap: a referenced file that does not exist. The real
    // archive has none, and the loader must degrade rather than throw.
    if (missingOnPurpose.length === 0 && items.length === 1 && m.type === 'photo' && written > 20) {
      missingOnPurpose.push(name)
      return
    }
    writeFileSync(join(outDir, 'data', 'tweets_media', name),
      PLACEHOLDER[ext === 'jpeg' ? 'jpg' : ext] ?? PLACEHOLDER.jpg)
    written++
  })
}

writeFileSync(join(outDir, 'data', 'manifest.js'),
  `window.__THAR_CONFIG = ${JSON.stringify({
    userInfo: { accountId: names.id(accountId), userName: 'user_self', displayName: 'Fixture Account' },
    archiveInfo: {
      sizeBytes: '0', generationDate: manifest.archiveInfo.generationDate,
      isPartialArchive: false, maxPartSizeBytes: '53687091200',
    },
    dataTypes: {
      tweets: { mediaDirectory: 'data/tweets_media', files: [{ fileName: 'data/tweets.js', globalName: 'YTD.tweets.part0', count: String(redacted.length) }] },
      tweetHeaders: { files: [{ fileName: 'data/tweet-headers.js', globalName: 'YTD.tweet_headers.part0', count: String(redacted.length) }] },
    },
  }, null, 2)}\n`)

writeFileSync(join(process.cwd(), 'fixtures', 'cases.json'),
  JSON.stringify({
    note: 'Generated by scripts/fixture-redactor.ts. Ids are pseudonyms; see fixtures/CASES.md.',
    sourceArchiveGenerated: manifest.archiveInfo.generationDate,
    records: redacted.length,
    caseIds: Object.fromEntries(Object.entries(caseIndex).map(([k, ids]) =>
      [k, ids.map((id) => names.id(id))])),
    missingMediaOnPurpose: missingOnPurpose,
    entityIndicesAreCodepointOffsets: true,
    unresolvedEntityIndices: unresolvedEntities,
    casesNotInSourceArchive: notFound,
  }, null, 2) + '\n')

// --- human-readable case index ----------------------------------------------

const md: string[] = []
md.push('# Fixture cases')
md.push('')
md.push('A miniature but complete X export, built from a real archive by')
md.push('`scripts/fixture-redactor.ts` and redacted. It has the same directory')
md.push('layout as a real export, so the parser can be pointed straight at')
md.push('`fixtures/archive/` rather than fed hand-made objects.')
md.push('')
md.push(`${redacted.length} tweets, ${written} media placeholders.`)
md.push('')
md.push('## What is guaranteed')
md.push('')
md.push('- Letters are substituted within their own alphabet, so Turkish text stays')
md.push('  Turkish and still exercises dotted/dotless i. Nothing carries meaning.')
md.push('- Handles, ids, hashtags and t.co codes are stable pseudonyms: the same')
md.push('  account is the same pseudonym in every record.')
md.push('- Entity `indices` are recomputed as **codepoint** offsets into the redacted')
md.push('  `full_text`, matching how X stores them. An entity that genuinely is not')
md.push('  in the text — a retweet cut off mid-URL — has `indices: null`.')
md.push('- Media files are regenerated placeholders. No real image bytes are copied.')
md.push('- Exactly one referenced media file is absent on purpose, so the loader has')
md.push(`  a missing file to degrade on: \`${missingOnPurpose[0] ?? 'none'}\`.`)
md.push('')
md.push('## Cases')
md.push('')
md.push('| Case | Records | Why it is here |')
md.push('|---|---:|---|')
for (const c of CASES) {
  md.push(`| \`${c.name}\` | ${caseIndex[c.name]?.length ?? 0} | ${c.why} |`)
}
md.push(`| \`boundary\` | 2 | The archive's earliest and latest tweet. |`)
md.push('')
md.push('Chains are closed: whenever a self-reply or an edit revision is selected,')
md.push('its parent and its sibling revisions are pulled in too, so no fixture')
md.push('points at a record that is not there.')
md.push('')
if (notFound.length) {
  md.push('## Not present in the source archive')
  md.push('')
  md.push('These are hand-written under `fixtures/synthetic/` and marked unverified:')
  md.push('')
  for (const n of notFound) md.push(`- \`${n}\``)
  md.push('')
}
md.push('Regenerate with `node scripts/fixture-redactor.ts <archive>`.')
writeFileSync(join(process.cwd(), 'fixtures', 'CASES.md'), md.join('\n') + '\n')

console.log(`fixtures/archive/  ${redacted.length} tweets, ${written} media placeholders`)
console.log(`covered: ${CASES.length - notFound.length}/${CASES.length} cases`)
console.log(`entity indices recomputed as codepoint offsets; ${unresolvedEntities} unresolved (truncated retweets)`)
if (missingOnPurpose.length) console.log(`deliberate missing media: ${missingOnPurpose.join(', ')}`)
if (notFound.length) {
  console.log(`\nNot present in the source archive — hand-write these in fixtures/synthetic/:`)
  for (const n of notFound) console.log(`  - ${n}`)
}
