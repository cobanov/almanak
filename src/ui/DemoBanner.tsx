/**
 * Says what the demo is.
 *
 * The demo archive is invented — a fictional account, generated so that every
 * panel shows what it would show on a real one. Saying so matters: someone
 * should not read these as a real person's posts, and should not wonder
 * whether the numbers mean anything.
 *
 * Dismissible, and it stays dismissed.
 */

import { useState } from 'react'

const KEY = 'demo-banner-dismissed'

export function DemoBanner({ isDemo }: { isDemo: boolean }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })

  if (!isDemo || dismissed) return null

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-xs bg-[var(--surface-lit)]
                    border-b border-[var(--edge)] shrink-0">
      <span className="text-[var(--text-dim)] leading-relaxed">
        This is a made-up archive, invented so every panel has something real to
        show. Nobody wrote these posts. Drop your own export to read yours.
      </span>
      <button
        onClick={() => {
          setDismissed(true)
          try { localStorage.setItem(KEY, '1') } catch { /* fine, it returns next load */ }
        }}
        className="ml-auto shrink-0 text-[var(--text-dim)] hover:text-[var(--text)]"
        aria-label="Dismiss"
      >×</button>
    </div>
  )
}
