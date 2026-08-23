/**
 * The searchable list. Every filter round-trips through the URL, so a link
 * carries the exact view it was copied from and the back button works.
 */

import { useMemo, useRef, useDeferredValue } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore } from '../app/state.tsx'
import { useLocation, useParam, useNavigate } from '../app/router.ts'
import { emptyFilters, type Filters, type SortOrder } from '../store/TweetStore.ts'
import { TweetView } from '../ui/TweetView.tsx'
import { Empty, Num } from '../ui/primitives.tsx'
import type { TweetKind } from '../archive/types.ts'

const KINDS: TweetKind[] = ['post', 'thread', 'reply', 'quote', 'retweet']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** URL params to Filters. The URL is the source of truth, not component state. */
export function filtersFromParams(params: URLSearchParams): Filters {
  const f = emptyFilters()
  f.query = params.get('q') ?? ''
  const kinds = params.get('kind')
  if (kinds) f.kinds = new Set(kinds.split(',') as TweetKind[])
  const from = params.get('from'), to = params.get('to')
  if (from) f.from = Date.parse(from)
  if (to) f.to = Date.parse(to)
  const media = params.get('media')
  if (media === 'yes') f.hasMedia = true
  if (media === 'no') f.hasMedia = false
  f.mentions = params.get('mentions')
  f.hashtag = params.get('tag')
  f.domain = params.get('domain')
  f.lang = params.get('lang')
  f.client = params.get('client')
  const min = params.get('minlikes')
  if (min) f.minLikes = Number(min)
  const weekday = params.get('weekday')
  if (weekday !== null && weekday !== '') f.weekday = Number(weekday)
  const hour = params.get('hour')
  if (hour) {
    const [a, b] = hour.split('-')
    f.hourFrom = Number(a)
    f.hourTo = b === undefined ? Number(a) : Number(b)
  }
  f.useUtc = params.get('tz') === 'utc'
  f.sort = (params.get('sort') as SortOrder) ?? 'newest'
  return f
}

export function Tweets() {
  const store = useStore()
  const { params } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useParam('q')
  const parentRef = useRef<HTMLDivElement>(null)

  // Deferred so typing stays responsive while a large result set re-renders.
  const deferredParams = useDeferredValue(params.toString())
  const filters = useMemo(
    () => filtersFromParams(new URLSearchParams(deferredParams)),
    [deferredParams],
  )
  const results = useMemo(() => store.query(filters), [store, filters])

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 8,
  })

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    if (value === null || value === '') p.delete(key)
    else p.set(key, value)
    navigate('tweets', p, true)
  }

  const toggleKind = (kind: TweetKind) => {
    const active = new Set(filters.kinds)
    if (active.has(kind)) active.delete(kind)
    else active.add(kind)
    setParam('kind', [...active].join(','))
  }

  const facets = store.facets()

  const archiveYears = useMemo(() => {
    const first = new Date(store.meta.firstAt).getUTCFullYear()
    const last = new Date(store.meta.lastAt).getUTCFullYear()
    return Array.from({ length: last - first + 1 }, (_, i) => first + i)
  }, [store])

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-[var(--edge)] px-4 py-3 space-y-3">
        <div className="flex gap-2 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search — try "exact phrase", -exclude, from:2023, has:media'
            className="flex-1 bg-[var(--surface)] border border-[var(--edge)] rounded-sm px-3 py-2 text-sm
                       focus:border-[var(--accent)] outline-none"
          />
          <select
            value={filters.sort}
            onChange={(e) => setParam('sort', e.target.value)}
            className="bg-[var(--surface)] border border-[var(--edge)] rounded-sm px-2 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most-liked">Most liked</option>
            <option value="most-retweeted">Most retweeted</option>
          </select>
        </div>

        <div className="flex gap-1 flex-wrap items-center text-xs">
          <span className="text-[var(--text-dim)] mr-0.5">years</span>
          {archiveYears.map((y) => {
            const active = params.get('from') === `${y}-01-01`
            return (
              <button
                key={y}
                onClick={() => {
                  const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
                  if (active) { p.delete('from'); p.delete('to') }
                  else { p.set('from', `${y}-01-01`); p.set('to', `${y}-12-31`) }
                  navigate('tweets', p, true)
                }}
                className={`px-1.5 py-0.5 rounded-sm border tnum transition-colors ${
                  active ? 'border-[var(--accent)] text-[var(--accent)]'
                         : 'border-[var(--edge)] text-[var(--text-dim)] hover:border-[var(--text-dim)]'
                }`}
              >{y}</button>
            )
          })}
        </div>

        <div className="flex gap-1.5 flex-wrap items-center text-xs">
          {KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              className={`px-2 py-1 rounded-sm border transition-colors ${
                filters.kinds.has(kind)
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--edge)] text-[var(--text-dim)] hover:border-[var(--text-dim)]'
              }`}
            >
              {kind}
            </button>
          ))}

          <span className="w-px h-4 bg-[var(--edge)] mx-1" />

          <button
            onClick={() => setParam('media', filters.hasMedia === true ? null : 'yes')}
            className={`px-2 py-1 rounded-sm border transition-colors ${
              filters.hasMedia === true
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-[var(--edge)] text-[var(--text-dim)] hover:border-[var(--text-dim)]'
            }`}
          >
            has media
          </button>

          <select
            value={filters.client ?? ''} onChange={(e) => setParam('client', e.target.value || null)}
            className="bg-transparent border border-[var(--edge)] rounded-sm px-1.5 py-1 text-[var(--text-dim)]"
          >
            <option value="">any client</option>
            {facets.clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filters.lang ?? ''} onChange={(e) => setParam('lang', e.target.value || null)}
            className="bg-transparent border border-[var(--edge)] rounded-sm px-1.5 py-1 text-[var(--text-dim)]"
          >
            <option value="">any language</option>
            {facets.langs.slice(0, 12).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>

          <span className="w-px h-4 bg-[var(--edge)] mx-1" />

          <input
            type="date"
            value={params.get('from') ?? ''}
            onChange={(e) => setParam('from', e.target.value || null)}
            aria-label="From date"
            className="bg-transparent border border-[var(--edge)] rounded-sm px-1.5 py-1
                       text-[var(--text-dim)] tnum [color-scheme:dark]"
          />
          <span className="text-[var(--text-dim)]">→</span>
          <input
            type="date"
            value={params.get('to') ?? ''}
            onChange={(e) => setParam('to', e.target.value || null)}
            aria-label="To date"
            className="bg-transparent border border-[var(--edge)] rounded-sm px-1.5 py-1
                       text-[var(--text-dim)] tnum [color-scheme:dark]"
          />

          {[...params.keys()].some((k) => k !== 'sort') && (
            <button onClick={() => navigate('tweets', new URLSearchParams(), true)}
                    className="px-2 py-1 text-[var(--text-dim)] hover:text-[var(--accent)]">
              clear
            </button>
          )}

          {(filters.weekday !== null || filters.hourFrom !== null) && (
            <button
              onClick={() => {
                const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
                p.delete('weekday'); p.delete('hour'); p.delete('tz')
                navigate('tweets', p, true)
              }}
              className="px-2 py-1 rounded-sm border border-[var(--accent)] text-[var(--accent)]"
            >
              {filters.weekday !== null && WEEKDAYS[filters.weekday]}
              {filters.hourFrom !== null && (
                <span className="tnum">
                  {filters.weekday !== null ? ' ' : ''}
                  {String(filters.hourFrom).padStart(2, '0')}:00
                  {filters.hourTo !== null && filters.hourTo !== filters.hourFrom
                    ? `–${String(filters.hourTo).padStart(2, '0')}:59` : ''}
                </span>
              )} ×
            </button>
          )}

          <span className="ml-auto text-[var(--text-dim)]">
            <Num value={results.length} /> of <Num value={store.meta.tweetCount} />
          </span>
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        {results.length === 0 ? (
          <Empty title={query ? `Nothing matches “${query}”.` : 'No tweets match these filters.'} />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => (
              <div
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)` }}
              >
                <TweetView
                  tweet={results[row.index]}
                  handle={store.meta.handle}
                  highlight={filters.query}
                  onOpenMedia={(id, i) => {
                    const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
                    p.set('item', `${id}:${i}`)
                    navigate('gallery', p)
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
