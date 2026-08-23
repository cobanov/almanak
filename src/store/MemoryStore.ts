/**
 * In-memory TweetStore.
 *
 * Chosen over SQLite-WASM for the first milestone because the reference
 * archive is 23 MB of JSON and 10,090 tweets: a linear scan over an array
 * costs under a millisecond, where SQLite would cost cross-origin isolation
 * headers, a megabyte of WASM and a migration story for no measurable gain.
 * The interface exists so that decision can be reversed. See PLAN.md.
 *
 * Everything expensive is cached and invalidated by nothing, because the data
 * is immutable once parsed.
 */

import type { Tweet, Thread, ArchiveMeta, ParsedArchive } from '../archive/types.ts'
import type { TweetStore, Filters, Bucket, Granularity } from './TweetStore.ts'
import { fold, tokenize } from '../archive/turkish.ts'

/** One parsed search query. Operators are stripped out of the free text. */
interface ParsedQuery {
  /** Stemmed terms that must all appear. */
  terms: string[]
  /** Folded phrases that must appear contiguously in the raw text. */
  phrases: string[]
  /** Stemmed terms that must not appear. */
  exclude: string[]
  year: number | null
  requireMedia: boolean | null
}

const QUERY_CACHE = new Map<string, ParsedQuery>()

export function parseQuery(input: string): ParsedQuery {
  const cached = QUERY_CACHE.get(input)
  if (cached) return cached

  const parsed: ParsedQuery = {
    terms: [], phrases: [], exclude: [], year: null, requireMedia: null,
  }
  let rest = input

  // "exact phrase" first, so its words are not also treated as loose terms.
  rest = rest.replace(/"([^"]+)"/g, (_, phrase: string) => {
    parsed.phrases.push(fold(phrase.trim()))
    return ' '
  })

  rest = rest.replace(/(^|\s)from:(\d{4})\b/gi, (_, lead: string, year: string) => {
    parsed.year = Number(year)
    return lead
  })

  rest = rest.replace(/(^|\s)has:media\b/gi, (_, lead: string) => {
    parsed.requireMedia = true
    return lead
  })

  rest = rest.replace(/(^|\s)-(\S+)/g, (_, lead: string, word: string) => {
    parsed.exclude.push(...tokenize(word))
    return lead
  })

  parsed.terms = tokenize(rest)

  if (QUERY_CACHE.size > 200) QUERY_CACHE.clear()
  QUERY_CACHE.set(input, parsed)
  return parsed
}

const YEAR = 'year', MONTH = 'month', WEEK = 'week', DAY = 'day'

/** Start of the bucket containing `ms`, in UTC. */
export function bucketStart(ms: number, g: Granularity): number {
  const d = new Date(ms)
  switch (g) {
    case YEAR: return Date.UTC(d.getUTCFullYear(), 0, 1)
    case MONTH: return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    case WEEK: {
      const day = (d.getUTCDay() + 6) % 7 // Monday-based
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)
    }
    case DAY: return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
}

export class MemoryStore implements TweetStore {
  readonly meta: ArchiveMeta
  readonly threads: Thread[]
  readonly tweets: Tweet[]

  #byId = new Map<string, Tweet>()
  #bucketCache = new Map<string, Bucket[]>()
  #facets: ReturnType<TweetStore['facets']> | null = null
  #gaps: { from: number; to: number; days: number }[] | null = null
  /** Lowercased raw text, for phrase matching without re-folding per query. */
  #folded: string[]

  constructor(parsed: ParsedArchive) {
    this.meta = parsed.meta
    this.threads = parsed.threads
    this.tweets = parsed.tweets
    for (const t of parsed.tweets) {
      this.#byId.set(t.id, t)
      for (const a of t.aliases) if (!this.#byId.has(a)) this.#byId.set(a, t)
    }
    this.#folded = parsed.tweets.map((t) => fold(t.text))
  }

  byId(id: string) { return this.#byId.get(id) }

  /**
   * First index whose `at` is >= `t`. The tweets array is sorted by time at
   * parse, so this is a plain lower-bound search.
   */
  #lowerBound(t: number): number {
    let lo = 0, hi = this.tweets.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.tweets[mid].at < t) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  range(from: number, to: number): Tweet[] {
    return this.tweets.slice(this.#lowerBound(from), this.#lowerBound(to))
  }

  thread(id: string): Tweet[] {
    const thread = this.threads.find((t) => t.id === id)
    if (!thread) return []
    return thread.tweetIds.map((tid) => this.#byId.get(tid)).filter(Boolean) as Tweet[]
  }

  #matches(t: Tweet, i: number, f: Filters, q: ParsedQuery): boolean {
    if (f.from !== null && t.at < f.from) return false
    if (f.to !== null && t.at > f.to) return false
    if (f.kinds.size > 0 && !f.kinds.has(t.kind)) return false
    if (f.hasMedia === true && t.media.length === 0) return false
    if (f.hasMedia === false && t.media.length > 0) return false
    if (f.minLikes !== null && t.likes < f.minLikes) return false
    if (f.lang && t.lang !== f.lang) return false
    if (f.client && t.client !== f.client) return false

    if (f.weekday !== null || f.hourFrom !== null) {
      const d = new Date(t.at)
      if (f.weekday !== null) {
        const day = f.useUtc ? d.getUTCDay() : d.getDay()
        if ((day + 6) % 7 !== f.weekday) return false // Monday-first, as drawn
      }
      if (f.hourFrom !== null) {
        const hour = f.useUtc ? d.getUTCHours() : d.getHours()
        const to = f.hourTo ?? f.hourFrom
        if (hour < f.hourFrom || hour > to) return false
      }
    }

    if (f.mentions) {
      const want = f.mentions.toLowerCase()
      if (!t.entities.some((e) => e.kind === 'mention' && e.target.toLowerCase() === want)) return false
    }
    if (f.hashtag) {
      const want = fold(f.hashtag)
      if (!t.entities.some((e) => e.kind === 'hashtag' && fold(e.target) === want)) return false
    }
    if (f.domain) {
      const want = f.domain.toLowerCase()
      if (!t.entities.some((e) => e.kind === 'url' && e.target.toLowerCase().includes(want))) return false
    }

    if (q.year !== null && new Date(t.at).getUTCFullYear() !== q.year) return false
    if (q.requireMedia === true && t.media.length === 0) return false

    if (q.terms.length || q.exclude.length) {
      const hay = t.normalized
      for (const term of q.terms) if (!hay.includes(term)) return false
      for (const term of q.exclude) if (hay.includes(term)) return false
    }
    if (q.phrases.length) {
      const hay = this.#folded[i]
      for (const phrase of q.phrases) if (!hay.includes(phrase)) return false
    }
    return true
  }

  #filtered(f: Filters): Tweet[] {
    const q = parseQuery(f.query)
    const out: Tweet[] = []
    for (let i = 0; i < this.tweets.length; i++) {
      const t = this.tweets[i]
      if (this.#matches(t, i, f, q)) out.push(t)
    }
    return out
  }

  query(f: Filters): Tweet[] {
    const out = this.#filtered(f)
    switch (f.sort) {
      case 'oldest': return out
      case 'most-liked': return out.sort((a, b) => b.likes - a.likes)
      case 'most-retweeted': return out.sort((a, b) => b.retweets - a.retweets)
      default: return out.reverse() // tweets are stored oldest-first
    }
  }

  count(f: Filters): number {
    const q = parseQuery(f.query)
    let n = 0
    for (let i = 0; i < this.tweets.length; i++) {
      if (this.#matches(this.tweets[i], i, f, q)) n++
    }
    return n
  }

  buckets(g: Granularity, f?: Filters): Bucket[] {
    const key = g + (f ? JSON.stringify([f.query, f.from, f.to, [...f.kinds], f.hasMedia]) : '')
    const cached = this.#bucketCache.get(key)
    if (cached) return cached

    const source = f ? this.#filtered(f) : this.tweets
    const map = new Map<number, Bucket>()
    for (const t of source) {
      if (!Number.isFinite(t.at)) continue
      const at = bucketStart(t.at, g)
      let b = map.get(at)
      if (!b) map.set(at, (b = { at, total: 0, posts: 0, replies: 0, media: 0 }))
      b.total++
      if (t.kind === 'reply') b.replies++
      else b.posts++
      if (t.media.length) b.media++
    }
    const out = [...map.values()].sort((a, b) => a.at - b.at)
    if (this.#bucketCache.size > 40) this.#bucketCache.clear()
    this.#bucketCache.set(key, out)
    return out
  }

  /**
   * The longest silences in the archive, newest-first ties broken by length.
   * Computed once: the track marks these, and the timeline reports them.
   */
  get longestGaps(): { from: number; to: number; days: number }[] {
    if (this.#gaps) return this.#gaps
    const out: { from: number; to: number; days: number }[] = []
    for (let i = 1; i < this.tweets.length; i++) {
      const days = (this.tweets[i].at - this.tweets[i - 1].at) / 86_400_000
      if (days >= 7) {
        out.push({ from: this.tweets[i - 1].at, to: this.tweets[i].at, days: Math.floor(days) })
      }
    }
    out.sort((a, b) => b.days - a.days)
    return (this.#gaps = out.slice(0, 3))
  }

  facets() {
    if (this.#facets) return this.#facets
    const clients = new Map<string, number>()
    const langs = new Map<string, number>()
    const domains = new Map<string, number>()
    const mentions = new Map<string, number>()

    for (const t of this.tweets) {
      clients.set(t.client, (clients.get(t.client) ?? 0) + 1)
      if (!t.langIsPlaceholder) langs.set(t.lang, (langs.get(t.lang) ?? 0) + 1)
      for (const e of t.entities) {
        if (e.kind === 'mention') {
          const h = e.target.toLowerCase()
          mentions.set(h, (mentions.get(h) ?? 0) + 1)
        } else if (e.kind === 'url') {
          try {
            const host = new URL(e.target).hostname.replace(/^www\./, '')
            if (host !== 't.co') domains.set(host, (domains.get(host) ?? 0) + 1)
          } catch { /* not a URL we can read */ }
        }
      }
    }
    const rank = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)

    this.#facets = {
      clients: rank(clients), langs: rank(langs),
      domains: rank(domains).slice(0, 100), mentions: rank(mentions).slice(0, 200),
    }
    return this.#facets
  }
}
