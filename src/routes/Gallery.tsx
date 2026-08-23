/**
 * Every image and video in the archive, laid out at its own proportions.
 *
 * V1 cropped everything to a square, which is tidy and throws away the shape
 * of the picture. This justifies rows using the dimensions X recorded, so a
 * panorama reads as a panorama. The layout is computed before any image loads,
 * so nothing reflows and virtualization needs no measurement pass.
 *
 * Media is still fetched only for visible rows, and the loader's LRU revokes
 * object URLs on eviction — without that, a long scroll keeps every image ever
 * shown resident.
 */

import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore, useMedia } from '../app/state.tsx'
import { useParam, useEscape } from '../app/router.ts'
import { Button, Empty, Num } from '../ui/primitives.tsx'
import { statusUrl } from '../ui/TweetView.tsx'
import { justify, ratioOf, type Row } from '../media/justify.ts'
import type { Tweet, MediaItem } from '../archive/types.ts'

interface Entry {
  tweet: Tweet
  media: MediaItem
  index: number
  ratio: number
}

const GAP = 4

/**
 * The container's width, measured synchronously on mount and then observed.
 *
 * Waiting for the ResizeObserver's first callback is not enough: the layout
 * depends on this number, so a width of zero means zero rows, and if that
 * first callback does not arrive the gallery renders nothing at all. Read the
 * element directly before paint, then let the observer handle changes.
 */
function useContainerWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)

  // oxlint flags the setState below as a cascading render. It is deliberate:
  // the layout depends on a measurement only the DOM can give, and taking it
  // before paint is what stops the gallery rendering zero rows on first frame.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width
      if (next > 0) setWidth(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return width
}

function Tile({ entry, width, height, onOpen, handle }: {
  entry: Entry; width: number; height: number; onOpen(): void; handle: string
}) {
  const loader = useMedia()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void loader.get(entry.media.file).then((u) => { if (live) setUrl(u) })
    return () => { live = false }
  }, [entry.media.file, loader])

  const isVideo = entry.media.file.toLowerCase().endsWith('.mp4')
  const label = entry.tweet.text.slice(0, 120) || 'Media from this tweet'
  const date = new Date(entry.tweet.at)

  return (
    <div className="relative group shrink-0" style={{ width, height }}>
      <button
        onClick={onOpen}
        aria-label={`${isVideo ? 'Play video' : 'Open image'} from ${date.toLocaleDateString()}: ${label}`}
        className="block w-full h-full overflow-hidden rounded-sm bg-[var(--surface)]
                   border border-transparent hover:border-[var(--accent)] transition-colors"
      >
        {url ? (
          isVideo
            ? <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            : <img src={url} loading="lazy" className="w-full h-full object-cover" alt={label} />
        ) : (
          <span className="block w-full h-full bg-[var(--surface-lit)]" />
        )}

        {/* A video whose first frame is black, or which the browser declines to
            decode a poster for, is otherwise an empty rectangle. Mark it. */}
        {isVideo && (
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center pointer-events-none"
          >
            <span className="w-9 h-9 rounded-full bg-black/45 border border-white/25
                             grid place-items-center text-white/80 text-[11px] pl-0.5">▶</span>
          </span>
        )}
      </button>

      {/* Provenance without opening the lightbox: what it is, when, and a way
          straight to the real tweet. */}
      <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-end gap-1.5
                      bg-gradient-to-t from-black/70 to-transparent
                      opacity-0 group-hover:opacity-100 focus-within:opacity-100
                      transition-opacity pointer-events-none rounded-b-sm">
        <span data-numeric className="text-[10px] text-white/85 pointer-events-none">
          {date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          {entry.tweet.likes > 0 && ` · ♥ ${entry.tweet.likes.toLocaleString()}`}
        </span>
        <a
          href={statusUrl(handle, entry.tweet.id)}
          target="_blank" rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open this tweet on x.com, from ${date.toLocaleDateString()}`}
          className="ml-auto pointer-events-auto text-[10px] text-white/85 hover:text-white
                     px-1 rounded-sm bg-black/40"
        >↗</a>
      </div>

      {isVideo && (
        <span className="absolute top-1 right-1 text-[10px] px-1 rounded-sm bg-black/60 text-white pointer-events-none">
          {entry.media.kind}
        </span>
      )}
    </div>
  )
}

function Lightbox({ entries, at, onClose, onMove, handle }: {
  entries: Entry[]; at: number; onClose(): void; onMove(next: number): void; handle: string
}) {
  const loader = useMedia()
  const [url, setUrl] = useState<string | null>(null)
  const entry = entries[at]
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    setUrl(null)
    if (entry) void loader.get(entry.media.file).then((u) => { if (live) setUrl(u) })
    return () => { live = false }
  }, [entry, loader])

  useEscape(onClose)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onMove(Math.max(0, at - 1))
      if (e.key === 'ArrowRight') onMove(Math.min(entries.length - 1, at + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at, entries.length, onMove])

  if (!entry) return null
  const isVideo = entry.media.file.toLowerCase().endsWith('.mp4')
  const date = new Date(entry.tweet.at)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 flex flex-col"
      role="dialog" aria-modal="true" aria-label="Media viewer"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 60) onMove(Math.min(entries.length - 1, Math.max(0, at + (dx < 0 ? 1 : -1))))
        touchX.current = null
      }}
    >
      <div className="flex items-center gap-3 px-4 py-2 text-xs text-[var(--text-dim)]">
        <span className="tnum">{at + 1} / {entries.length}</span>
        {url && (
          <a href={url} download={entry.media.file} className="hover:text-[var(--accent)]">
            download original
          </a>
        )}
        <button onClick={onClose} className="ml-auto hover:text-white">close (esc)</button>
      </div>

      <div className="flex-1 min-h-0 grid place-items-center px-4 relative" onClick={onClose}>
        {/* On-screen arrows: a phone has no arrow keys. */}
        <button
          onClick={(e) => { e.stopPropagation(); onMove(Math.max(0, at - 1)) }}
          disabled={at === 0}
          aria-label="Previous"
          className="absolute left-2 z-10 w-10 h-10 rounded-full bg-black/40 text-white/80
                     hover:bg-black/70 disabled:opacity-20"
        >‹</button>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(Math.min(entries.length - 1, at + 1)) }}
          disabled={at === entries.length - 1}
          aria-label="Next"
          className="absolute right-2 z-10 w-10 h-10 rounded-full bg-black/40 text-white/80
                     hover:bg-black/70 disabled:opacity-20"
        >›</button>

        {url && (isVideo
          ? <video src={url} controls autoPlay className="max-h-full max-w-full"
                   onClick={(e) => e.stopPropagation()} />
          : <img src={url} className="max-h-full max-w-full object-contain"
                 alt={entry.tweet.text.slice(0, 200) || 'Media'}
                 onClick={(e) => e.stopPropagation()} />)}
      </div>

      <div className="px-4 py-3 max-w-2xl mx-auto w-full text-sm">
        <p className="whitespace-pre-wrap text-[var(--text)] leading-relaxed">{entry.tweet.text}</p>
        <div className="flex items-center gap-3 mt-2.5">
          <span data-numeric className="text-xs text-[var(--text-dim)]">
            {date.toLocaleDateString()} · ♥ {entry.tweet.likes.toLocaleString()}
          </span>
          <a
            href={statusUrl(handle, entry.tweet.id)}
            target="_blank" rel="noreferrer noopener"
            className="ml-auto px-2.5 py-1 text-xs rounded-sm border border-[var(--edge)]
                       text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >open on x.com ↗</a>
        </div>
      </div>
    </div>
  )
}

export function Gallery() {
  const store = useStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(measureRef)
  const [item, setItem] = useParam('item')
  const [kind, setKind] = useParam('type')
  const [year, setYear] = useParam('year')
  const [shuffled, setShuffled] = useState<number[] | null>(null)

  const years = useMemo(() => {
    const set = new Set<number>()
    for (const t of store.tweets) if (t.media.length) set.add(new Date(t.at).getUTCFullYear())
    return [...set].sort((a, b) => b - a)
  }, [store])

  const all = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    const wantYear = year ? Number(year) : null
    for (const tweet of store.tweets) {
      if (wantYear !== null && new Date(tweet.at).getUTCFullYear() !== wantYear) continue
      tweet.media.forEach((media, index) => {
        if (!media.present) return
        if (kind && media.kind !== kind) return
        out.push({ tweet, media, index, ratio: ratioOf(media.width, media.height) })
      })
    }
    return out.reverse() // newest first
  }, [store, kind, year])

  const entries = useMemo(() => {
    if (!shuffled) return all
    return shuffled.map((i) => all[i]).filter(Boolean)
  }, [all, shuffled])

  const targetHeight = width < 640 ? 150 : width < 1100 ? 200 : 240

  const { rows, totalHeight } = useMemo(
    () => justify(entries, { containerWidth: width, targetHeight, gap: GAP }),
    [entries, width, targetHeight],
  )

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // Heights are exact because the layout was computed from stored dimensions.
    estimateSize: (i) => rows[i].height + GAP,
    overscan: 3,
  })

  useEffect(() => { virtualizer.measure() }, [rows, virtualizer])

  const shuffle = useCallback(() => {
    const order = all.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    setShuffled(order)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [all])

  const openIndex = useMemo(() => {
    if (!item) return -1
    const [id, i] = item.split(':')
    return entries.findIndex((e) => e.tweet.id === id && e.index === Number(i))
  }, [item, entries])

  // Which month is at the top of the viewport. Meaningless once shuffled.
  const stickyLabel = useMemo(() => {
    if (shuffled) return null
    const first = virtualizer.getVirtualItems()[0]
    const row = first && rows[first.index]
    const at = row?.items[0]?.item.tweet.at
    return at
      ? new Date(at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : null
  }, [virtualizer, rows, shuffled])

  const chip = (active: boolean) =>
    `px-2 py-1 rounded-sm border transition-colors ${
      active ? 'border-[var(--accent)] text-[var(--accent)]'
             : 'border-[var(--edge)] text-[var(--text-dim)] hover:border-[var(--text-dim)]'
    }`

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-[var(--edge)] px-4 py-2 flex items-center gap-2 text-xs flex-wrap">
        {(['photo', 'video', 'gif'] as const).map((k) => (
          <button key={k} onClick={() => setKind(kind === k ? null : k)} className={chip(kind === k)}>
            {k}
          </button>
        ))}

        <span className="w-px h-4 bg-[var(--edge)] mx-1" />

        <div className="flex gap-1 overflow-x-auto max-w-[46vw]">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(year === String(y) ? null : String(y))}
              className={`${chip(year === String(y))} tnum shrink-0`}
            >{y}</button>
          ))}
        </div>

        <Button onClick={shuffled ? () => setShuffled(null) : shuffle} className="!py-1">
          {shuffled ? 'unshuffle' : 'shuffle'}
        </Button>
        <span className="ml-auto text-[var(--text-dim)]"><Num value={entries.length} /> items</span>
      </div>

      {/* The gutter is reserved whether or not a scrollbar is showing. Without
          it the container narrows the moment content appears, and every row is
          justified to a width that no longer exists. */}
      <div ref={scrollRef} className="flex-1 overflow-y-scroll overflow-x-hidden relative [scrollbar-gutter:stable]">
        {stickyLabel && entries.length > 0 && (
          <div className="sticky top-0 z-10 px-3 py-1 text-[10px] tracking-wider uppercase
                          text-[var(--text-dim)] bg-[var(--bg)]/85 backdrop-blur-sm w-fit rounded-br-sm">
            {stickyLabel}
          </div>
        )}
        <div ref={measureRef} className="px-1">
          {entries.length === 0 ? (
            <Empty
              title={year || kind ? 'No media matches these filters.' : 'No media in this archive.'}
              action={(year || kind)
                ? <button onClick={() => { setYear(null); setKind(null) }}
                          className="text-sm text-[var(--accent)] hover:underline">Clear filters</button>
                : undefined}
            />
          ) : (
            <div style={{ height: totalHeight, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((v) => {
                const row: Row<Entry> = rows[v.index]
                return (
                  <div
                    key={v.key}
                    className="absolute left-0 flex"
                    style={{ top: row.top, height: row.height, gap: GAP }}
                  >
                    {row.items.map((placed) => (
                      <Tile
                        key={placed.item.tweet.id + placed.item.index}
                        entry={placed.item}
                        width={placed.width}
                        height={placed.height}
                        handle={store.meta.handle}
                        onOpen={() => setItem(`${placed.item.tweet.id}:${placed.item.index}`, true)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {openIndex >= 0 && (
        <Lightbox
          entries={entries}
          at={openIndex}
          handle={store.meta.handle}
          onClose={() => setItem(null)}
          onMove={(next) => {
            const e = entries[next]
            if (e) setItem(`${e.tweet.id}:${e.index}`, false)
          }}
        />
      )}
    </div>
  )
}
