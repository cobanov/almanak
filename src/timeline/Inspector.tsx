/**
 * The timeline's left panel: what the selected stretch of archive was like.
 *
 * The scrubber answers "where am I". This answers "what was here" — how much
 * was posted, what it collected, what the best of it was, and whether the
 * period was busier or quieter than the one before.
 *
 * An empty range is not an empty panel. A silence is a fact about the archive,
 * often the most interesting one, so it is reported rather than left blank.
 */

import { useMemo } from 'react'
import type { Tweet, Thread } from '../archive/types.ts'
import type { Granularity } from '../store/TweetStore.ts'
import type { MemoryStore } from '../store/MemoryStore.ts'

import { statusUrl } from '../ui/TweetView.tsx'

const GRANULARITIES: Granularity[] = ['year', 'month', 'week', 'day']

const KIND_ORDER = ['post', 'thread', 'reply', 'quote', 'retweet'] as const

export interface RangeStats {
  tweets: Tweet[]
  count: number
  kinds: Record<string, number>
  likes: number
  retweets: number
  media: number
  threads: number
  top: Tweet | null
  topMention: { handle: string; count: number } | null
  /** Fractional change against the previous bucket, or null when there is none. */
  delta: number | null
  previousCount: number
}

export function computeRangeStats(
  store: MemoryStore,
  from: number,
  to: number,
  previousFrom: number,
): RangeStats {
  const tweets = store.range(from, to)
  const kinds: Record<string, number> = {}
  const mentions = new Map<string, number>()
  const threadIds = new Set<string>()
  let likes = 0, retweets = 0, media = 0
  let top: Tweet | null = null

  for (const t of tweets) {
    kinds[t.kind] = (kinds[t.kind] ?? 0) + 1
    likes += t.likes
    retweets += t.retweets
    media += t.media.length
    if (t.threadId) threadIds.add(t.threadId)
    if (!top || t.likes > top.likes) top = t
    for (const e of t.entities) {
      if (e.kind !== 'mention') continue
      const h = e.target.toLowerCase()
      mentions.set(h, (mentions.get(h) ?? 0) + 1)
    }
  }

  const best = [...mentions.entries()].sort((a, b) => b[1] - a[1])[0]
  const previousCount = store.range(previousFrom, from).length

  return {
    tweets, count: tweets.length, kinds, likes, retweets, media,
    threads: threadIds.size, top,
    topMention: best ? { handle: best[0], count: best[1] } : null,
    delta: previousCount > 0 ? (tweets.length - previousCount) / previousCount : null,
    previousCount,
  }
}

interface Props {
  stats: RangeStats
  from: number
  to: number
  granularity: Granularity
  onGranularity(g: Granularity): void
  /** Step by whole buckets. */
  onStep(direction: -1 | 1): void
  onCollapse(): void
  /** Scroll a tweet into view in the centre list. */
  onReveal(id: string): void
  onOpenRange(): void
  onFilterMention(handle: string): void
  handle: string
  /** Nearest tweets either side, when the range itself is empty. */
  silence: { before: Tweet | null; after: Tweet | null } | null
  threads: Thread[]
}

export function Inspector({
  stats, from, to, granularity, onGranularity, onStep, onCollapse,
  onReveal, onOpenRange, onFilterMention, handle, silence,
}: Props) {
  const label = useMemo(() => formatRange(from, granularity), [from, granularity])

  return (
    <aside className="w-[280px] shrink-0 border-r border-[var(--edge)] bg-[var(--surface)]
                      flex flex-col overflow-y-auto">
      <header className="px-3 py-3 border-b border-[var(--edge)] sticky top-0 bg-[var(--surface)] z-10">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStep(-1)}
            aria-label="Previous period"
            className="px-1.5 py-0.5 text-[var(--text-dim)] hover:text-[var(--accent)] rounded-sm"
          >‹</button>
          <h2 className="display text-base flex-1 text-center tabular-nums">{label}</h2>
          <button
            onClick={() => onStep(1)}
            aria-label="Next period"
            className="px-1.5 py-0.5 text-[var(--text-dim)] hover:text-[var(--accent)] rounded-sm"
          >›</button>
          <button
            onClick={onCollapse}
            aria-label="Collapse panel"
            className="px-1.5 py-0.5 text-[var(--text-dim)] hover:text-[var(--text)] rounded-sm"
          >⟨</button>
        </div>

        {/* Granularity was four unlabelled words under the track. Here it reads
            as what it is: how wide a slice you are looking at. */}
        <div className="flex mt-2.5 rounded-sm border border-[var(--edge)] overflow-hidden">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              onClick={() => onGranularity(g)}
              aria-pressed={g === granularity}
              className={`flex-1 py-1 text-[11px] capitalize transition-colors ${
                g === granularity
                  ? 'bg-[var(--accent)] text-[var(--bg)] font-medium'
                  : 'text-[var(--text-dim)] hover:bg-[var(--surface-lit)] hover:text-[var(--text)]'
              }`}
            >{g}</button>
          ))}
        </div>
      </header>

      {stats.count === 0 ? (
        <Silence from={from} to={to} silence={silence} onReveal={onReveal} />
      ) : (
        <div className="px-3 py-3 space-y-4">
          <section>
            <div className="flex items-baseline gap-2">
              <span data-numeric className="text-3xl">{stats.count.toLocaleString()}</span>
              <span className="text-xs text-[var(--text-dim)]">
                {stats.count === 1 ? 'tweet' : 'tweets'}
              </span>
              {stats.delta !== null && (
                <span
                  data-numeric
                  className={`ml-auto text-xs ${
                    stats.delta >= 0 ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
                  }`}
                  title={`Previous period held ${stats.previousCount.toLocaleString()}`}
                >
                  {stats.delta >= 0 ? '+' : ''}{Math.round(stats.delta * 100)}%
                </span>
              )}
            </div>

            <div className="flex h-1.5 rounded-sm overflow-hidden mt-2.5">
              {KIND_ORDER.map((k) => stats.kinds[k] > 0 && (
                <span
                  key={k}
                  title={`${stats.kinds[k]} ${k}`}
                  style={{ width: `${(stats.kinds[k] / stats.count) * 100}%`, background: kindColor(k) }}
                />
              ))}
            </div>
            <ul className="mt-2 space-y-0.5">
              {KIND_ORDER.map((k) => stats.kinds[k] > 0 && (
                <li key={k} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-[1px]" style={{ background: kindColor(k) }} />
                  <span className="text-[var(--text-dim)] capitalize">{k}</span>
                  <span data-numeric className="ml-auto">{stats.kinds[k].toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-[var(--edge)] pt-3">
            <dl className="grid grid-cols-2 gap-y-2 text-xs">
              <dt className="text-[var(--text-dim)]">Likes</dt>
              <dd data-numeric className="text-right">{stats.likes.toLocaleString()}</dd>
              <dt className="text-[var(--text-dim)]">Retweets</dt>
              <dd data-numeric className="text-right">{stats.retweets.toLocaleString()}</dd>
              {stats.media > 0 && (<>
                <dt className="text-[var(--text-dim)]">Media</dt>
                <dd data-numeric className="text-right">{stats.media.toLocaleString()}</dd>
              </>)}
              {stats.threads > 0 && (<>
                <dt className="text-[var(--text-dim)]">Threads</dt>
                <dd data-numeric className="text-right">{stats.threads.toLocaleString()}</dd>
              </>)}
            </dl>
            {/* Stated once, here, rather than beside every figure. */}
            <p className="text-[10px] text-[var(--text-dim)] mt-2 leading-relaxed">
              Counts are as of the export date, not live.
            </p>
          </section>

          {stats.top && stats.top.likes > 0 && (
            <section className="border-t border-[var(--edge)] pt-3">
              <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-2">
                Most liked here
              </h3>
              <button
                onClick={() => onReveal(stats.top!.id)}
                className="text-left w-full group"
              >
                <p className="text-xs leading-relaxed line-clamp-4 group-hover:text-[var(--accent)] transition-colors">
                  {stats.top.text}
                </p>
              </button>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-dim)]">
                <span data-numeric>♥ {stats.top.likes.toLocaleString()}</span>
                <span data-numeric>↻ {stats.top.retweets.toLocaleString()}</span>
                <a
                  href={statusUrl(handle, stats.top.id)}
                  target="_blank" rel="noreferrer noopener"
                  className="ml-auto hover:text-[var(--accent)]"
                >open ↗</a>
              </div>
            </section>
          )}

          {stats.topMention && (
            <section className="border-t border-[var(--edge)] pt-3">
              <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                Most mentioned
              </h3>
              <button
                onClick={() => onFilterMention(stats.topMention!.handle)}
                className="text-xs hover:text-[var(--accent)] transition-colors"
              >
                @{stats.topMention.handle}
                <span data-numeric className="text-[var(--text-dim)] ml-1.5">
                  ×{stats.topMention.count}
                </span>
              </button>
            </section>
          )}

          <button
            onClick={onOpenRange}
            className="w-full border border-[var(--edge)] rounded-sm py-1.5 text-xs
                       text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]
                       transition-colors"
          >
            Open this range in Tweets
          </button>
        </div>
      )}
    </aside>
  )
}

function Silence({ from, to, silence, onReveal }: {
  from: number; to: number
  silence: { before: Tweet | null; after: Tweet | null } | null
  onReveal(id: string): void
}) {
  // The full silence usually extends past this bucket in both directions, so
  // measure it from the surrounding tweets rather than from the bucket edges.
  const start = silence?.before?.at ?? from
  const end = silence?.after?.at ?? to
  const days = Math.max(1, Math.round((end - start) / 86_400_000))
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

  return (
    <div className="px-3 py-4 space-y-3">
      <p className="text-sm">Nothing posted here.</p>
      <p className="text-xs text-[var(--text-dim)] leading-relaxed">
        Silent for <span data-numeric className="text-[var(--text)]">{days}</span>{' '}
        {days === 1 ? 'day' : 'days'}
        {silence?.before && silence?.after && (
          <> — <span data-numeric>{iso(start)}</span> to <span data-numeric>{iso(end)}</span></>
        )}.
      </p>
      {silence?.before && (
        <button onClick={() => onReveal(silence.before!.id)} className="text-left w-full group">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">
            Last before
          </p>
          <p className="text-xs line-clamp-3 group-hover:text-[var(--accent)] transition-colors">
            {silence.before.text}
          </p>
        </button>
      )}
      {silence?.after && (
        <button onClick={() => onReveal(silence.after!.id)} className="text-left w-full group">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">
            First after
          </p>
          <p className="text-xs line-clamp-3 group-hover:text-[var(--accent)] transition-colors">
            {silence.after.text}
          </p>
        </button>
      )}
    </div>
  )
}

function kindColor(kind: string): string {
  switch (kind) {
    case 'post': return 'var(--text)'
    case 'thread': return 'var(--accent)'
    case 'reply': return 'var(--text-dim)'
    case 'quote': return 'color-mix(in srgb, var(--accent) 55%, var(--text-dim))'
    default: return 'var(--danger)'
  }
}

export function formatRange(at: number, g: Granularity): string {
  const d = new Date(at)
  switch (g) {
    case 'year':
      return String(d.getUTCFullYear())
    case 'month':
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    case 'week': {
      const end = new Date(at + 6 * 86_400_000)
      const sameMonth = end.getUTCMonth() === d.getUTCMonth()
      const a = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
      const b = end.toLocaleDateString(undefined, {
        day: 'numeric', ...(sameMonth ? {} : { month: 'short' }), timeZone: 'UTC',
      })
      return `${a} – ${b}`
    }
    case 'day':
      return d.toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      })
  }
}
