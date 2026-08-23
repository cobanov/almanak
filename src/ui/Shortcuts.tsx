/**
 * The shortcuts overlay.
 *
 * The app has had keyboard navigation since M2 and no way to discover it.
 * Bound to `?`, which is where every reader expects to find this.
 */

import { useEffect, useState } from 'react'

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Move around',
    keys: [
      ['g then t', 'Timeline'],
      ['g then s', 'Tweets and search'],
      ['g then h', 'Threads'],
      ['g then l', 'Gallery'],
      ['g then a', 'Analysis'],
      ['g then c', 'Settings'],
    ],
  },
  {
    title: 'Timeline',
    keys: [
      ['← →', 'Step one period'],
      ['Page up / down', 'Step ten periods'],
      ['Home / End', 'First or last period'],
      ['+ / −', 'Zoom in or out'],
      ['⌘ or Ctrl + scroll', 'Zoom in or out'],
    ],
  },
  {
    title: 'Reading',
    keys: [
      ['j / k', 'Next or previous thread'],
      ['← →', 'Next or previous image in the viewer'],
      ['Esc', 'Close the viewer'],
      ['?', 'This list'],
    ],
  },
]

export function Shortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return
      if (e.key === '?') { e.preventDefault(); setOpen((v) => !v) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4"
      role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--edge)] rounded-sm max-w-lg w-full
                   max-h-full overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center px-4 py-3 border-b border-[var(--edge)]">
          <h2 className="display text-sm">Keyboard</h2>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
          >close (esc)</button>
        </header>
        <div className="p-4 grid gap-5 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-2">
                {group.title}
              </h3>
              <dl className="space-y-1.5">
                {group.keys.map(([key, what]) => (
                  <div key={key} className="flex items-baseline gap-3 text-xs">
                    <dt>
                      <kbd className="tnum px-1.5 py-0.5 rounded-[2px] bg-[var(--surface-lit)]
                                      border border-[var(--edge)] text-[10px]">{key}</kbd>
                    </dt>
                    <dd className="text-[var(--text-dim)]">{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
