/**
 * Where archive bytes come from.
 *
 * Three shapes have to behave identically to everything above: an unzipped
 * folder the user picked, a ZIP they dropped, and the demo archive bundled
 * with the app. Each is read lazily — media is never bulk-loaded, because a
 * real archive's media folder reaches tens of gigabytes.
 *
 * Every path goes through the DM guard. See dm-guard.ts.
 */

import { assertReadableDataFile, assertReadableMediaPath, isDirectMessagePath } from './dm-guard.ts'

/**
 * Absolute URL of the bundled demo, resolved against the current document.
 * Call this on the main thread; workers have a different notion of "here".
 */
export function demoBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return new URL(`${base}demo`, globalThis.location?.href ?? 'http://localhost/').href
}

export interface ArchiveSource {
  readonly kind: 'directory' | 'zip' | 'bundled'
  readonly label: string
  /** Data file names present under data/, e.g. ["tweets.js", "manifest.js"]. */
  list(): Promise<string[]>
  /** Read one data file. Throws for DM files. */
  readData(name: string): Promise<Uint8Array>
  /** Media filenames in tweets_media/. */
  listMedia(): Promise<string[]>
  /** Read one media file lazily. Throws for DM media. */
  readMedia(name: string): Promise<Blob>
}

// ------------------------------------------------------------------ directory

export class DirectorySource implements ArchiveSource {
  readonly kind = 'directory' as const
  #root: FileSystemDirectoryHandle
  readonly label: string

  constructor(root: FileSystemDirectoryHandle, label: string) {
    this.#root = root
    this.label = label
  }

  async #data(): Promise<FileSystemDirectoryHandle> {
    return this.#root.getDirectoryHandle('data')
  }

  async list(): Promise<string[]> {
    const out: string[] = []
    const data = await this.#data()
    for await (const [name, handle] of (data as any).entries()) {
      if (handle.kind === 'file' && name.endsWith('.js')) out.push(name)
    }
    return out
  }

  async readData(name: string): Promise<Uint8Array> {
    assertReadableDataFile(`data/${name}`)
    const file = await (await this.#data()).getFileHandle(name)
    return new Uint8Array(await (await file.getFile()).arrayBuffer())
  }

  async listMedia(): Promise<string[]> {
    const out: string[] = []
    try {
      const dir = await (await this.#data()).getDirectoryHandle('tweets_media')
      for await (const [name, handle] of (dir as any).entries()) {
        if (handle.kind === 'file' && !name.startsWith('.')) out.push(name)
      }
    } catch {
      // No media folder. The app runs without it and says so.
    }
    return out
  }

  async readMedia(name: string): Promise<Blob> {
    assertReadableMediaPath(`data/tweets_media/${name}`)
    const dir = await (await this.#data()).getDirectoryHandle('tweets_media')
    return (await dir.getFileHandle(name)).getFile()
  }
}

// ------------------------------------------------------------------------ zip

/**
 * ZIP entries are read at random rather than extracted, so a 1.6 GB archive
 * does not have to be unpacked to memory before the first tweet appears.
 */
export class ZipSource implements ArchiveSource {
  readonly kind = 'zip' as const
  #entries = new Map<string, any>()

  readonly label: string
  private constructor(label: string) { this.label = label }

  static async open(file: File): Promise<ZipSource> {
    const { ZipReader, BlobReader } = await import('@zip.js/zip.js')
    const source = new ZipSource(file.name)
    const reader = new ZipReader(new BlobReader(file))
    for (const entry of await reader.getEntries()) {
      if (entry.directory) continue
      // Normalize away a leading folder, which X's ZIPs sometimes include.
      const path = entry.filename.replace(/^[^/]*\/(?=data\/)/, '')
      if (isDirectMessagePath(path)) continue // never indexed, never listed
      source.#entries.set(path, entry)
    }
    return source
  }

  async list(): Promise<string[]> {
    return [...this.#entries.keys()]
      .filter((p) => p.startsWith('data/') && p.endsWith('.js') && !p.includes('/', 5))
      .map((p) => p.slice(5))
  }

  async readData(name: string): Promise<Uint8Array> {
    assertReadableDataFile(`data/${name}`)
    const entry = this.#entries.get(`data/${name}`)
    if (!entry) throw new Error(`${name} is not in this archive`)
    const { Uint8ArrayWriter } = await import('@zip.js/zip.js')
    return entry.getData(new Uint8ArrayWriter())
  }

  async listMedia(): Promise<string[]> {
    return [...this.#entries.keys()]
      .filter((p) => p.startsWith('data/tweets_media/'))
      .map((p) => p.slice('data/tweets_media/'.length))
      .filter((n) => n && !n.startsWith('.'))
  }

  async readMedia(name: string): Promise<Blob> {
    assertReadableMediaPath(`data/tweets_media/${name}`)
    const entry = this.#entries.get(`data/tweets_media/${name}`)
    if (!entry) throw new Error(`${name} is not in this archive`)
    const { BlobWriter } = await import('@zip.js/zip.js')
    return entry.getData(new BlobWriter())
  }
}

// -------------------------------------------------------------------- bundled

/**
 * The demo archive shipped with the app, served from its own static folder.
 *
 * The base must arrive absolute. Parsing happens in a worker, and a relative
 * URL inside a worker resolves against the worker script's own location — so
 * "./demo" became "/app/assets/demo" and every request 404'd. Resolving it on
 * the main thread, against the document, is the only place that is correct.
 */
export class BundledSource implements ArchiveSource {
  readonly kind = 'bundled' as const
  readonly label = 'Demo archive'
  #manifest: { data: string[]; media: string[] } | null = null

  #base: string
  constructor(base = demoBaseUrl()) {
    this.#base = base.replace(/\/+$/, '')
  }

  async #index() {
    if (!this.#manifest) {
      const res = await fetch(`${this.#base}/index.json`)
      this.#manifest = await res.json()
    }
    return this.#manifest!
  }

  async list() { return (await this.#index()).data }
  async listMedia() { return (await this.#index()).media }

  async readData(name: string): Promise<Uint8Array> {
    assertReadableDataFile(`data/${name}`)
    const res = await fetch(`${this.#base}/data/${name}`)
    return new Uint8Array(await res.arrayBuffer())
  }

  async readMedia(name: string): Promise<Blob> {
    assertReadableMediaPath(`data/tweets_media/${name}`)
    return (await fetch(`${this.#base}/data/tweets_media/${name}`)).blob()
  }
}
