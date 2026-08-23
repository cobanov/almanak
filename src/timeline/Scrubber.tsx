/**
 * The scrubber — the signature element.
 *
 * A density ridgeline on canvas, dragged with momentum, that moves a lit gate
 * through years of posting. Canvas for the track because 200k rects in the DOM
 * is not a thing; DOM for the tweets because text needs to be selectable.
 *
 * Replies are drawn as a separate dimmed band rather than folded into the
 * total. Sixty per cent of a real archive is replies, and a single stacked
 * height would say "you were loud in 2023" when it means "you were talking to
 * people in 2023". Those are different facts.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type { Bucket, Granularity } from '../store/TweetStore.ts'
import type { Era } from './eras.ts'

const GRANULARITIES: Granularity[] = ['year', 'month', 'week', 'day']

interface Props {
  buckets: Bucket[]
  granularity: Granularity
  onGranularity(g: Granularity): void
  /** Current position, UTC ms. */
  position: number
  onPosition(at: number): void
  eras: Era[]
  /** Rename a generated era label. */
  onRenameEra?(from: number, label: string): void
  /** Hide a generated era label. */
  onHideEra?(from: number): void
  /** The archive's longest silences, marked on the track. */
  gaps?: { from: number; to: number; days: number }[]
  /** Vertical layout for narrow screens. */
  vertical?: boolean
}

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export function Scrubber({
  buckets, granularity, onGranularity, position, onPosition, eras,
  onRenameEra, onHideEra, gaps = [], vertical = false,
}: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const velocity = useRef(0)
  const raf = useRef(0)
  const lastX = useRef(0)

  const reduceMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [],
  )

  const range = useMemo(() => {
    if (buckets.length === 0) return { min: 0, max: 1 }
    return { min: buckets[0].at, max: buckets[buckets.length - 1].at || buckets[0].at + 1 }
  }, [buckets])

  const toFraction = useCallback(
    (at: number) => (at - range.min) / Math.max(1, range.max - range.min),
    [range],
  )
  const fromFraction = useCallback(
    (f: number) => range.min + f * (range.max - range.min),
    [range],
  )

  // --- painting -------------------------------------------------------------

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = wrap.clientWidth, h = wrap.clientHeight
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    if (buckets.length === 0) return

    // Scanned, not spread-and-mapped: this runs on every frame of a drag, so
    // allocating an array per frame is wasted work, and at day granularity
    // over a long archive the spread would also risk the call stack.
    let peak = 1
    for (const b of buckets) if (b.total > peak) peak = b.total
    const along = vertical ? h : w
    const step = along / buckets.length
    const barW = Math.max(1, step - (step > 4 ? 1 : 0))
    const depth = vertical ? w : h

    const light = css('--text'), dim = css('--text-dim'), accent = css('--accent')

    buckets.forEach((b, i) => {
      const at = i * step
      const totalLen = (b.total / peak) * (depth - 18)
      const replyLen = (b.replies / peak) * (depth - 18)

      // Replies band first, dimmed and behind.
      ctx.fillStyle = dim
      ctx.globalAlpha = 0.35
      if (vertical) ctx.fillRect(0, at, replyLen, barW)
      else ctx.fillRect(at, depth - replyLen, barW, replyLen)

      // Originals stacked above, in full light.
      ctx.globalAlpha = 0.85
      ctx.fillStyle = light
      const originalLen = totalLen - replyLen
      if (vertical) ctx.fillRect(replyLen, at, originalLen, barW)
      else ctx.fillRect(at, depth - totalLen, barW, originalLen)
    })
    ctx.globalAlpha = 1

    // Silences: the longest gaps get their own hatched band. The brief called
    // these the most interesting thing in an archive, so they are marked on
    // the track rather than only listed in a panel.
    for (const gap of gaps) {
      const a = Math.max(0, Math.min(1, toFraction(gap.from)))
      const b = Math.max(0, Math.min(1, toFraction(gap.to)))
      if (b - a < 0.004) continue
      const x0 = a * along, width = (b - a) * along
      ctx.save()
      ctx.beginPath()
      if (vertical) ctx.rect(0, x0, w, width)
      else ctx.rect(x0, 0, width, h)
      ctx.clip()
      ctx.strokeStyle = dim
      ctx.globalAlpha = 0.22
      ctx.lineWidth = 1
      // Diagonal hatch, so a silence reads as absence rather than as data.
      const extent = (vertical ? h : w) + depth
      for (let d = -depth; d < extent; d += 6) {
        ctx.beginPath()
        if (vertical) { ctx.moveTo(0, x0 + d); ctx.lineTo(w, x0 + d + depth) }
        else { ctx.moveTo(x0 + d, h); ctx.lineTo(x0 + d + depth, 0) }
        ctx.stroke()
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // The gate: a lit band at the current position.
    const f = Math.min(1, Math.max(0, toFraction(position)))
    const gate = f * along
    const gateW = Math.max(step, 3)

    ctx.fillStyle = accent
    ctx.globalAlpha = 0.16
    if (vertical) ctx.fillRect(0, gate - gateW / 2, w, gateW)
    else ctx.fillRect(gate - gateW / 2, 0, gateW, h)

    ctx.globalAlpha = 1
    ctx.fillStyle = accent
    if (vertical) ctx.fillRect(0, gate - 1, w, 2)
    else ctx.fillRect(gate - 1, 0, 2, h)
  }, [buckets, position, toFraction, vertical, gaps])

  useEffect(() => {
    paint()
    const ro = new ResizeObserver(paint)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [paint])

  // --- dragging -------------------------------------------------------------

  const seekTo = useCallback((clientPos: number) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const f = vertical
      ? (clientPos - rect.top) / rect.height
      : (clientPos - rect.left) / rect.width
    onPosition(fromFraction(Math.min(1, Math.max(0, f))))
  }, [fromFraction, onPosition, vertical])

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    cancelAnimationFrame(raf.current)
    velocity.current = 0
    setDragging(true)
    lastX.current = vertical ? e.clientY : e.clientX
    seekTo(vertical ? e.clientY : e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const pos = vertical ? e.clientY : e.clientX
    velocity.current = pos - lastX.current
    lastX.current = pos
    seekTo(pos)
  }

  const onPointerUp = () => {
    setDragging(false)
    // Momentum, with friction. Reduced-motion keeps the function, drops the glide.
    if (reduceMotion || Math.abs(velocity.current) < 2) return

    const wrap = wrapRef.current
    if (!wrap) return
    const span = vertical ? wrap.clientHeight : wrap.clientWidth
    let v = velocity.current
    let f = toFraction(position)

    const glide = () => {
      v *= 0.94
      f += v / span
      if (f < 0 || f > 1) { f = Math.min(1, Math.max(0, f)); v = 0 }
      onPosition(fromFraction(f))
      if (Math.abs(v) > 0.4) raf.current = requestAnimationFrame(glide)
    }
    raf.current = requestAnimationFrame(glide)
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // --- keyboard and zoom ----------------------------------------------------

  const nudge = useCallback((steps: number) => {
    const i = buckets.findIndex((b) => b.at >= position)
    const next = Math.min(buckets.length - 1, Math.max(0, (i < 0 ? buckets.length - 1 : i) + steps))
    if (buckets[next]) onPosition(buckets[next].at)
  }, [buckets, position, onPosition])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const level = GRANULARITIES.indexOf(granularity)
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); nudge(-1); break
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); nudge(1); break
      case 'PageUp': e.preventDefault(); nudge(-10); break
      case 'PageDown': e.preventDefault(); nudge(10); break
      case 'Home': e.preventDefault(); onPosition(range.min); break
      case 'End': e.preventDefault(); onPosition(range.max); break
      case '+': case '=':
        e.preventDefault()
        if (level < GRANULARITIES.length - 1) onGranularity(GRANULARITIES[level + 1])
        break
      case '-':
        e.preventDefault()
        if (level > 0) onGranularity(GRANULARITIES[level - 1])
        break
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    const level = GRANULARITIES.indexOf(granularity)
    if (e.ctrlKey || e.metaKey) {
      // Zoom changes bucket granularity and re-aggregates.
      if (e.deltaY < 0 && level < GRANULARITIES.length - 1) onGranularity(GRANULARITIES[level + 1])
      if (e.deltaY > 0 && level > 0) onGranularity(GRANULARITIES[level - 1])
      return
    }
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0
    if (dx !== 0) {
      const wrap = wrapRef.current
      if (!wrap) return
      const span = vertical ? wrap.clientHeight : wrap.clientWidth
      onPosition(fromFraction(Math.min(1, Math.max(0, toFraction(position) + dx / span))))
    }
  }

  const fmt = useMemo(() => new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    ...(granularity !== 'year' ? { month: 'short' } : {}),
    ...(granularity === 'day' || granularity === 'week' ? { day: 'numeric' } : {}),
  }), [granularity])

  return (
    <div className={vertical ? 'h-full flex flex-row-reverse gap-1' : 'w-full'}>
      <div className={vertical ? 'relative w-14 h-full' : 'relative w-full'}>
        <div
          ref={wrapRef}
          role="slider"
          tabIndex={0}
          aria-label="Position in the archive"
          aria-valuemin={range.min}
          aria-valuemax={range.max}
          aria-valuenow={position}
          aria-valuetext={fmt.format(new Date(position))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
          className={`${vertical ? 'w-14 h-full' : 'w-full h-20'} relative touch-none select-none
                      ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <canvas ref={canvasRef} className="absolute inset-0 block" />
        </div>
      </div>

      {!vertical && (
        <>
          {/* Eras annotate the track. Labels are generated, so they are set as inferred. */}
          <div className="relative h-5 mt-0.5">
            {eras.map((era) => {
              const left = toFraction(era.from) * 100
              const width = Math.max(0, (toFraction(era.to) - toFraction(era.from)) * 100)
              if (width < 4) return null
              const isEditing = editing === era.from
              return (
                <div
                  key={era.from}
                  className="absolute top-0 border-l border-[var(--edge)] pl-1.5 overflow-hidden whitespace-nowrap group"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={era.edited
                    ? `${era.tweets.toLocaleString()} tweets — you named this one`
                    : `${era.tweets.toLocaleString()} tweets — label inferred from posting volume and distinctive terms. Click to rename.`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={era.label === '—' ? '' : era.label}
                      placeholder="name this era"
                      onBlur={(e) => { onRenameEra?.(era.from, e.target.value); setEditing(null) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      className="w-full bg-[var(--surface-lit)] border border-[var(--accent)] rounded-[2px]
                                 px-1 text-[10px] outline-none"
                    />
                  ) : (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => setEditing(era.from)}
                        className={`text-[10px] text-left truncate hover:text-[var(--accent)] ${
                          era.edited ? 'text-[var(--text-dim)]' : 'inferred'
                        }`}
                      >
                        {era.label}
                      </button>
                      <button
                        onClick={() => onHideEra?.(era.from)}
                        aria-label={`Hide the label "${era.label}"`}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--text-dim)]
                                   hover:text-[var(--danger)] transition-opacity"
                      >×</button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--text-dim)]">
            <span className="tnum">{new Date(range.min).getUTCFullYear()}</span>
            <span className="flex items-center gap-2">
              <span className="tnum text-[var(--accent)]">{fmt.format(new Date(position))}</span>
            </span>
            <span className="tnum">{new Date(range.max).getUTCFullYear()}</span>
          </div>
        </>
      )}
    </div>
  )
}
