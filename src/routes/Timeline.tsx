/**
 * The timeline: an inspector for the selected stretch, the tweets in it, and
 * the scrubber that moves between stretches.
 *
 * The centre list shows exactly the tweets inside the selected bucket. V1
 * showed an index-based window around the gate instead, which meant the list
 * and the track disagreed about what "here" meant — a busy month spilled into
 * its neighbours and a quiet one borrowed from them.
 *
 * Defaults to posts and threads. Sixty per cent of a real archive is replies
 * to other people, median 74 characters, with no parent text anywhere in the
 * export, so a feed of everything is mostly fragments. Replies stay one click
 * away and remain visible as the track's dimmed band.
 */

import { useMemo, useState, useEffect, useCallback, useRef, useDeferredValue } from 'react'
import { useStore } from '../app/state.tsx'
import { useParam, useNavigate } from '../app/router.ts'
import { Scrubber } from '../timeline/Scrubber.tsx'
import { detectEras } from '../timeline/eras.ts'
import { Inspector, computeRangeStats, formatRange } from '../timeline/Inspector.tsx'
import { TweetView } from '../ui/TweetView.tsx'
import type { Granularity } from '../store/TweetStore.ts'
import { Num } from '../ui/primitives.tsx'
import { bucketStart } from '../store/MemoryStore.ts'
import { useEraLabels } from '../timeline/useEraLabels.ts'

/** End of the bucket that starts at `at`. Months and years are not fixed-width. */
function bucketEnd(at: number, g: Granularity): number {
  const d = new Date(at)
  switch (g) {
    case 'year': return Date.UTC(d.getUTCFullYear() + 1, 0, 1)
    case 'month': return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    case 'week': return at + 7 * 86_400_000
    case 'day': return at + 86_400_000
  }
}

/** Start of the bucket `steps` away from the one containing `at`. */
function stepBucket(at: number, g: Granularity, steps: number): number {
  const d = new Date(bucketStart(at, g))
  switch (g) {
    case 'year': return Date.UTC(d.getUTCFullYear() + steps, 0, 1)
    case 'month': return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + steps, 1)
    case 'week': return +d + steps * 7 * 86_400_000
    case 'day': return +d + steps * 86_400_000
  }
}

export function Timeline() {
  const store = useStore()
  const navigate = useNavigate()
  const [granularity, setGranularity] = useParam('g', 'month')
  const [atParam, setAt] = useParam('at')
  const [showReplies, setShowReplies] = useParam('replies')
  const [panelParam, setPanel] = useParam('panel')
  const [narrow, setNarrow] = useState(() => window.innerWidth < 900)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const g = (['year', 'month', 'week', 'day'].includes(granularity) ? granularity : 'month') as Granularity
  const buckets = useMemo(() => store.buckets(g), [store, g])
  const collapsed = panelParam === 'off'

  /**
   * Where to land with no position in the URL.
   *
   * The obvious answer is the last tweet, and it is wrong: the most recent
   * thing in an archive is very often an isolated reply, which the default
   * view hides — so the app opened on an empty panel. Land on the newest
   * tweet the default view will actually show.
   */
  const defaultPosition = useMemo(() => {
    for (let i = store.tweets.length - 1; i >= 0; i--) {
      if (store.tweets[i].kind !== 'reply') return store.tweets[i].at
    }
    return store.meta.lastAt
  }, [store])

  const position = atParam ? Number(atParam) : defaultPosition
  const deferredPosition = useDeferredValue(position)

  // Everything below keys on the bucket, not the raw position, so dragging
  // within one bucket recomputes nothing.
  const from = useMemo(() => bucketStart(deferredPosition, g), [deferredPosition, g])
  const to = useMemo(() => bucketEnd(from, g), [from, g])

  const rawEras = useMemo(() => detectEras(store.buckets('month'), store.tweets), [store])
  const { eras, rename, hide, reset, hiddenCount } = useEraLabels(store.meta.id, rawEras)

  const stats = useMemo(
    () => computeRangeStats(store, from, to, stepBucket(from, g, -1)),
    [store, from, to, g],
  )

  const includeReplies = showReplies === 'yes'
  const visible = useMemo(() => {
    const inRange = includeReplies ? stats.tweets : stats.tweets.filter((t) => t.kind !== 'reply')
    return [...inRange].reverse() // newest first within the range
  }, [stats.tweets, includeReplies])

  /** Nearest tweets either side, so an empty bucket can report its silence. */
  const silence = useMemo(() => {
    if (stats.count > 0) return null
    let before: typeof store.tweets[number] | null = null
    let after: typeof store.tweets[number] | null = null
    for (const t of store.tweets) {
      if (t.at < from) before = t
      else if (t.at >= to) { after = t; break }
    }
    return { before, after }
  }, [store, stats.count, from, to])

  const replyCount = useMemo(
    () => store.tweets.filter((t) => t.kind === 'reply').length,
    [store],
  )

  const goTo = useCallback((at: number) => setAt(String(Math.round(at))), [setAt])

  const step = useCallback((direction: -1 | 1) => {
    goTo(stepBucket(deferredPosition, g, direction))
  }, [goTo, deferredPosition, g])

  /** Scroll a tweet into view, and flash it so the eye can find it. */
  const reveal = useCallback((id: string) => {
    const target = store.byId(id)
    if (!target) return
    // It may live outside the current bucket — move there first.
    if (target.at < from || target.at >= to) goTo(target.at)
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-tweet="${id}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.classList.add('flash')
      setTimeout(() => el?.classList.remove('flash'), 1200)
    })
  }, [store, from, to, goTo])

  const openRange = useCallback(() => {
    const p = new URLSearchParams()
    p.set('from', new Date(from).toISOString().slice(0, 10))
    p.set('to', new Date(to - 1).toISOString().slice(0, 10))
    navigate('tweets', p)
  }, [from, to, navigate])

  const inspector = (
    <Inspector
      stats={stats}
      from={from}
      to={to}
      granularity={g}
      onGranularity={setGranularity}
      onStep={step}
      onCollapse={() => setPanel('off')}
      onReveal={reveal}
      onOpenRange={openRange}
      onFilterMention={(h) => {
        const p = new URLSearchParams()
        p.set('mentions', h)
        navigate('tweets', p)
      }}
      handle={store.meta.handle}
      silence={silence}
      threads={store.threads}
    />
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {!narrow && !collapsed && inspector}

        {!narrow && collapsed && (
          <button
            onClick={() => setPanel(null)}
            aria-label="Show the period panel"
            className="w-8 shrink-0 border-r border-[var(--edge)] bg-[var(--surface)]
                       text-[var(--text-dim)] hover:text-[var(--accent)] text-xs"
          >⟩</button>
        )}

        <div ref={listRef} className="flex-1 min-w-0 overflow-auto">
          {narrow && (
            <MobileSummary
              label={formatRange(from, g)}
              count={stats.count}
              likes={stats.likes}
              granularity={g}
              onGranularity={setGranularity}
              onStep={step}
            />
          )}
          <div className="max-w-2xl mx-auto">
            {visible.length === 0 ? (
              <div className="p-8 text-sm text-[var(--text-dim)] leading-relaxed">
                {stats.count === 0
                  ? <>Nothing in {formatRange(from, g)}. Drag the track, or step with the arrows.</>
                  : <>Only replies here. <button
                      onClick={() => setShowReplies('yes')}
                      className="text-[var(--accent)] hover:underline"
                    >Show replies</button> to read them.</>}
              </div>
            ) : (
              visible.map((t) => (
                <div key={t.id} data-tweet={t.id} className="gate-in">
                  <TweetView
                    tweet={t}
                    handle={store.meta.handle}
                    onOpenMedia={(id, i) => {
                      const p = new URLSearchParams()
                      p.set('item', `${id}:${i}`)
                      navigate('gallery', p)
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--edge)] px-4 py-2 bg-[var(--surface)] shrink-0">
        <div className="flex items-center gap-3 mb-1.5 text-[10px] text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[var(--text)] opacity-85 rounded-[1px]" />
            posts and threads
          </span>
          <button
            onClick={() => setShowReplies(showReplies === 'yes' ? null : 'yes')}
            className={`flex items-center gap-1.5 hover:text-[var(--text)] ${
              showReplies === 'yes' ? 'text-[var(--accent)]' : ''
            }`}
          >
            <span className="w-2 h-2 bg-[var(--text-dim)] opacity-40 rounded-[1px]" />
            replies (<Num value={replyCount} />) {showReplies === 'yes' ? 'shown' : 'hidden'}
          </button>
          {hiddenCount > 0 && (
            <button onClick={reset} className="hover:text-[var(--text)]">
              restore {hiddenCount} hidden {hiddenCount === 1 ? 'label' : 'labels'}
            </button>
          )}
          <span className="ml-auto opacity-70 hidden sm:inline">
            ⌘-scroll to zoom · arrows to step · ? for shortcuts
          </span>
        </div>
        <Scrubber
          buckets={buckets}
          granularity={g}
          onGranularity={setGranularity}
          position={position}
          onPosition={goTo}
          eras={eras}
          onRenameEra={rename}
          onHideEra={hide}
          gaps={store.longestGaps}
          vertical={false}
        />
      </div>
    </div>
  )
}

/** On narrow screens the panel becomes one line above the list, never hidden. */
function MobileSummary({ label, count, likes, granularity, onGranularity, onStep }: {
  label: string; count: number; likes: number
  granularity: Granularity
  onGranularity(g: Granularity): void
  onStep(d: -1 | 1): void
}) {
  return (
    <div className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--edge)] px-3 py-2">
      <div className="flex items-center gap-2">
        <button onClick={() => onStep(-1)} aria-label="Previous period"
                className="text-[var(--text-dim)] hover:text-[var(--accent)] px-1">‹</button>
        <span className="display text-sm flex-1 truncate">{label}</span>
        <span data-numeric className="text-xs text-[var(--text-dim)]">
          {count.toLocaleString()} · ♥ {likes.toLocaleString()}
        </span>
        <button onClick={() => onStep(1)} aria-label="Next period"
                className="text-[var(--text-dim)] hover:text-[var(--accent)] px-1">›</button>
      </div>
      <div className="flex mt-2 rounded-sm border border-[var(--edge)] overflow-hidden">
        {(['year', 'month', 'week', 'day'] as Granularity[]).map((g) => (
          <button
            key={g}
            onClick={() => onGranularity(g)}
            aria-pressed={g === granularity}
            className={`flex-1 py-1 text-[11px] capitalize ${
              g === granularity ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--text-dim)]'
            }`}
          >{g}</button>
        ))}
      </div>
    </div>
  )
}
