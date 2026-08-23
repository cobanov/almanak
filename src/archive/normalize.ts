/**
 * Raw archive records to the internal Tweet type.
 *
 * Three things here are not obvious, and each was found by surveying a real
 * archive rather than by reading X's documentation. See docs/ARCHIVE-FORMAT.md.
 */

import type { Tweet, Entity, MediaItem, TweetKind } from './types.ts'
import { normalizeForSearch } from './turkish.ts'

type Raw = Record<string, any>

/** X's lang field carries these when a tweet has media and no text. */
const LANG_PLACEHOLDERS = new Set(['qme', 'qam', 'qct', 'qht', 'qst', 'zxx', 'und'])

/** `Wed Oct 10 20:19:24 +0000 2018` — parsed as UTC. */
export function parseCreatedAt(value: string): number {
  const ms = Date.parse(value)
  if (!Number.isNaN(ms)) return ms
  // Some older archives use a form Date.parse rejects in strict engines.
  const m = value.match(/^\w{3} (\w{3}) (\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4}) (\d{4})$/)
  if (!m) return Number.NaN
  const months = 'JanFebMarAprMayJunJulAugSepOctNovDec'
  return Date.UTC(+m[7], months.indexOf(m[1]) / 3, +m[2], +m[3], +m[4], +m[5])
}

/** `<a href="...">Twitter for iPhone</a>` — the label is what matters. */
export function parseClient(source: string): string {
  return source.replace(/<[^>]*>/g, '').trim() || 'unknown'
}

/**
 * Entity offsets are CODEPOINT offsets, not UTF-16 code units. Confirmed
 * against a real archive: where an astral character precedes the entity, they
 * match codepoint slicing 94 times out of 98 and UTF-16 slicing 0 out of 98.
 *
 * JavaScript strings are UTF-16, so `text.slice(a, b)` returns the wrong span
 * for any tweet containing an emoji before a mention. This converts once, at
 * parse time, so nothing downstream has to remember.
 */
function codepointToUtf16(text: string): (index: number) => number {
  const map: number[] = []
  let utf16 = 0
  for (const ch of text) {
    map.push(utf16)
    utf16 += ch.length
  }
  map.push(utf16)
  return (i) => (i >= 0 && i < map.length ? map[i] : utf16)
}

function readEntities(raw: Raw, text: string): Entity[] {
  const convert = codepointToUtf16(text)
  const out: Entity[] = []
  const at = (indices: unknown): [number | null, number | null] => {
    if (!Array.isArray(indices) || indices.length < 2) return [null, null]
    const a = Number(indices[0]), b = Number(indices[1])
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [null, null]
    return [convert(a), convert(b)]
  }

  for (const m of raw.entities?.user_mentions ?? []) {
    const [start, end] = at(m.indices)
    out.push({ kind: 'mention', text: m.screen_name, target: m.screen_name, start, end })
  }
  for (const h of raw.entities?.hashtags ?? []) {
    const [start, end] = at(h.indices)
    out.push({ kind: 'hashtag', text: h.text, target: h.text, start, end })
  }
  for (const u of raw.entities?.urls ?? []) {
    const [start, end] = at(u.indices)
    out.push({ kind: 'url', text: u.display_url ?? u.expanded_url ?? u.url, target: u.expanded_url ?? u.url, start, end })
  }
  return out
}

function readMedia(raw: Raw, tweetId: string, filesById: Map<string, string[]>): MediaItem[] {
  const items = raw.extended_entities?.media ?? raw.entities?.media ?? []
  const available = filesById.get(tweetId) ?? []
  const used = new Set<string>()

  return items.map((m: Raw, i: number): MediaItem => {
    const kind: MediaItem['kind'] =
      m.type === 'video' ? 'video' : m.type === 'animated_gif' ? 'gif' : 'photo'

    // Photos are {tweet_id}-{media_id}.{ext}; videos are {tweet_id}-{url_hash}.mp4.
    // Matching the suffix to media.id_str therefore fails for video, so match
    // positionally within the tweet's own files after filtering by extension.
    const wantVideo = kind !== 'photo'
    const candidates = available.filter((f) => {
      const isMp4 = f.toLowerCase().endsWith('.mp4')
      return wantVideo ? isMp4 : !isMp4
    })
    const byId = candidates.find((f) => m.id_str && f.includes(m.id_str) && !used.has(f))
    const file = byId ?? candidates.find((f) => !used.has(f)) ?? ''
    if (file) used.add(file)

    const size = m.sizes?.large ?? m.sizes?.medium ?? {}
    return {
      id: m.id_str ?? `${tweetId}-${i}`,
      kind,
      file,
      width: Number(size.w) || 0,
      height: Number(size.h) || 0,
      present: file !== '',
    }
  })
}

/** A retweet is only identifiable by its text prefix. There is no flag. */
function retweetHandle(text: string): string | null {
  return text.match(/^RT @(\w+):/)?.[1] ?? null
}

/** A quote is only identifiable by a status URL among the entities. */
function quotedStatus(raw: Raw): string | null {
  for (const u of raw.entities?.urls ?? []) {
    const url: string = u.expanded_url ?? ''
    if (/(twitter|x)\.com\/[^/]+\/status\/\d+/.test(url)) return url
  }
  return null
}

/**
 * Group edit revisions. An edited tweet is stored once per revision, each a
 * separate record with its own id. The original carries
 * edit_info.initial.editTweetIds listing every revision; later revisions carry
 * edit_info.edit.initialTweetId pointing back.
 *
 * Only the newest revision holds real engagement — in the reference archive one
 * tweet appears three times, 31 seconds apart, with favourite counts of 1, 2
 * and 493. Keeping all three would over-report the archive and show the same
 * text three times in the timeline.
 */
function editGroupOf(raw: Raw): { root: string; members: string[] } {
  const info = raw.edit_info ?? {}
  if (info.initial) {
    return { root: raw.id_str, members: info.initial.editTweetIds ?? [raw.id_str] }
  }
  if (info.edit) {
    return {
      root: info.edit.initialTweetId ?? raw.id_str,
      members: info.edit.editControlInitial?.editTweetIds ?? [raw.id_str],
    }
  }
  return { root: raw.id_str, members: [raw.id_str] }
}

export interface NormalizeOptions {
  accountId: string
  /** tweet id -> media filenames on disk for that id. */
  filesById: Map<string, string[]>
  deleted?: boolean
  /** Full text keyed by tweet id, from note-tweet.js when present. */
  noteTexts?: Map<string, string>
}

export interface NormalizeResult {
  tweets: Tweet[]
  /** Format paths that fired but are untested against real data. */
  unverified: string[]
}

export function normalizeTweets(records: Raw[], options: NormalizeOptions): NormalizeResult {
  const { accountId, filesById, deleted = false, noteTexts } = options
  const unverified = new Set<string>()

  const raws = records.map((r) => (r.tweet ?? r) as Raw).filter((r) => r?.id_str)

  // --- collapse edit groups to their newest revision -------------------------
  const groups = new Map<string, Raw[]>()
  for (const raw of raws) {
    const { root } = editGroupOf(raw)
    const list = groups.get(root)
    if (list) list.push(raw)
    else groups.set(root, [raw])
  }

  const canonical: { raw: Raw; aliases: string[]; revisions: number }[] = []
  for (const [, members] of groups) {
    const sorted = [...members].sort((a, b) => parseCreatedAt(a.created_at) - parseCreatedAt(b.created_at))
    const newest = sorted[sorted.length - 1]
    canonical.push({
      raw: newest,
      aliases: sorted.map((r) => r.id_str),
      revisions: sorted.length,
    })
  }

  const ownIds = new Set(canonical.map((c) => c.raw.id_str))
  for (const c of canonical) for (const a of c.aliases) ownIds.add(a)

  // --- normalize ------------------------------------------------------------
  const tweets = canonical.map(({ raw, aliases, revisions }): Tweet => {
    const stitched = noteTexts?.get(raw.id_str)
    if (stitched) unverified.add('note-tweet stitching')

    const text: string = stitched ?? raw.full_text ?? raw.text ?? ''
    const rtOf = retweetHandle(text)
    const quote = quotedStatus(raw)
    const replyToId: string | null = raw.in_reply_to_status_id_str ?? null
    const replyToUser: string | null = raw.in_reply_to_user_id_str ?? null
    const isSelfReply = replyToUser === accountId && replyToId !== null

    let kind: TweetKind = 'post'
    if (rtOf) kind = 'retweet'
    else if (isSelfReply) kind = 'thread'
    else if (replyToId) kind = 'reply'
    else if (quote) kind = 'quote'

    const media = readMedia(raw, raw.id_str, filesById)
    if (media.some((m) => !m.present)) unverified.add('missing media file')

    return {
      id: raw.id_str,
      aliases,
      at: parseCreatedAt(raw.created_at),
      text,
      normalized: normalizeForSearch(text),
      kind,
      lang: raw.lang ?? 'und',
      langIsPlaceholder: LANG_PLACEHOLDERS.has(raw.lang ?? 'und'),
      client: parseClient(raw.source ?? ''),
      likes: Number(raw.favorite_count) || 0,
      retweets: Number(raw.retweet_count) || 0,
      entities: readEntities(raw, text),
      media,
      replyTo: raw.in_reply_to_screen_name ?? null,
      replyToId,
      parentInArchive: isSelfReply && ownIds.has(replyToId!),
      threadId: null,
      threadIndex: 0,
      retweetOf: rtOf,
      quoteOf: quote,
      // Retweets are stored cut off mid-word and cannot be recovered.
      truncated: Boolean(raw.truncated) || (rtOf !== null && text.trimEnd().endsWith('…')),
      deleted,
      revisions,
    }
  })

  tweets.sort((a, b) => a.at - b.at)
  return { tweets, unverified: [...unverified] }
}
