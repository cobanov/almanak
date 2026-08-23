/**
 * One pure function per panel. Each takes tweets and returns numbers; none of
 * them render anything or read the DOM, so each is testable on its own.
 *
 * Every result carries the denominator it was computed against, because a
 * percentage without one is how an honest number becomes a misleading one.
 */

import type { Tweet } from '../archive/types.ts'
import { tokenize, tokenizeWithSurface, STOPWORDS } from '../archive/turkish.ts'

export interface Counted { total: number }

// --- rhythm punchcard -------------------------------------------------------

export interface Punchcard extends Counted {
  /** [dayOfWeek 0=Mon][hour] = count */
  grid: number[][]
  peak: number
  timezone: string
}

/**
 * The archive stores UTC. Charting it as UTC and labelling it "when you post"
 * is wrong by however many hours the poster is offset, which silently ruins
 * this chart everywhere it appears on the internet. The timezone is a
 * parameter and is always displayed.
 */
export function punchcard(tweets: Tweet[], useUtc: boolean): Punchcard {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  let peak = 0
  for (const t of tweets) {
    const d = new Date(t.at)
    const day = useUtc ? d.getUTCDay() : d.getDay()
    const hour = useUtc ? d.getUTCHours() : d.getHours()
    const row = (day + 6) % 7 // Monday first
    const next = ++grid[row][hour]
    if (next > peak) peak = next
  }
  return {
    grid, peak, total: tweets.length,
    timezone: useUtc ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

// --- client archaeology -----------------------------------------------------

export interface ClientSeries extends Counted {
  years: number[]
  clients: string[]
  /** [clientIndex][yearIndex] = share 0..1 */
  shares: number[][]
  counts: number[][]
}

export function clientsOverTime(tweets: Tweet[], maxClients = 6): ClientSeries {
  const byYear = new Map<number, Map<string, number>>()
  const totals = new Map<string, number>()

  for (const t of tweets) {
    const y = new Date(t.at).getUTCFullYear()
    let row = byYear.get(y)
    if (!row) byYear.set(y, (row = new Map()))
    row.set(t.client, (row.get(t.client) ?? 0) + 1)
    totals.set(t.client, (totals.get(t.client) ?? 0) + 1)
  }

  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxClients).map(([c]) => c)
  const clients = totals.size > top.length ? [...top, 'other'] : top
  const years = [...byYear.keys()].sort((a, b) => a - b)

  const counts = clients.map((client) =>
    years.map((y) => {
      const row = byYear.get(y)!
      if (client !== 'other') return row.get(client) ?? 0
      let rest = 0
      for (const [name, n] of row) if (!top.includes(name)) rest += n
      return rest
    }),
  )
  const yearTotals = years.map((_, i) => counts.reduce((s, series) => s + series[i], 0))
  const shares = counts.map((series) => series.map((n, i) => (yearTotals[i] ? n / yearTotals[i] : 0)))

  return { years, clients, shares, counts, total: tweets.length }
}

// --- vocabulary drift -------------------------------------------------------

export interface YearTerms { year: number; terms: { term: string; score: number; count: number }[]; total: number }

/**
 * Terms distinctive to each year, by TF-IDF against the whole corpus.
 *
 * On Turkish this is weaker than the English equivalent even after stemming,
 * because proper morphological analysis is beyond what belongs here. Treat the
 * output as a hint, which is why the UI labels it inferred.
 */
export function vocabularyDrift(tweets: Tweet[], perYear = 8, extraStopwords = new Set<string>()): YearTerms[] {
  const docFreq = new Map<string, number>()
  const byYear = new Map<number, Map<string, number>>()
  const yearCounts = new Map<number, number>()
  // Stems are for matching; readers get the word people actually wrote.
  const surfaces = new Map<string, Map<string, number>>()

  for (const t of tweets) {
    if (t.kind === 'retweet') continue // not the author's words
    const y = new Date(t.at).getUTCFullYear()
    yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1)
    let row = byYear.get(y)
    if (!row) byYear.set(y, (row = new Map()))

    const seen = new Set<string>()
    for (const { stem, surface } of tokenizeWithSurface(t.text)) {
      if (stem.length <= 2 || STOPWORDS.has(stem) || extraStopwords.has(stem)) continue
      let forms = surfaces.get(stem)
      if (!forms) surfaces.set(stem, (forms = new Map()))
      forms.set(surface, (forms.get(surface) ?? 0) + 1)
      seen.add(stem)
    }
    for (const term of seen) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
      row.set(term, (row.get(term) ?? 0) + 1)
    }
  }

  /** The commonest spelling of a stem, for display. */
  const display = (stem: string): string => {
    const forms = surfaces.get(stem)
    if (!forms) return stem
    let best = stem, bestN = -1
    for (const [form, n] of forms) if (n > bestN) { best = form; bestN = n }
    return best
  }

  const total = Math.max(1, tweets.length)
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, row]) => {
      const yearTotal = yearCounts.get(year) ?? 1
      const terms = [...row.entries()]
        .filter(([, n]) => n >= Math.max(3, yearTotal * 0.004))
        .map(([term, n]) => ({
          term: display(term), count: n,
          score: (n / yearTotal) * Math.log(total / (docFreq.get(term) ?? 1)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, perYear)
      return { year, terms, total: yearTotal }
    })
}

// --- your orbit -------------------------------------------------------------

export interface OrbitEntry { handle: string; total: number; byYear: Map<number, number> }

export function orbit(tweets: Tweet[], top = 20): { entries: OrbitEntry[]; years: number[]; total: number } {
  const map = new Map<string, OrbitEntry>()
  const years = new Set<number>()

  for (const t of tweets) {
    const y = new Date(t.at).getUTCFullYear()
    years.add(y)
    const mentioned = new Set(
      t.entities.filter((e) => e.kind === 'mention').map((e) => e.target.toLowerCase()),
    )
    for (const handle of mentioned) {
      let entry = map.get(handle)
      if (!entry) map.set(handle, (entry = { handle, total: 0, byYear: new Map() }))
      entry.total++
      entry.byYear.set(y, (entry.byYear.get(y) ?? 0) + 1)
    }
  }

  return {
    entries: [...map.values()].sort((a, b) => b.total - a.total).slice(0, top),
    years: [...years].sort((a, b) => a - b),
    total: tweets.length,
  }
}

// --- reply ratio ------------------------------------------------------------

export interface RatioYear { year: number; total: number; post: number; reply: number; thread: number; quote: number; retweet: number }

export function replyRatio(tweets: Tweet[]): RatioYear[] {
  const map = new Map<number, RatioYear>()
  for (const t of tweets) {
    const year = new Date(t.at).getUTCFullYear()
    let row = map.get(year)
    if (!row) map.set(year, (row = { year, total: 0, post: 0, reply: 0, thread: 0, quote: 0, retweet: 0 }))
    row.total++
    row[t.kind]++
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

// --- the gaps ---------------------------------------------------------------

export interface Gap { from: number; to: number; days: number; beforeId: string; afterId: string }
export interface Streak { from: number; to: number; days: number }

/** The silences are usually the most interesting thing in an archive. */
export function gaps(tweets: Tweet[], top = 10): { gaps: Gap[]; streaks: Streak[]; total: number } {
  const sorted = [...tweets].sort((a, b) => a.at - b.at)
  const found: Gap[] = []

  for (let i = 1; i < sorted.length; i++) {
    const days = (sorted[i].at - sorted[i - 1].at) / 86_400_000
    if (days >= 2) {
      found.push({
        from: sorted[i - 1].at, to: sorted[i].at, days: Math.floor(days),
        beforeId: sorted[i - 1].id, afterId: sorted[i].id,
      })
    }
  }

  // Longest runs of consecutive days with at least one tweet.
  const dayKeys = [...new Set(sorted.map((t) => Math.floor(t.at / 86_400_000)))].sort((a, b) => a - b)
  const streaks: Streak[] = []
  let start = dayKeys[0], prev = dayKeys[0]
  for (let i = 1; i <= dayKeys.length; i++) {
    if (i === dayKeys.length || dayKeys[i] !== prev + 1) {
      streaks.push({
        from: start * 86_400_000, to: prev * 86_400_000, days: prev - start + 1,
      })
      start = dayKeys[i]
    }
    prev = dayKeys[i]
  }

  return {
    gaps: found.sort((a, b) => b.days - a.days).slice(0, top),
    streaks: streaks.sort((a, b) => b.days - a.days).slice(0, top),
    total: tweets.length,
  }
}

// --- nocturnal index --------------------------------------------------------

export interface Nocturnal { year: number; night: number; total: number }

export function nocturnal(tweets: Tweet[], useUtc: boolean): Nocturnal[] {
  const map = new Map<number, Nocturnal>()
  for (const t of tweets) {
    const d = new Date(t.at)
    const year = useUtc ? d.getUTCFullYear() : d.getFullYear()
    const hour = useUtc ? d.getUTCHours() : d.getHours()
    let row = map.get(year)
    if (!row) map.set(year, (row = { year, night: 0, total: 0 }))
    row.total++
    if (hour < 6) row.night++
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

// --- firsts -----------------------------------------------------------------

export function firstUse(tweets: Tweet[], term: string): Tweet | null {
  const needle = tokenize(term)[0]
  if (!needle) return null
  let best: Tweet | null = null
  for (const t of tweets) {
    if (!t.normalized.includes(needle)) continue
    if (!best || t.at < best.at) best = t
  }
  return best
}

// --- housekeeping -----------------------------------------------------------

export interface Housekeeping {
  total: number
  kinds: Record<string, number>
  media: { photos: number; videos: number; gifs: number; missing: number }
  languages: { code: string; count: number }[]
  placeholderLangs: number
  deleted: number
  edited: number
  engagementZero: number
  topLiked: Tweet | null
}

export function housekeeping(tweets: Tweet[]): Housekeeping {
  const kinds: Record<string, number> = {}
  const langs = new Map<string, number>()
  let photos = 0, videos = 0, gifs = 0, missing = 0
  let placeholderLangs = 0, deleted = 0, edited = 0, engagementZero = 0
  let topLiked: Tweet | null = null

  for (const t of tweets) {
    kinds[t.kind] = (kinds[t.kind] ?? 0) + 1
    if (t.langIsPlaceholder) placeholderLangs++
    else langs.set(t.lang, (langs.get(t.lang) ?? 0) + 1)
    if (t.deleted) deleted++
    if (t.revisions > 1) edited++
    if (t.likes === 0 && t.retweets === 0) engagementZero++
    if (!topLiked || t.likes > topLiked.likes) topLiked = t
    for (const m of t.media) {
      if (!m.present) missing++
      if (m.kind === 'photo') photos++
      else if (m.kind === 'video') videos++
      else gifs++
    }
  }

  return {
    total: tweets.length, kinds,
    media: { photos, videos, gifs, missing },
    languages: [...langs.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
    placeholderLangs, deleted, edited, engagementZero, topLiked,
  }
}
