/**
 * Era detection: find where posting volume changed, then name each stretch by
 * the terms that were distinctively its own.
 *
 * The changepoint method is deliberately simple — a sliding comparison of mean
 * volume before and after each candidate boundary, keeping the strongest peaks
 * with a minimum separation. Anything more sophisticated would still be a
 * guess, and the labels are shown as inferred either way.
 */

import type { Bucket } from '../store/TweetStore.ts'
import type { Tweet } from '../archive/types.ts'
import { tokenizeWithSurface, STOPWORDS } from '../archive/turkish.ts'

export interface Era {
  from: number
  to: number
  label: string
  tweets: number
  /** True when volume was far below the archive's median — a quiet stretch. */
  quiet: boolean
  /** True once a reader has renamed it: no longer inferred, so not styled as such. */
  edited?: boolean
}

/** Strength of a volume change at each boundary between buckets. */
function changeScores(buckets: Bucket[], window: number): number[] {
  return buckets.map((_, i) => {
    if (i < window || i > buckets.length - window) return 0
    let before = 0, after = 0
    for (let k = i - window; k < i; k++) before += buckets[k].total
    for (let k = i; k < i + window; k++) after += buckets[k].total
    before /= window; after /= window
    // Relative change, so a jump from 5 to 20 counts as much as 100 to 400.
    return Math.abs(after - before) / Math.max(1, (after + before) / 2)
  })
}

export function detectEras(buckets: Bucket[], tweets: Tweet[], maxEras = 6): Era[] {
  if (buckets.length < 6) return []

  const window = Math.max(2, Math.floor(buckets.length / 12))
  const scores = changeScores(buckets, window)
  const minGap = Math.max(3, Math.floor(buckets.length / (maxEras + 1)))

  const cuts: number[] = []
  const ranked = scores
    .map((score, i) => ({ score, i }))
    .sort((a, b) => b.score - a.score)

  for (const { score, i } of ranked) {
    if (cuts.length >= maxEras - 1) break
    if (score < 0.35) break
    if (cuts.every((c) => Math.abs(c - i) >= minGap)) cuts.push(i)
  }
  cuts.sort((a, b) => a - b)

  const bounds = [0, ...cuts, buckets.length]
  const medianVolume = [...buckets].map((b) => b.total).sort((a, b) => a - b)[buckets.length >> 1]

  // Document frequency across the whole corpus, for the TF-IDF weighting.
  const corpusDf = new Map<string, number>()
  // As in the vocabulary panel: match on stems, label with real words.
  const surfaces = new Map<string, Map<string, number>>()
  const perTweetTerms = tweets.map((t) => {
    const terms = new Set<string>()
    for (const { stem, surface } of tokenizeWithSurface(t.text)) {
      if (stem.length <= 2 || STOPWORDS.has(stem)) continue
      let forms = surfaces.get(stem)
      if (!forms) surfaces.set(stem, (forms = new Map()))
      forms.set(surface, (forms.get(surface) ?? 0) + 1)
      terms.add(stem)
    }
    for (const term of terms) corpusDf.set(term, (corpusDf.get(term) ?? 0) + 1)
    return terms
  })
  const display = (stem: string): string => {
    const forms = surfaces.get(stem)
    if (!forms) return stem
    let best = stem, bestN = -1
    for (const [form, n] of forms) if (n > bestN) { best = form; bestN = n }
    return best
  }
  const total = Math.max(1, tweets.length)

  const eras: Era[] = []
  for (let s = 0; s < bounds.length - 1; s++) {
    const slice = buckets.slice(bounds[s], bounds[s + 1])
    if (slice.length === 0) continue
    const from = slice[0].at
    const to = slice[slice.length - 1].at
    const count = slice.reduce((sum, b) => sum + b.total, 0)
    const meanVolume = count / slice.length
    const quiet = meanVolume < medianVolume * 0.45

    // Terms distinctive to this stretch, weighted against the whole corpus.
    const local = new Map<string, number>()
    let inEra = 0
    tweets.forEach((t, i) => {
      if (t.at < from || t.at > to + 1) return
      inEra++
      for (const term of perTweetTerms[i]) local.set(term, (local.get(term) ?? 0) + 1)
    })

    let label = ''
    if (!quiet && inEra > 20) {
      const scored = [...local.entries()]
        .filter(([, n]) => n >= Math.max(3, inEra * 0.01))
        .map(([term, n]) => {
          const tf = n / inEra
          const idf = Math.log(total / (corpusDf.get(term) ?? 1))
          return { term, score: tf * idf }
        })
        .sort((a, b) => b.score - a.score)
      label = scored.slice(0, 2).map((s) => display(s.term)).join(' · ')
    }
    if (quiet) label = 'quiet'

    eras.push({ from, to, label: label || '—', tweets: count, quiet })
  }
  return eras
}
