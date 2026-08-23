/**
 * Era labels are generated, so they have to be correctable.
 *
 * Changepoint detection plus TF-IDF produces a plausible name most of the
 * time and a wrong one some of the time. The brief required that a generated
 * label be editable and hideable; this holds those edits, keyed by archive, in
 * localStorage — the one piece of per-viewer state worth persisting, and
 * harmless if it is lost.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Era } from './eras.ts'

interface Overrides {
  /** Era start time -> label the reader typed. */
  renamed: Record<string, string>
  /** Era start times the reader hid. */
  hidden: string[]
}

const EMPTY: Overrides = { renamed: {}, hidden: [] }

function keyFor(archiveId: string) {
  return `eras:${archiveId}`
}

function read(archiveId: string): Overrides {
  try {
    const raw = localStorage.getItem(keyFor(archiveId))
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<Overrides>
    return { renamed: parsed.renamed ?? {}, hidden: parsed.hidden ?? [] }
  } catch {
    return EMPTY // private mode, or corrupt entry. Generated labels still work.
  }
}

export function useEraLabels(archiveId: string, generated: Era[]) {
  const [overrides, setOverrides] = useState<Overrides>(() => read(archiveId))

  // Switching archives has to load that archive's edits, not keep the last
  // one's. The lint rule reads this as a cascading render; it is a genuine
  // resynchronisation with external storage, which is what effects are for.
  useEffect(() => { setOverrides(read(archiveId)) }, [archiveId])

  const persist = useCallback((next: Overrides) => {
    setOverrides(next)
    try {
      localStorage.setItem(keyFor(archiveId), JSON.stringify(next))
    } catch {
      // Storage unavailable. The edit still applies for this session.
    }
  }, [archiveId])

  const eras = useMemo(() => {
    const hidden = new Set(overrides.hidden)
    return generated
      .filter((era) => !hidden.has(String(era.from)))
      .map((era) => {
        const custom = overrides.renamed[String(era.from)]
        return custom ? { ...era, label: custom, edited: true } : { ...era, edited: false }
      })
  }, [generated, overrides])

  const rename = useCallback((from: number, label: string) => {
    const renamed = { ...overrides.renamed }
    const trimmed = label.trim()
    if (trimmed) renamed[String(from)] = trimmed
    else delete renamed[String(from)] // cleared: fall back to the generated label
    persist({ ...overrides, renamed })
  }, [overrides, persist])

  const hide = useCallback((from: number) => {
    if (overrides.hidden.includes(String(from))) return
    persist({ ...overrides, hidden: [...overrides.hidden, String(from)] })
  }, [overrides, persist])

  const reset = useCallback(() => persist(EMPTY), [persist])

  return { eras, rename, hide, reset, hiddenCount: overrides.hidden.length }
}
