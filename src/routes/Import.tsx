/**
 * The first screen most people see.
 *
 * The privacy claim is stated once, plainly, near the drop target where it is
 * actually relevant — not as a badge, and not repeated on every screen.
 */

import { useState, useCallback, useEffect } from 'react'
import { useApp } from '../app/state.tsx'
import { useNavigate } from '../app/router.ts'
import { Button } from '../ui/primitives.tsx'
import { listArchives, regrant, forgetArchive, type StoredArchive } from '../app/persist.ts'

const supportsDirectoryPicker = 'showDirectoryPicker' in window

export function Import() {
  const { openDirectory, openZip, openDemo, progress, error, clearError, archive } = useApp()
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)
  const [recent, setRecent] = useState<StoredArchive[]>([])

  useEffect(() => { void listArchives().then(setRecent) }, [])
  useEffect(() => { if (archive) navigate('timeline') }, [archive, navigate])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    clearError()

    // A dropped folder arrives as a directory entry, a dropped export as a ZIP.
    for (const item of Array.from(e.dataTransfer.items)) {
      const handle = await (item as any).getAsFileSystemHandle?.()
      if (handle?.kind === 'directory') return openDirectory(handle, handle.name)
    }
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.zip')) return openZip(file)
    if (file) {
      return openZip(file).catch(() => {})
    }
  }, [openDirectory, openZip, clearError])

  const pickFolder = useCallback(async () => {
    clearError()
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
      await openDirectory(handle, handle.name)
    } catch { /* the picker was dismissed */ }
  }, [openDirectory, clearError])

  const reopen = useCallback(async (entry: StoredArchive) => {
    if (!entry.dirHandle) return
    if (await regrant(entry.dirHandle)) {
      await openDirectory(entry.dirHandle, entry.label)
    }
  }, [openDirectory])

  if (progress) {
    return (
      <div className="h-full grid place-items-center px-6">
        <div className="w-full max-w-md">
          <p className="display text-lg mb-6">{progress.message}</p>
          <div className="h-px bg-[var(--edge)] mb-6 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] duration-200"
              style={{ width: progress.fraction === null ? '30%' : `${progress.fraction * 100}%` }}
            />
          </div>
          {/* Real counters, not a fake bar: these are things actually found. */}
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-[var(--text-dim)]">Tweets</dt>
            <dd data-numeric className="text-right">{progress.tweets.toLocaleString()}</dd>
            <dt className="text-[var(--text-dim)]">Media files</dt>
            <dd data-numeric className="text-right">{progress.media.toLocaleString()}</dd>
          </dl>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="display text-3xl mb-3">Your X archive, finally easy to explore</h1>
        <p className="text-[var(--text-dim)] leading-relaxed mb-10">
          Drop an X data export and get a searchable record of it: a timeline you
          can drag through, every photo you posted, and analysis that states its
          own denominators.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border border-dashed rounded-sm p-10 text-center transition-colors ${
            dragging ? 'border-[var(--accent)] bg-[var(--surface)]' : 'border-[var(--edge)]'
          }`}
        >
          <p className="mb-1">Drop your export here</p>
          <p className="text-sm text-[var(--text-dim)] mb-6">
            The ZIP as it came from X, or the unzipped folder
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {supportsDirectoryPicker && (
              <Button variant="primary" onClick={pickFolder}>Choose folder</Button>
            )}
            <label>
              <Button variant="quiet" onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement)?.click()}>
                Choose ZIP
              </Button>
            </label>
            <input
              type="file" accept=".zip" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void openZip(f) }}
            />
            <Button onClick={() => void openDemo()}>See the demo</Button>
          </div>
        </div>

        {/* Said once, plainly, where it matters. */}
        <p className="text-sm text-[var(--text-dim)] mt-6 leading-relaxed">
          Everything happens in this browser tab. Your archive is never uploaded,
          and this app makes no network requests. Direct messages are skipped
          entirely — they are never read, indexed or shown.
        </p>

        {error && (
          <div className="mt-8 border border-[var(--danger)] rounded-sm p-4">
            <p className="text-sm mb-1">{error.message}</p>
            <p className="text-sm text-[var(--text-dim)]">{error.nextStep}</p>
          </div>
        )}

        {!supportsDirectoryPicker && (
          <p className="text-sm text-[var(--text-dim)] mt-6 leading-relaxed">
            This browser cannot open folders directly, so use the ZIP instead.
            Everything works, but your archive is re-read each session rather
            than remembered.
          </p>
        )}

        {recent.length > 0 && (
          <div className="mt-12">
            <h2 className="display text-sm mb-3">Opened before</h2>
            <ul className="divide-y divide-[var(--edge)] border-y border-[var(--edge)]">
              {recent.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm">@{entry.handle}</span>
                  <span data-numeric className="text-xs text-[var(--text-dim)]">
                    {entry.tweetCount.toLocaleString()} tweets
                  </span>
                  {entry.dirHandle && <Button onClick={() => void reopen(entry)}>Open</Button>}
                  <Button
                    variant="danger"
                    onClick={() => void forgetArchive(entry.id).then(() => listArchives().then(setRecent))}
                  >
                    Forget
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
