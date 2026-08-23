/**
 * Application state: which archive is open, its store, and its media loader.
 *
 * Deliberately one context and no state library. There is exactly one piece of
 * long-lived state here — the open archive — and everything else is derived
 * from it or lives in the URL.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import * as Comlink from 'comlink'
import { MemoryStore } from '../store/MemoryStore.ts'
import { MediaLoader } from '../media/loader.ts'
import { DirectorySource, ZipSource, BundledSource, demoBaseUrl, type ArchiveSource } from '../archive/source.ts'
import { ArchiveError } from '../archive/parse.ts'
import type { Progress } from '../archive/parse.ts'
import type { ParsedArchive } from '../archive/types.ts'
import type { ParseApi, SourceSpec } from '../worker/parse.worker.ts'
import { saveArchive, type StoredArchive } from './persist.ts'

interface OpenArchive {
  store: MemoryStore
  media: MediaLoader
  source: ArchiveSource
}

interface AppState {
  archive: OpenArchive | null
  progress: Progress | null
  error: { message: string; nextStep: string } | null
  openDirectory(handle: FileSystemDirectoryHandle, label: string): Promise<void>
  openZip(file: File): Promise<void>
  openDemo(): Promise<void>
  close(): void
  clearError(): void
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp outside AppProvider')
  return value
}

/** The store, when one is open. Throws in views that require an archive. */
export function useStore(): MemoryStore {
  const { archive } = useApp()
  if (!archive) throw new Error('useStore with no archive open')
  return archive.store
}

export function useMedia(): MediaLoader {
  const { archive } = useApp()
  if (!archive) throw new Error('useMedia with no archive open')
  return archive.media
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [archive, setArchive] = useState<OpenArchive | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<AppState['error']>(null)

  const run = useCallback(async (spec: SourceSpec, source: ArchiveSource) => {
    setError(null)
    setProgress({ phase: 'reading', message: 'Opening', tweets: 0, media: 0, fraction: null })

    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('../worker/parse.worker.ts', import.meta.url), { type: 'module' })
      const api = Comlink.wrap<ParseApi>(worker)
      const parsed = (await api.parse(spec, Comlink.proxy(setProgress))) as ParsedArchive

      archive?.media.dispose()
      setArchive({
        store: new MemoryStore(parsed),
        media: new MediaLoader(source),
        source,
      })

      const entry: StoredArchive = {
        id: parsed.meta.id,
        label: parsed.meta.handle,
        handle: parsed.meta.handle,
        addedAt: Date.now(),
        tweetCount: parsed.meta.tweetCount,
        ...(spec.kind === 'directory' ? { dirHandle: spec.handle } : {}),
      }
      void saveArchive(entry)
    } catch (cause) {
      const e = cause as Error
      setError(
        e instanceof ArchiveError
          ? { message: e.message, nextStep: e.nextStep }
          : {
              message: e?.message ?? 'The archive could not be read.',
              nextStep: 'Check that this is an unmodified X export, then try again.',
            },
      )
    } finally {
      worker?.terminate()
      setProgress(null)
    }
  }, [archive])

  const value = useMemo<AppState>(() => ({
    archive,
    progress,
    error,
    clearError: () => setError(null),
    close: () => { archive?.media.dispose(); setArchive(null) },
    openDirectory: (handle, label) =>
      run({ kind: 'directory', handle, label }, new DirectorySource(handle, label)),
    openZip: async (file) => {
      const source = await ZipSource.open(file)
      return run({ kind: 'zip', file }, source)
    },
    openDemo: () => {
      // Absolute, because the worker resolves relative URLs against itself.
      const base = demoBaseUrl()
      return run({ kind: 'bundled', base }, new BundledSource(base))
    },
  }), [archive, progress, error, run])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
